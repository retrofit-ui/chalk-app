import { type Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { ChalkGraph3DSpec, Vec3 } from './spec';
import { color } from './palette';
import { cellRgb } from './colorScale';
import { clampResolution, sampleSurface } from './surfaceSampler';
import { sampleCurvilinear } from './curvilinearSurface';
import { resolveScene, type ResolvedScene } from './resolveSpecs';
import { formatAngle, polarGrid, polarToCartesian } from './coords';

const SIZE_MAX_WIDTH: Record<string, number> = { small: 320, medium: 560, large: 820 };
const ASPECT = 3 / 4; // height = width * ASPECT

// Lightens a hex color toward white by `amount` (0-1) — used as the pragmatic stand-in for "dashed" vectors.
const muted = (hex: string, amount = 0.55) => {
  const c = new THREE.Color(hex);
  const white = new THREE.Color('#ffffff');
  c.lerp(white, amount);
  return c.getHex();
};

const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);

// Gram-Schmidt orthonormalization of two (possibly non-orthogonal, non-unit) basis vectors,
// plus their cross product as the plane normal. Shared by plane-mesh orientation and the
// auto-derived projection math so both use identical geometry.
const orthonormalizeBasis = (b1: Vec3, b2: Vec3) => {
  const u1 = v3(b1).normalize();
  const raw2 = v3(b2);
  const proj = u1.clone().multiplyScalar(raw2.dot(u1));
  const u2 = raw2.clone().sub(proj).normalize();
  const normal = u1.clone().cross(u2).normalize();
  return { u1, u2, normal };
};

type Disposable = { dispose: () => void };

const disposeArrow = (arrow: THREE.ArrowHelper) => {
  arrow.line.geometry.dispose();
  (arrow.line.material as THREE.Material).dispose();
  arrow.cone.geometry.dispose();
  (arrow.cone.material as THREE.Material).dispose();
};

const makeLabel = (text: string, colorHex = '#334155') => {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.fontSize = '12px';
  div.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
  div.style.fontWeight = '600';
  div.style.color = colorHex;
  div.style.pointerEvents = 'none';
  div.style.transform = 'translate(6px, -6px)';
  div.style.whiteSpace = 'nowrap';
  return new CSS2DObject(div);
};

// A traveling marker animation for a `Chalk3DPath` with `animate: true`. Driven from inside the
// existing tick() RAF loop via plain closure state (NOT a Solid signal) — a signal here would
// retrigger the content-rebuild effect on every animation frame, which is exactly the perf trap
// this file is designed to avoid for surfaces (see the static/dynamic effect split below).
type PathAnimation = {
  mesh: THREE.Object3D;
  points: THREE.Vector3[];
  startTime: number;
  durationMs: number;
};

const PATH_ANIMATION_DURATION_MS = 2500;

const FLOOR_GRID_COLOR = '#cbd5e1';
const BASIS_COLOR = '#94a3b8';
const DEFAULT_FLOOR_RADIUS = 4; // matches the AxesHelper length
const MAX_FLOOR_RADIUS = 20;

// A floor grid in z = 0 (the xy-plane): integer squares, or rings + spokes every π/6.
function buildFloorGrid(
  grid: ResolvedScene['grid'],
  radius: number,
  angleUnit: ResolvedScene['angleUnit'],
): { objects: THREE.Object3D[]; disposables: Disposable[]; labels: CSS2DObject[] } {
  const segments: number[] = [];
  const labels: CSS2DObject[] = [];
  if (grid === 'cartesian') {
    for (let k = -radius; k <= radius; k++) {
      segments.push(k, -radius, 0, k, radius, 0, -radius, k, 0, radius, k, 0);
    }
  } else if (grid === 'polar') {
    const { rings, spokes } = polarGrid([-radius, radius], [-radius, radius]);
    const reach = rings.filter((r) => r <= radius).at(-1) ?? radius;
    const STEPS = 96;
    for (const r of rings.filter((ring) => ring <= radius)) {
      for (let k = 0; k < STEPS; k++) {
        const [x1, y1] = polarToCartesian(r, (k * 2 * Math.PI) / STEPS);
        const [x2, y2] = polarToCartesian(r, ((k + 1) * 2 * Math.PI) / STEPS);
        segments.push(x1, y1, 0, x2, y2, 0);
      }
    }
    for (const theta of spokes) {
      const [x, y] = polarToCartesian(reach, theta);
      segments.push(0, 0, 0, x, y, 0);
      const label = makeLabel(formatAngle(theta, angleUnit), BASIS_COLOR);
      label.element.style.fontWeight = '400';
      label.element.style.fontSize = '10px';
      label.position.set(...polarToCartesian(reach * 1.12, theta), 0);
      labels.push(label);
    }
  }
  if (!segments.length) return { objects: [], disposables: [], labels };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  const mat = new THREE.LineBasicMaterial({ color: FLOOR_GRID_COLOR, transparent: true, opacity: 0.7 });
  return { objects: [new THREE.LineSegments(geo, mat), ...labels], disposables: [geo, mat], labels };
}

