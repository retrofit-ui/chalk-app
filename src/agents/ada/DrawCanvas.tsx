import { type Component, onMount } from 'solid-js';
import type { ChalkDrawSpec } from './spec';
import { resolveDraw } from './resolveSpecs';
import { equalScaleDomains, formatAngle, polarGrid, polarToCartesian, spokeLabelPoint } from './coords';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 420;

// Under a polar grid the angle labels ring the border; axis numbers this close to it would collide.
const EDGE_CLEARANCE = 24;

const SIZE_MAX_WIDTH: Record<string, number> = { small: 320, medium: 640, large: 900 };

const DrawCanvas: Component<{
  spec: ChalkDrawSpec;
  onSubmit: (imageBase64: string) => void;
}> = (props) => {
  let canvas!: HTMLCanvasElement;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Throws a SpecValidationError for a bad spec; ChalkSpecRenderer shows it.
  const resolved = resolveDraw(props.spec);
  const polar = resolved.grid === 'polar';
  // The canvas isn't square: a polar grid needs equal scale on both axes or its rings are ellipses.
  const domains = polar
    ? equalScaleDomains(resolved.xDomain, resolved.yDomain, CANVAS_WIDTH, CANVAS_HEIGHT)
    : { xDomain: resolved.xDomain, yDomain: resolved.yDomain };
  const xDomain = () => domains.xDomain;
  const yDomain = () => domains.yDomain;

  const toPixelX = (x: number) => {
    const [x0, x1] = xDomain();
    return ((x - x0) / (x1 - x0)) * CANVAS_WIDTH;
  };

  const toPixelY = (y: number) => {
    const [y0, y1] = yDomain();
    return (1 - (y - y0) / (y1 - y0)) * CANVAS_HEIGHT;
  };

  const drawGrid = () => {
    const ctx = canvas.getContext('2d')!;
    const [x0, x1] = xDomain();
    const [y0, y1] = yDomain();

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (polar) drawPolarGrid(ctx);

    // Minor grid lines at every integer
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(x0); x <= x1 && !polar; x++) {
      const px = toPixelX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = Math.ceil(y0); y <= y1 && !polar; y++) {
      const py = toPixelY(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CANVAS_WIDTH, py);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    const axisX = toPixelX(0);
    const axisY = toPixelY(0);
    if (axisX >= 0 && axisX <= CANVAS_WIDTH) {
      ctx.beginPath();
      ctx.moveTo(axisX, 0);
      ctx.lineTo(axisX, CANVAS_HEIGHT);
      ctx.stroke();
    }
    if (axisY >= 0 && axisY <= CANVAS_HEIGHT) {
      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(CANVAS_WIDTH, axisY);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let x = Math.ceil(x0); x <= x1; x++) {
      if (x === 0) continue;
      const px = toPixelX(x);
      if (polar && (px < EDGE_CLEARANCE || px > CANVAS_WIDTH - EDGE_CLEARANCE)) continue;
      const labelY = Math.min(Math.max(axisY + 12, 12), CANVAS_HEIGHT - 4);
      ctx.fillText(String(x), px, labelY);
    }
    ctx.textAlign = 'right';
    for (let y = Math.ceil(y0); y <= y1; y++) {
      if (y === 0) continue;
      const py = toPixelY(y);
      if (polar && (py < EDGE_CLEARANCE || py > CANVAS_HEIGHT - EDGE_CLEARANCE)) continue;
      const labelX = Math.min(Math.max(axisX - 4, 20), CANVAS_WIDTH - 4);
      ctx.fillText(String(y), labelX, py + 4);
    }
  };

  // Rings and spokes (every π/6), with angle labels around the border. Drawn into the canvas,
  // so the image Ada receives carries the grid too.
  const drawPolarGrid = (ctx: CanvasRenderingContext2D) => {
    const { rings, spokes, rMax } = polarGrid(xDomain(), yDomain());
    const reach = rings[rings.length - 1] ?? rMax;
    const pxPerUnit = CANVAS_WIDTH / (xDomain()[1] - xDomain()[0]);
    const cx = toPixelX(0);
    const cy = toPixelY(0);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (const r of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * pxPerUnit, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const theta of spokes) {
      const [x, y] = polarToCartesian(reach, theta);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(toPixelX(x), toPixelY(y));
      ctx.stroke();
      const at = spokeLabelPoint(theta, xDomain(), yDomain(), 14 / pxPerUnit);
      if (at) ctx.fillText(formatAngle(theta, resolved.angleUnit), toPixelX(at[0]), toPixelY(at[1]));
    }
    ctx.textBaseline = 'alphabetic';
  };

  onMount(() => {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    drawGrid();
  });

  const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    if (e instanceof MouseEvent) {
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }
    const t = e.touches[0];
    return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
  };

  const stopDraw = () => { isDrawing = false; };

  const clear = () => { drawGrid(); };

  const submit = () => {
    const dataUrl = canvas.toDataURL('image/png');
    props.onSubmit(dataUrl.split(',')[1]);
  };

  return (
    <div data-kind="chalk-draw" data-grid={resolved.grid} class="my-2 max-w-160" style={{ 'max-width': `${SIZE_MAX_WIDTH[props.spec.size ?? 'medium']}px` }}>
      {props.spec.title && <div class="text-sm font-semibold text-slate-700 mb-1">{props.spec.title}</div>}
      {props.spec.prompt && <div class="text-sm text-slate-600 mb-2 italic">{props.spec.prompt}</div>}
      <canvas
        ref={canvas}
        class="block w-full border border-slate-200 rounded-md cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div class="flex gap-2 mt-2">
        <button
          class="text-xs py-1 px-2.5 border border-slate-300 rounded bg-slate-50 text-slate-500 cursor-pointer hover:bg-slate-100"
          onClick={clear}
        >
          Clear
        </button>
        <button
          class="text-xs py-1 px-3.5 border-none rounded bg-blue-600 text-white cursor-pointer font-medium hover:bg-blue-700"
          onClick={submit}
        >
          Submit drawing
        </button>
      </div>
    </div>
  );
};

export default DrawCanvas;
