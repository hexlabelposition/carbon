import Graph from "graphology";
import Sigma from "sigma";
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
 * sigma.js on WebGL over a graphology graph. It draws in its own
 * animation frame after the camera moves.
 */
export const sigmaRenderer: RendererFactory = async (
  container,
  graph,
  positions,
) => {
  const model = new Graph({
    type: "directed",
    multi: false,
    allowSelfLoops: false,
  });
  const count = graph.titles.length;
  for (let i = 0; i < count; i++) {
    model.addNode(i, {
      x: positions[i * 2],
      // sigma's y goes up.
      y: -positions[i * 2 + 1],
      label: graph.titles[i],
    });
  }
  const { edges } = graph;
  for (let i = 0; i < edges.length; i += 2) {
    model.addEdge(edges[i], edges[i + 1]);
  }
  const sigma = new Sigma(model, container, {
    styles: {
      nodes: {
        color: css(NODE_COLOR),
        size: NODE_RADIUS,
        labelVisibility: "hidden",
      },
      edges: { color: css(EDGE_COLOR), opacity: EDGE_ALPHA, size: 1 },
    },
    settings: {
      renderLabels: false,
      hideEdgesOnMove: false,
      // The whole graph fills the view at zoom 1, as in the other renderers.
      stagePadding: 0,
      // Node sizes in layout units: nodes grow with the zoom, as in the
      // other renderers.
      itemSizesReference: "positions",
      minCameraRatio: 0.01,
      maxCameraRatio: 100,
    },
  });
  const camera = sigma.getCamera();
  const base = fit(positions, container.clientWidth, container.clientHeight);
  return {
    setView(view) {
      // sigma's frame is the layout scaled into 0..1 by its larger side.
      camera.setState({
        x: 0.5 + (view.x - base.x) / base.span,
        y: 0.5 - (view.y - base.y) / base.span,
        ratio: 1 / view.zoom,
      });
    },
    destroy() {
      sigma.kill();
    },
  };
};
