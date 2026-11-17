import {
  LABEL_NODE_PIXELS,
  MIN_NODE_PIXELS,
  NODE_RADIUS,
  type GraphRendererFactory,
} from "./graph-renderer";

/** Titles drawn at most in one frame: past that, text costs too much. */
const MAX_LABELS = 400;

/**
 * Canvas 2D, no library: each frame draws the visible links as one path
 * and the visible notes as another, then the titles once notes are big
 * enough on screen. Drawn in the next animation frame, once per frame.
 */
export const canvasRenderer: GraphRendererFactory = (
  container,
  graph,
  initialPositions,
  initialCamera,
  initialColors,
) => {
  const canvas = document.createElement("canvas");
  canvas.className = "absolute inset-0 h-full w-full";
  container.append(canvas);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas 2D is not available");
  const ctx = context;
  let positions = initialPositions;
  let camera = initialCamera;
  let colors = initialColors;
  let current: number | null = null;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame = 0;

  const size = () => {
    ratio = window.devicePixelRatio || 1;
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  };

  const draw = () => {
    frame = 0;
    const { edges, titles } = graph;
    const scale = camera.scale;
    const offsetX = width / 2 - camera.x * scale;
    const offsetY = height / 2 - camera.y * scale;
    const radius = Math.max(NODE_RADIUS, MIN_NODE_PIXELS / scale);
    const left = -offsetX / scale - radius;
    const top = -offsetY / scale - radius;
    const right = (width - offsetX) / scale + radius;
    const bottom = (height - offsetY) / scale + radius;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      ratio * scale,
      0,
      0,
      ratio * scale,
      ratio * offsetX,
      ratio * offsetY,
    );

    ctx.beginPath();
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i] * 2;
      const b = edges[i + 1] * 2;
      const ax = positions[a];
      const ay = positions[a + 1];
      const bx = positions[b];
      const by = positions[b + 1];
      if (
        (ax < left && bx < left) ||
        (ax > right && bx > right) ||
        (ay < top && by < top) ||
        (ay > bottom && by > bottom)
      ) {
        continue;
      }
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    const visible: number[] = [];
    ctx.beginPath();
    for (let i = 0; i < titles.length; i++) {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      if (x < left || x > right || y < top || y > bottom) continue;
      visible.push(i);
      if (i === current) continue;
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = colors.node;
    ctx.fill();
    if (current !== null) {
      ctx.beginPath();
      ctx.arc(
        positions[current * 2],
        positions[current * 2 + 1],
        radius * 1.5,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = colors.current;
      ctx.fill();
    }

    if (radius * scale < LABEL_NODE_PIXELS || visible.length > MAX_LABELS)
      return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.font = `12px ${getComputedStyle(container).fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = colors.label;
    for (const i of visible) {
      const x = positions[i * 2] * scale + offsetX;
      const y = (positions[i * 2 + 1] + radius) * scale + offsetY + 3;
      ctx.fillText(titles[i], x, y);
    }
  };

  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(draw);
  };

  size();
  schedule();
  return {
    setPositions(next) {
      positions = next;
      schedule();
    },
    setCamera(next) {
      camera = next;
      schedule();
    },
    setCurrent(next) {
      current = next;
      schedule();
    },
    setColors(next) {
      colors = next;
      schedule();
    },
    resize() {
      size();
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      canvas.remove();
    },
  };
};
