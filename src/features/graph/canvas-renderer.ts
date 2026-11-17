import {
  FADED,
  MIN_NODE_PIXELS,
  NODE_RADIUS,
  type GraphRendererFactory,
  type Highlight,
} from "./graph-renderer";

/** Titles drawn at most in one frame: past that, text costs too much. */
const MAX_LABELS = 400;

/**
 * Canvas 2D, no library: each frame draws the visible links as one path
 * and the visible notes as another, faded under a highlight, which goes
 * over them; then the titles once notes are big enough on screen, and
 * those of the highlight. Drawn in the next animation frame, once per frame.
 */
export const canvasRenderer: GraphRendererFactory = (
  container,
  graph,
  initialPositions,
  initialCamera,
  initialColors,
  labelPixels,
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
  let highlight: Highlight | null = null;
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

    const lit = highlight;
    const inView = (i: number) => {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      return x >= left && x <= right && y >= top && y <= bottom;
    };
    const edgePath = (from: number, to: number) => {
      const a = edges[from] * 2;
      const b = edges[to] * 2;
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
        return;
      }
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    };
    const dot = (i: number, size: number) => {
      const x = positions[i * 2];
      const y = positions[i * 2 + 1];
      ctx.moveTo(x + size, y);
      ctx.arc(x, y, size, 0, Math.PI * 2);
    };

    // Everything, faded while something is highlighted.
    ctx.globalAlpha = lit === null ? 1 : FADED;
    ctx.beginPath();
    for (let i = 0; i < edges.length; i += 2) edgePath(i, i + 1);
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    const visible: number[] = [];
    const missing: number[] = [];
    ctx.beginPath();
    for (let i = 0; i < titles.length; i++) {
      if (!inView(i)) continue;
      visible.push(i);
      if (graph.missing[i] === 1) missing.push(i);
      else if (i !== current) dot(i, radius);
    }
    ctx.fillStyle = colors.node;
    ctx.fill();
    if (missing.length > 0) {
      ctx.beginPath();
      for (const i of missing) dot(i, radius);
      ctx.fillStyle = colors.missing;
      ctx.fill();
    }
    if (current !== null) {
      ctx.beginPath();
      dot(current, radius * 1.5);
      ctx.fillStyle = colors.current;
      ctx.fill();
    }

    // Then the highlight over it, at full strength.
    ctx.globalAlpha = 1;
    if (lit !== null) {
      ctx.beginPath();
      for (const edge of lit.edges) edgePath(edge * 2, edge * 2 + 1);
      ctx.strokeStyle = colors.current;
      ctx.stroke();
      for (const absent of [0, 1]) {
        ctx.beginPath();
        for (const i of lit.nodes) {
          if (i !== current && graph.missing[i] === absent) dot(i, radius);
        }
        ctx.fillStyle = absent === 1 ? colors.missing : colors.node;
        ctx.fill();
      }
      if (current !== null && lit.nodes.has(current)) {
        ctx.beginPath();
        dot(current, radius * 1.5);
        ctx.fillStyle = colors.current;
        ctx.fill();
      }
    }

    const zoomedIn =
      radius * scale >= labelPixels && visible.length <= MAX_LABELS;
    if (!zoomedIn && lit === null) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.font = `12px ${getComputedStyle(container).fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = colors.label;
    const label = (i: number) => {
      const x = positions[i * 2] * scale + offsetX;
      const y = (positions[i * 2 + 1] + radius) * scale + offsetY + 3;
      ctx.fillText(titles[i], x, y);
    };
    if (zoomedIn) {
      ctx.globalAlpha = lit === null ? 1 : FADED;
      for (const i of visible) if (lit === null || !lit.nodes.has(i)) label(i);
      ctx.globalAlpha = 1;
    }
    // The titles of a highlight show at any zoom.
    if (lit !== null) for (const i of lit.nodes) if (inView(i)) label(i);
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
    setHighlight(next) {
      highlight = next;
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
