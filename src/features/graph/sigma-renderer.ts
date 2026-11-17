import Graph from "graphology";
import Sigma from "sigma";
import {
  FADED,
  NODE_RADIUS,
  type Camera,
  type GraphRendererFactory,
  type Highlight,
} from "./graph-renderer";

interface NodeAttributes {
  x: number;
  y: number;
  label: string;
  current: boolean;
}

/**
 * sigma.js on WebGL over a graphology graph. The graph view moves its
 * camera: sigma does not see the pointer.
 */
export const sigmaRenderer: GraphRendererFactory = (
  stage,
  graph,
  positions,
  initialCamera,
  initialColors,
  labelPixels,
) => {
  // The graph view takes the pointer on the stage and moves the camera
  // itself. sigma listens on its container, so it gets one of its own
  // that the pointer passes through. Turning its camera controls off
  // instead would block the graph view too: its camera then takes no
  // state at all.
  const layer = document.createElement("div");
  layer.className = "pointer-events-none absolute inset-0";
  stage.append(layer);
  let colors = initialColors;
  let current: number | null = null;
  const model = new Graph<NodeAttributes>({
    type: "directed",
    multi: false,
    allowSelfLoops: false,
  });
  graph.titles.forEach((title, i) => {
    // sigma's y goes up, the layout's down.
    model.addNode(i, {
      x: positions[i * 2],
      y: -positions[i * 2 + 1],
      label: title,
      current: false,
    });
  });
  const { edges } = graph;
  /** The keys graphology gave the links, by their index. */
  const edgeKeys: string[] = [];
  for (let i = 0; i < edges.length; i += 2) {
    edgeKeys.push(model.addEdge(edges[i], edges[i + 1]));
  }
  let highlight: Highlight | null = null;
  /** Faded while something is highlighted and it is not part of it. */
  const faded = (
    state: { isHighlighted: boolean },
    graphState: { hasHighlighted: boolean },
  ) => (graphState.hasHighlighted && !state.isHighlighted ? FADED : 1);

  const sigma = new Sigma(model, layer, {
    styles: {
      nodes: {
        color: (attributes) =>
          attributes.current ? colors.current : colors.node,
        size: (attributes) =>
          attributes.current ? NODE_RADIUS * 1.5 : NODE_RADIUS,
        opacity: (_attributes, state, graphState) => faded(state, graphState),
        // Stated with the rest: a node style of its own replaces sigma's.
        label: { attribute: "label" },
        // The titles of a highlight show at any zoom.
        labelVisibility: (_attributes, state) =>
          state.isHighlighted ? "visible" : "auto",
        labelColor: () => colors.label,
        labelSize: 12,
      },
      // Thinner than `minEdgeThickness`: drawn one pixel wide at any zoom,
      // as in the other renderers.
      edges: {
        color: (_attributes, state) =>
          state.isHighlighted ? colors.current : colors.edge,
        opacity: (_attributes, state, graphState) => faded(state, graphState),
        size: 0.001,
      },
    },
    settings: {
      renderLabels: true,
      labelRenderedSizeThreshold: labelPixels,
      hideEdgesOnMove: false,
      minEdgeThickness: 1,
      itemSizesReference: "positions",
      // sigma draws a node `size / zoomToSizeRatio(ratio)` pixels wide
      // here, and the camera ratio is 1 / scale: the size of a node stays
      // in units of the layout and grows with the zoom, as in the other
      // renderers.
      zoomToSizeRatioFunction: (ratio) => ratio,
      autoRescale: false,
      stagePadding: 0,
      minCameraRatio: null,
      maxCameraRatio: null,
      enableCameraRotation: false,
    },
  });

  // Without `autoRescale`, sigma maps one unit of the layout to one pixel
  // at camera ratio 1, the origin in the middle of the view, and frames
  // its camera in the view scaled into 0..1 by its longer side. The frame
  // does not follow the layout as it spreads.
  const setCamera = (camera: Camera) => {
    const side = Math.max(layer.clientWidth, layer.clientHeight) || 1;
    sigma.getCamera().setState({
      x: 0.5 + camera.x / side,
      y: 0.5 - camera.y / side,
      ratio: 1 / camera.scale,
    });
  };
  let camera = initialCamera;
  setCamera(camera);

  return {
    setPositions(next) {
      model.updateEachNodeAttributes((node, attributes) => {
        const i = Number(node);
        attributes.x = next[i * 2];
        attributes.y = -next[i * 2 + 1];
        return attributes;
      });
    },
    setCamera(next) {
      camera = next;
      setCamera(camera);
    },
    setCurrent(next) {
      if (current !== null) model.setNodeAttribute(current, "current", false);
      current = next;
      if (current !== null) model.setNodeAttribute(current, "current", true);
    },
    setHighlight(next) {
      if (highlight !== null) {
        sigma.setNodesState([...highlight.nodes].map(String), {
          isHighlighted: false,
        });
        sigma.setEdgesState(
          highlight.edges.map((edge) => edgeKeys[edge]),
          { isHighlighted: false },
        );
      }
      highlight = next;
      if (highlight !== null) {
        sigma.setNodesState([...highlight.nodes].map(String), {
          isHighlighted: true,
        });
        sigma.setEdgesState(
          highlight.edges.map((edge) => edgeKeys[edge]),
          { isHighlighted: true },
        );
      }
      sigma.setGraphState({ hasHighlighted: highlight !== null });
    },
    setColors(next) {
      colors = next;
      sigma.refresh();
    },
    resize() {
      sigma.resize();
      setCamera(camera);
    },
    destroy() {
      sigma.kill();
      layer.remove();
    },
  };
};
