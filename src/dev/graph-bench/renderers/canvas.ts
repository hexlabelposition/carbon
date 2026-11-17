import {
  css,
  EDGE_ALPHA,
  EDGE_COLOR,
  fit,
  NODE_COLOR,
  NODE_RADIUS,
  type RendererFactory,
} from "./renderer";

/**
 * Canvas 2D, no library: every frame draws all the visible edges as one
 * path and all the visible nodes as another.
 */
export const canvasRenderer: RendererFactory = async (
  container,
  graph,
  positions,
) => {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.append(canvas);
  const ratio = window.devicePixelRatio || 1;
  const width = container.clientWidth;
  const height = container.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("No 2D context");
  const ctx = context;
  const base = fit(positions, width, height);
  const { edges } = graph;
  const count = graph.titles.length;

  return {
    setView(view) {
      const scale = base.scale * view.zoom;
      // Layout units to CSS pixels: screen = (p - view) * scale + middle.
      const offsetX = width / 2 - view.x * scale;
      const offsetY = height / 2 - view.y * scale;
      const left = -offsetX / scale;
      const top = -offsetY / scale;
      const right = left + width / scale;
      const bottom = top + height / scale;
      const margin = NODE_RADIUS;

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
      ctx.strokeStyle = css(EDGE_COLOR, EDGE_ALPHA);
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = positions[i * 2];
        const y = positions[i * 2 + 1];
        if (
          x < left - margin ||
          x > right + margin ||
          y < top - margin ||
          y > bottom + margin
        ) {
          continue;
        }
        ctx.moveTo(x + NODE_RADIUS, y);
        ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
      }
      ctx.fillStyle = css(NODE_COLOR);
      ctx.fill();
    },
    destroy() {
      canvas.remove();
    },
  };
};
