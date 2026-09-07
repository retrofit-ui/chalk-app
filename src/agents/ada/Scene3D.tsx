import { type Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Chalk3DPlane, Chalk3DPoint, Chalk3DVector, ChalkGraph3DSpec, Vec3 } from './spec';
import { color } from './palette';

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

const Scene3D: Component<{ spec: ChalkGraph3DSpec }> = (props) => {
  let el!: HTMLDivElement;
  let scene!: THREE.Scene;
  let camera!: THREE.PerspectiveCamera;
  let renderer!: THREE.WebGLRenderer;
  let labelRenderer!: CSS2DRenderer;
  let controls!: OrbitControls;
  let contentGroup!: THREE.Group;
  let rafId = 0;
  let currentWidth = 0;

  const raycaster = new THREE.Raycaster();
  let dragging = false;
  let draggableMesh: THREE.Mesh | null = null;
  const dragPlane = new THREE.Plane();
  const dragIntersect = new THREE.Vector3();

  let frameDisposables: Disposable[] = [];
  let frameLabels: CSS2DObject[] = [];

  const [dragPos, setDragPos] = createSignal<Vec3 | null>(null);

  // Re-seed the live drag position whenever the spec itself changes (not when we drag it ourselves).
  createEffect(() => {
    const dp = (props.spec.points ?? []).find((p) => p.draggable);
    setDragPos(dp ? [...dp.position] : null);
  });

  const clearContent = () => {
    for (const d of frameDisposables) d.dispose();
    frameDisposables = [];
    for (const l of frameLabels) l.element.remove();
    frameLabels = [];
    while (contentGroup.children.length) contentGroup.remove(contentGroup.children[0]);
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
    camera.position.set(5, 4, 7);
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
    scene.add(contentGroup);

    el.style.height = `${h0}px`;
    currentWidth = w0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      controls.update();
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

  createEffect(() => {
    const spec = props.spec;
    const live = dragPos();
    if (!scene) return; // guard first run before onMount has initialized three.js

    clearContent();
    draggableMesh = null;

    const points = spec.points ?? [];
    const explicitVectors = spec.vectors ?? [];
    const planes = spec.planes ?? [];

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
      contentGroup.add(mesh);
      frameDisposables.push(geo, mat);

      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: c });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(v3(plane.point));
      edges.quaternion.copy(quat);
      contentGroup.add(edges);
      frameDisposables.push(edgesGeo, edgesMat);

      if (plane.label) {
        const label = makeLabel(plane.label, c);
        label.position.copy(v3(plane.point));
        contentGroup.add(label);
        frameLabels.push(label);
      }
    });

    // Points
    points.forEach((p, i) => {
      const pos = p.draggable ? (live ?? p.position) : p.position;
      const c = color(p.colorIndex ?? i);
      const geo = new THREE.SphereGeometry(0.08, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: c });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(v3(pos));
      mesh.userData.draggable = !!p.draggable;
      contentGroup.add(mesh);
      frameDisposables.push(geo, mat);
      if (p.draggable) draggableMesh = mesh;

      if (p.label) {
        const label = makeLabel(p.label, c);
        label.position.copy(v3(pos));
        contentGroup.add(label);
        frameLabels.push(label);
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
      contentGroup.add(arrow);
      frameDisposables.push({ dispose: () => disposeArrow(arrow) });

      if (vec.label) {
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const label = makeLabel(vec.label, `#${hex.toString(16).padStart(6, '0')}`);
        label.position.copy(mid);
        contentGroup.add(label);
        frameLabels.push(label);
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
      contentGroup.add(yMesh);
      frameDisposables.push(yGeo, yMat);

      const yLabel = makeLabel('ŷ', yHatColor);
      yLabel.position.copy(yHat);
      contentGroup.add(yLabel);
      frameLabels.push(yLabel);

      // Solid vector: plane point -> ŷ (the projection itself)
      const projDir = yHat.clone().sub(planePoint);
      const projLen = projDir.length();
      if (projLen > 1e-6) {
        projDir.normalize();
        const projArrow = new THREE.ArrowHelper(projDir, planePoint, projLen, yHatColor, Math.min(0.3, projLen * 0.2), Math.min(0.2, projLen * 0.15));
        contentGroup.add(projArrow);
        frameDisposables.push({ dispose: () => disposeArrow(projArrow) });
      }

      // Dashed residual: ŷ -> original point (muted color, per the dashed-style decision above)
      const eDir = p.clone().sub(yHat);
      const eLen = eDir.length();
      if (eLen > 1e-6) {
        eDir.normalize();
        const eHex = muted(color((plane.colorIndex ?? 0) + 2));
        const eArrow = new THREE.ArrowHelper(eDir, yHat, eLen, eHex, Math.min(0.3, eLen * 0.2), Math.min(0.2, eLen * 0.15));
        contentGroup.add(eArrow);
        frameDisposables.push({ dispose: () => disposeArrow(eArrow) });

        const eMid = yHat.clone().add(p).multiplyScalar(0.5);
        const eLabel = makeLabel('e', `#${eHex.toString(16).padStart(6, '0')}`);
        eLabel.position.copy(eMid);
        contentGroup.add(eLabel);
        frameLabels.push(eLabel);
      }
    }

    // Axes
    if (spec.showAxes !== false) {
      const axes = new THREE.AxesHelper(4);
      contentGroup.add(axes);
      frameDisposables.push({
        dispose: () => {
          axes.geometry.dispose();
          (axes.material as THREE.Material).dispose();
        },
      });
    }

    resize(currentWidth || el.offsetWidth);
  });

  onCleanup(() => {
    cancelAnimationFrame(rafId);
    clearContent();
    controls?.dispose();
    renderer?.dispose();
    el.replaceChildren();
  });

  return (
    <div class="my-2" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
      {props.spec.title && <div class="text-sm font-semibold text-slate-700 mb-1">{props.spec.title}</div>}
      <div ref={el} class="w-full relative" />
    </div>
  );
};

export default Scene3D;