const Scene3D: Component<{ spec: ChalkGraph3DSpec }> = (props) => {
  // Every position resolved to cartesian up front; throws a SpecValidationError for a bad
  // spec, which ChalkSpecRenderer shows. A changed spec remounts this component.
  const resolved = resolveScene(props.spec);
  let el!: HTMLDivElement;
  let scene!: THREE.Scene;
  let camera!: THREE.PerspectiveCamera;
  let renderer!: THREE.WebGLRenderer;
  let labelRenderer!: CSS2DRenderer;
  let controls!: OrbitControls;
  let contentGroup!: THREE.Group;
  // Static content (planes, surfaces, paths, axes) lives in its own subgroup, rebuilt only when
  // the spec's static fields change. Dynamic content (points/vectors/auto-projection) lives in a
  // separate subgroup, rebuilt on every drag frame. Splitting these means dragging a point never
  // re-touches (and, critically, never re-samples) the surface mesh.
  let staticGroup!: THREE.Group;
  let dynamicGroup!: THREE.Group;
  let rafId = 0;
  let currentWidth = 0;

  const raycaster = new THREE.Raycaster();
  let dragging = false;
  let draggableMesh: THREE.Mesh | null = null;
  const dragPlane = new THREE.Plane();
  const dragIntersect = new THREE.Vector3();

  let staticDisposables: Disposable[] = [];
  let staticLabels: CSS2DObject[] = [];
  let dynamicDisposables: Disposable[] = [];
  let dynamicLabels: CSS2DObject[] = [];
  let activeAnimations: PathAnimation[] = [];

  const [dragPos, setDragPos] = createSignal<Vec3 | null>(null);

  // Re-seed the live drag position whenever the spec itself changes (not when we drag it ourselves).
  createEffect(() => {
    void props.spec;
    const dp = resolved.points.find((p) => p.draggable);
    setDragPos(dp ? [...dp.position] : null);
  });

  const clearStatic = () => {
    for (const d of staticDisposables) d.dispose();
    staticDisposables = [];
    for (const l of staticLabels) l.element.remove();
    staticLabels = [];
    activeAnimations = [];
    while (staticGroup.children.length) staticGroup.remove(staticGroup.children[0]);
  };

  const clearDynamic = () => {
    for (const d of dynamicDisposables) d.dispose();
    dynamicDisposables = [];
    for (const l of dynamicLabels) l.element.remove();
    dynamicLabels = [];
    while (dynamicGroup.children.length) dynamicGroup.remove(dynamicGroup.children[0]);
  };

  const resize = (w: number) => {
    if (!w) return;
    w = Math.min(w, SIZE_MAX_WIDTH[props.spec.size ?? 'medium']);
    currentWidth = w;
    const h = Math.round(w * ASPECT);
    el.style.height = `${h}px`;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const pointerNDC = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!draggableMesh) return;
    raycaster.setFromCamera(pointerNDC(e), camera);
    const hits = raycaster.intersectObject(draggableMesh, false);
    if (!hits.length) return;
    dragging = true;
    controls.enabled = false;
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);
    dragPlane.setFromNormalAndCoplanarPoint(viewDir, draggableMesh.position);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    raycaster.setFromCamera(pointerNDC(e), camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
      setDragPos([dragIntersect.x, dragIntersect.y, dragIntersect.z]);
    }
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    controls.enabled = true;
  };

  onMount(() => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');

    const w0 = Math.min(el.offsetWidth || SIZE_MAX_WIDTH[props.spec.size ?? 'medium'], SIZE_MAX_WIDTH[props.spec.size ?? 'medium']);
    const h0 = Math.round(w0 * ASPECT);

    camera = new THREE.PerspectiveCamera(50, w0 / h0, 0.1, 1000);
    // z is up: specs give heights as z (z = f(x, y), cylinders along z). three.js defaults to
    // y-up, which laid every surface on its side. Set before OrbitControls, which reads it.
    camera.up.set(0, 0, 1);
    camera.position.set(7, 5, 4.5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w0, h0);
    el.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w0, h0);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    el.appendChild(labelRenderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    contentGroup = new THREE.Group();
    staticGroup = new THREE.Group();
    dynamicGroup = new THREE.Group();
    contentGroup.add(staticGroup);
    contentGroup.add(dynamicGroup);
    scene.add(contentGroup);

    el.style.height = `${h0}px`;
    currentWidth = w0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      controls.update();

      // Advance any running path-marker animations in place — plain closure state, not a Solid
      // signal, so this never touches the reactive graph or retriggers a content rebuild.
      if (activeAnimations.length) {
        const now = performance.now();
        for (let i = activeAnimations.length - 1; i >= 0; i--) {
          const anim = activeAnimations[i];
          const segments = anim.points.length - 1;
          if (segments <= 0) {
            activeAnimations.splice(i, 1);
            continue;
          }
          const t = Math.min(1, (now - anim.startTime) / anim.durationMs);
          const scaled = t * segments;
          const segIdx = Math.min(segments - 1, Math.floor(scaled));
          const localT = scaled - segIdx;
          anim.mesh.position.lerpVectors(anim.points[segIdx], anim.points[segIdx + 1], localT);
          if (t >= 1) activeAnimations.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver((entries) => {
      resize(Math.round(entries[0].contentRect.width));
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointerleave', endDrag);
    onCleanup(() => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      dom.removeEventListener('pointerleave', endDrag);
    });
  });

  // A cylindrical/spherical surface: an indexed mesh over its (u, v) grid, coloured by the
  // solved coordinate, with its own coordinate lines (circles, meridians) as the wire overlay.
  const addCurvilinearSurface = (s: Extract<ResolvedScene['surfaces'][number], { kind: 'curvilinear' }>, i: number) => {
    const style = s.surface;
    const result = sampleCurvilinear(s.input, style.resolution ?? 40);
    if (!result.ok) {
      console.warn(`[Scene3D] skipping surface "${s.input.expr}": ${result.error}`);
      return;
    }
    const { positions, values, valid, indices, valueMin, valueMax, wire } = result.mesh;
    const scale = style.colorScale ?? 'sequential';
    const c = color(i);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colors = new Float32Array(values.length * 3);
    values.forEach((v, idx) => {
      const [r, g, b] = cellRgb(valid[idx] ? v : valueMin, valueMin, valueMax, scale);
      colors.set([r / 255, g / 255, b / 255], idx * 3);
    });
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    staticDisposables.push(geo);

    if (!style.wireframe) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: style.opacity ?? 0.85, side: THREE.DoubleSide });
      staticGroup.add(new THREE.Mesh(geo, mat));
      staticDisposables.push(mat);
    }

    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const wireMat = new THREE.LineBasicMaterial({ color: c, transparent: !style.wireframe, opacity: style.wireframe ? 1 : 0.5 });
    staticGroup.add(new THREE.LineSegments(wireGeo, wireMat));
    staticDisposables.push(wireGeo, wireMat);

    if (style.label) {
      const validIdx = valid.map((ok, idx) => (ok ? idx : -1)).filter((idx) => idx >= 0);
      const mid = validIdx[Math.floor(validIdx.length / 2)];
      const label = makeLabel(style.label, c);
      label.position.set(positions[mid * 3], positions[mid * 3 + 1], positions[mid * 3 + 2]);
      staticGroup.add(label);
      staticLabels.push(label);
    }
  };

  // --- Static content effect -------------------------------------------------------------
  // Rebuilds everything that is derived purely from the spec's static fields: planes, surfaces,
  // paths, and the axes gizmo. Deliberately does NOT read `dragPos()` — that's the whole point.
  // A surface mesh can be up to 81x81 (~6,500) vertices, each requiring a mathjs evaluation to
  // build; re-sampling that on every pointer-move frame while dragging a point would be a real
  // perf problem, so this effect only reruns when `props.spec` itself changes (i.e. a new spec
  // arrives from the agent), never on drag.
  createEffect(() => {
    const spec = props.spec;
    if (!scene) return; // guard first run before onMount has initialized three.js

    clearStatic();

    const { planes, surfaces, paths } = resolved;

    // Planes
    planes.forEach((plane, i) => {
      const { u1, u2, normal } = orthonormalizeBasis(plane.basis1, plane.basis2);
      const rotMatrix = new THREE.Matrix4().makeBasis(u1, u2, normal);
      const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
      const extent = plane.extent ?? 3;
      const c = color(plane.colorIndex ?? i);

      const geo = new THREE.PlaneGeometry(extent * 2, extent * 2);
      const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(v3(plane.point));
      mesh.quaternion.copy(quat);
      staticGroup.add(mesh);
      staticDisposables.push(geo, mat);

      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: c });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(v3(plane.point));
      edges.quaternion.copy(quat);
      staticGroup.add(edges);
      staticDisposables.push(edgesGeo, edgesMat);

      if (plane.label) {
        const label = makeLabel(plane.label, c);
        label.position.copy(v3(plane.point));
        staticGroup.add(label);
        staticLabels.push(label);
      }
    });

    // Surfaces (loss landscapes, etc.) — a failed sample (bad mathjs expression) skips just that
    // surface, with a console.warn, rather than throwing and blanking the whole scene.
    surfaces.forEach((resolvedSurface, i) => {
      if (resolvedSurface.kind === 'curvilinear') {
        addCurvilinearSurface(resolvedSurface, i);
        return;
      }
      const surface = resolvedSurface.surface;
      const xDomain = surface.xDomain ?? [-3, 3];
      const yDomain = surface.yDomain ?? [-3, 3];
      const resolution = clampResolution(surface.resolution ?? 40);
      const result = sampleSurface(surface.fn, xDomain, yDomain, resolution);
      if (!result.ok) {
        console.warn(`[Scene3D] skipping surface "${surface.fn}": ${result.error}`);
        return;
      }
      const { xs, ys, zs, zMin, zMax } = result.surface;
      const scale = surface.colorScale ?? 'sequential';
      const opacity = surface.opacity ?? 0.85;
      const c = color(i);

      const xSpan = Math.abs(xDomain[1] - xDomain[0]) || 1;
      const ySpan = Math.abs(yDomain[1] - yDomain[0]) || 1;
      const geo = new THREE.PlaneGeometry(xSpan, ySpan, resolution, resolution);

      // PlaneGeometry's own vertex order is column-fastest-then-row (idx = ix + (resolution+1)*iy),
      // which matches sampleSurface()'s row-major (x-fastest, then y) output exactly — so we can
      // overwrite every vertex's full x/y/z directly from the sampled grid, keeping the same
      // [x, y, z] -> THREE.Vector3 convention used everywhere else in this file (see v3()),
      // rather than relying on PlaneGeometry's own (differently-centered) x/y placement.
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colors = new Float32Array(xs.length * 3);
      for (let idx = 0; idx < xs.length; idx++) {
        posAttr.setXYZ(idx, xs[idx], ys[idx], zs[idx]);
        const [r, g, b] = cellRgb(zs[idx], zMin, zMax, scale);
        colors[idx * 3] = r / 255;
        colors[idx * 3 + 1] = g / 255;
        colors[idx * 3 + 2] = b / 255;
      }
      posAttr.needsUpdate = true;
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      if (!surface.wireframe) {
        // This scene is fully unlit (MeshBasicMaterial everywhere) — no lighting rig is added,
        // so vertex colors (not shading) carry all the height information.
        const mat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        staticGroup.add(mesh);
        staticDisposables.push(mat);
      }

      // Grid/edge overlay: always present for readability. When `wireframe` is true, this is the
      // *only* thing rendered (no filled mesh above); otherwise it's an outline over the surface.
      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: c, transparent: !surface.wireframe, opacity: surface.wireframe ? 1 : 0.5 });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      staticGroup.add(edges);
      staticDisposables.push(edgesGeo, edgesMat);
      // geo itself is shared by the mesh and EdgesGeometry's source; EdgesGeometry copies its own
      // buffers, so `geo` is safe to dispose independently once both consumers are queued.
      staticDisposables.push(geo);

      if (surface.label) {
        const midIdx = Math.floor(xs.length / 2);
        const label = makeLabel(surface.label, c);
        label.position.set(xs[midIdx], ys[midIdx], zs[midIdx]);
        staticGroup.add(label);
        staticLabels.push(label);
      }
    });

    // Paths (e.g. gradient-descent trajectories) — waypoints are always agent-supplied; this
    // renderer never computes them.
    paths.forEach((path, i) => {
      if (path.points.length < 2) return;
      const c = color(path.colorIndex ?? i);
      const vecs = path.points.map(v3);

      const lineGeo = new THREE.BufferGeometry().setFromPoints(vecs);
      const lineMat = new THREE.LineBasicMaterial({ color: c });
      const line = new THREE.Line(lineGeo, lineMat);
      staticGroup.add(line);
      staticDisposables.push(lineGeo, lineMat);

      if (path.showMarkers !== false) {
        vecs.forEach((pos) => {
          const geo = new THREE.SphereGeometry(0.08, 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color: c });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          staticGroup.add(mesh);
          staticDisposables.push(geo, mat);
        });
      }

      if (path.label) {
        const label = makeLabel(path.label, c);
        label.position.copy(vecs[vecs.length - 1]);
        staticGroup.add(label);
        staticLabels.push(label);
      }

      if (path.animate) {
        const geo = new THREE.SphereGeometry(0.1, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: c });
        const marker = new THREE.Mesh(geo, mat);
        marker.position.copy(vecs[0]);
        staticGroup.add(marker);
        staticDisposables.push(geo, mat);
        activeAnimations.push({
          mesh: marker,
          points: vecs,
          startTime: performance.now(),
          durationMs: PATH_ANIMATION_DURATION_MS,
        });
      }
    });

    // Floor grid (z = 0), sized to cover any polar height map's disc — capped, since the grid
    // is built line by line and rDomain is model-written.
    const floorRadius = Math.min(
      MAX_FLOOR_RADIUS,
      Math.max(
        DEFAULT_FLOOR_RADIUS,
        ...surfaces.map((s) =>
          s.kind === 'curvilinear' && s.input.form === 'cylindrical-z' ? Math.ceil(Math.max(...s.input.uDomain.map(Math.abs))) : 0,
        ),
      ),
    );
    const floor = buildFloorGrid(resolved.grid, floorRadius, resolved.angleUnit);
    for (const o of floor.objects) staticGroup.add(o);
    staticDisposables.push(...floor.disposables);
    staticLabels.push(...floor.labels);

    // Axes
    if (spec.showAxes !== false) {
      const axes = new THREE.AxesHelper(4);
      staticGroup.add(axes);
      staticDisposables.push({
        dispose: () => {
          axes.geometry.dispose();
          (axes.material as THREE.Material).dispose();
        },
      });
    }

    resize(currentWidth || el.offsetWidth);
  });

  // --- Dynamic content effect ------------------------------------------------------------
  // Points, explicit vectors, and the auto-derived projection (ŷ, e) — unchanged behavior from
  // before the surface/path work. This is the only effect that reads `dragPos()`, so it's the
  // only one that reruns on every drag frame; it only ever touches `dynamicGroup`.
  createEffect(() => {
    void props.spec;
    const live = dragPos();
    if (!scene) return; // guard first run before onMount has initialized three.js

    clearDynamic();
    draggableMesh = null;

    const points = resolved.points;
    const explicitVectors = resolved.vectors;
    const planes = resolved.planes; // read-only here: plane *meshes* live in the static effect above

    // Points
    points.forEach((p, i) => {
      const pos = p.draggable ? (live ?? p.position) : p.position;
      const c = color(p.colorIndex ?? i);
      const geo = new THREE.SphereGeometry(0.08, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: c });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(v3(pos));
      mesh.userData.draggable = !!p.draggable;
      dynamicGroup.add(mesh);
      dynamicDisposables.push(geo, mat);
      if (p.draggable) draggableMesh = mesh;

      if (p.label) {
        const label = makeLabel(p.label, c);
        label.position.copy(v3(pos));
        dynamicGroup.add(label);
        dynamicLabels.push(label);
      }
    });

    // Explicit vectors
    explicitVectors.forEach((vec, i) => {
      const from = v3(vec.from);
      const to = v3(vec.to);
      const dir = to.clone().sub(from);
      const len = dir.length();
      if (len < 1e-6) return;
      dir.normalize();
      const c = color(vec.colorIndex ?? i);
      // "dashed" style is approximated with a muted (lightened) arrow color rather than a
      // true dashed line + separate cone — simpler and robust for this use case.
      const hex = vec.style === 'dashed' ? muted(c) : new THREE.Color(c).getHex();
      const arrow = new THREE.ArrowHelper(dir, from, len, hex, Math.min(0.3, len * 0.2), Math.min(0.2, len * 0.15));
      dynamicGroup.add(arrow);
      dynamicDisposables.push({ dispose: () => disposeArrow(arrow) });

      if (vec.label) {
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const label = makeLabel(vec.label, `#${hex.toString(16).padStart(6, '0')}`);
        label.position.copy(mid);
        dynamicGroup.add(label);
        dynamicLabels.push(label);
      }

      // The local unit basis (r̂ φ̂ ẑ or r̂ θ̂ φ̂) at the tail, for basis-component vectors.
      for (const b of vec.basis ?? []) {
        const basisArrow = new THREE.ArrowHelper(v3(b.dir), from, 1, muted(BASIS_COLOR, 0.2), 0.2, 0.12);
        dynamicGroup.add(basisArrow);
        dynamicDisposables.push({ dispose: () => disposeArrow(basisArrow) });
        const basisLabel = makeLabel(b.label, BASIS_COLOR);
        basisLabel.position.copy(from.clone().add(v3(b.dir).multiplyScalar(1.15)));
        dynamicGroup.add(basisLabel);
        dynamicLabels.push(basisLabel);
      }
    });

    // Auto-derived projection (ŷ, e) — only when there's exactly one draggable point,
    // no explicit vectors were given, and at least one plane exists.
    const draggablePoints = points.filter((p) => p.draggable);
    if (planes.length > 0 && explicitVectors.length === 0 && draggablePoints.length === 1) {
      const plane = planes[0];
      const { u1, u2 } = orthonormalizeBasis(plane.basis1, plane.basis2);
      const p = v3(live ?? draggablePoints[0].position);
      const planePoint = v3(plane.point);
      const rel = p.clone().sub(planePoint);
      const a = rel.dot(u1);
      const b = rel.dot(u2);
      const yHat = planePoint.clone().add(u1.clone().multiplyScalar(a)).add(u2.clone().multiplyScalar(b));

      const yHatColor = color((plane.colorIndex ?? 0) + 1);
      const yGeo = new THREE.SphereGeometry(0.07, 16, 16);
      const yMat = new THREE.MeshBasicMaterial({ color: yHatColor });
      const yMesh = new THREE.Mesh(yGeo, yMat);
      yMesh.position.copy(yHat);
      dynamicGroup.add(yMesh);
      dynamicDisposables.push(yGeo, yMat);

      const yLabel = makeLabel('ŷ', yHatColor);
      yLabel.position.copy(yHat);
      dynamicGroup.add(yLabel);
      dynamicLabels.push(yLabel);

      // Solid vector: plane point -> ŷ (the projection itself)
      const projDir = yHat.clone().sub(planePoint);
      const projLen = projDir.length();
      if (projLen > 1e-6) {
        projDir.normalize();
        const projArrow = new THREE.ArrowHelper(projDir, planePoint, projLen, yHatColor, Math.min(0.3, projLen * 0.2), Math.min(0.2, projLen * 0.15));
        dynamicGroup.add(projArrow);
        dynamicDisposables.push({ dispose: () => disposeArrow(projArrow) });
      }

      // Dashed residual: ŷ -> original point (muted color, per the dashed-style decision above)
      const eDir = p.clone().sub(yHat);
      const eLen = eDir.length();
      if (eLen > 1e-6) {
        eDir.normalize();
        const eHex = muted(color((plane.colorIndex ?? 0) + 2));
        const eArrow = new THREE.ArrowHelper(eDir, yHat, eLen, eHex, Math.min(0.3, eLen * 0.2), Math.min(0.2, eLen * 0.15));
        dynamicGroup.add(eArrow);
        dynamicDisposables.push({ dispose: () => disposeArrow(eArrow) });

        const eMid = yHat.clone().add(p).multiplyScalar(0.5);
        const eLabel = makeLabel('e', `#${eHex.toString(16).padStart(6, '0')}`);
        eLabel.position.copy(eMid);
        dynamicGroup.add(eLabel);
        dynamicLabels.push(eLabel);
      }
    }

    resize(currentWidth || el.offsetWidth);
  });

  onCleanup(() => {
    cancelAnimationFrame(rafId);
    clearStatic();
    clearDynamic();
    controls?.dispose();
    renderer?.dispose();
    el.replaceChildren();
  });

  return (
    <div data-kind="chalk-graph3d" class="my-2" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
      {props.spec.title && <div class="text-sm font-semibold text-slate-700 mb-1">{props.spec.title}</div>}
      <div ref={el} class="w-full relative" />
    </div>
  );
};

export default Scene3D;
