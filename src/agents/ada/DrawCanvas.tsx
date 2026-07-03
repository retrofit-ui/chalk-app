import { type Component, onMount } from 'solid-js';
import type { ChalkDrawSpec } from './spec';
import styles from './DrawCanvas.module.css';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 420;

const DrawCanvas: Component<{
  spec: ChalkDrawSpec;
  onSubmit: (imageBase64: string) => void;
}> = (props) => {
  let canvas!: HTMLCanvasElement;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  const xDomain = () => props.spec.xDomain ?? [-5, 5];
  const yDomain = () => props.spec.yDomain ?? [-5, 5];

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

    // Minor grid lines at every integer
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(x0); x <= x1; x++) {
      const px = toPixelX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = Math.ceil(y0); y <= y1; y++) {
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
      const labelY = Math.min(Math.max(axisY + 12, 12), CANVAS_HEIGHT - 4);
      ctx.fillText(String(x), px, labelY);
    }
    ctx.textAlign = 'right';
    for (let y = Math.ceil(y0); y <= y1; y++) {
      if (y === 0) continue;
      const py = toPixelY(y);
      const labelX = Math.min(Math.max(axisX - 4, 20), CANVAS_WIDTH - 4);
      ctx.fillText(String(y), labelX, py + 4);
    }
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
    <div class={styles.container}>
      {props.spec.title && <div class={styles.title}>{props.spec.title}</div>}
      {props.spec.prompt && <div class={styles.prompt}>{props.spec.prompt}</div>}
      <canvas
        ref={canvas}
        class={styles.canvas}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div class={styles.actions}>
        <button class={styles.clearBtn} onClick={clear}>Clear</button>
        <button class={styles.submitBtn} onClick={submit}>Submit drawing</button>
      </div>
    </div>
  );
};

export default DrawCanvas;
