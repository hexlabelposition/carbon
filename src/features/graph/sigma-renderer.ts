import Graph from "graphology";
import type { Attributes } from "graphology-types";
import Sigma from "sigma";
import {
  FADE_MS,
  FADED,
  NODE_RADIUS,
  type Camera,
  type GraphRendererFactory,
  type Highlight,
  type NodeStyle,
} from "./graph-renderer";
import { GraphLabels } from "./graph-labels";

/** What the styles read besides sigma's own state of the graph. */
interface ExtraGraphState {
  /** How far the highlight has faded in, 0 to 1. */
  fade?: number;
}

interface NodeAttributes {
  x: number;
  y: number;
  label: string;
  current: boolean;
  missing: boolean;
  /** Times `NODE_RADIUS`. */
  size: number;
  /** Index into `colors.groups`; -1 none. */
  group: number;
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
      missing: graph.missing[i] === 1,
      size: 1,
      group: -1,
    });
  });
  const { edges } = graph;
  /** The keys graphology gave the links, by their index. */
  const edgeKeys: string[] = [];
  for (let i = 0; i < edges.length; i += 2) {
    edgeKeys.push(model.addEdge(edges[i], edges[i + 1]));
  }
  /** What the pointer highlights now; `null` while nothing is. */
  let highlight: Highlight | null = null;
  /**
   * What sigma has marked as highlighted: the last highlight, kept while
   * it fades out after the pointer left it.
   */
  let marked: Highlight | null = null;
  /** How far the highlight has faded in, 0 to 1. */
  let fade = 0;
  let fadeFrame = 0;
  let fadeLast = 0;
  /** Faded while something is highlighted and it is not part of it. */
  const faded = (
    state: { isHighlighted: boolean },
    graphState: { hasHighlighted: boolean; fade?: number },
  ) =>
    graphState.hasHighlighted && !state.isHighlighted
      ? 1 - (1 - FADED) * (graphState.fade ?? 0)
      : 1;

  const mark = (next: Highlight | null, on: boolean) => {
    if (next === null) return;
    sigma.setNodesState([...next.nodes].map(String), { isHighlighted: on });
    sigma.setEdgesState(
      next.edges.map((edge) => edgeKeys[edge]),
      { isHighlighted: on },
    );
  };

  // The highlight fades in and out over a few frames, not at once.
  const fadeStep = (time: number) => {
    fadeFrame = 0;
    const dt = fadeLast === 0 ? 16 : Math.min(time - fadeLast, 50);
    fadeLast = time;
    const goal = highlight === null ? 0 : 1;
    const change = dt / FADE_MS;
    fade =
      goal > fade
        ? Math.min(goal, fade + change)
        : Math.max(goal, fade - change);
    if (fade === 0 && highlight === null && marked !== null) {
      mark(marked, false);
      marked = null;
      sigma.setGraphState({ hasHighlighted: false });
    }
    // The styles that read the graph state are worked out again.
    sigma.setGraphState({ fade });
    if (fade !== goal) fadeFrame = requestAnimationFrame(fadeStep);
    else fadeLast = 0;
  };
  const fadeSoon = () => {
    if (fadeFrame === 0) fadeFrame = requestAnimationFrame(fadeStep);
  };

  const sigma = new Sigma<
    NodeAttributes,
    Attributes,
    Attributes,
    object,
    object,
    ExtraGraphState
  >(model, layer, {
    styles: {
      nodes: {
        color: (attributes) =>
          attributes.current
            ? colors.current
            : attributes.missing
              ? colors.missing
              : attributes.group < 0
                ? colors.node
                : (colors.groups[attributes.group] ?? colors.node),
        size: (attributes) =>
          NODE_RADIUS * attributes.size * (attributes.current ? 1.5 : 1),
        opacity: (_attributes, state, graphState) => faded(state, graphState),
        // Stated with the rest: a node style of its own replaces sigma's.
        // The titles are drawn by `GraphLabels`, which wraps them.
        label: { attribute: "label" },
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
      renderLabels: false,
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
  sigma.setGraphState({ fade });

  let points = positions;
  let nodeStyle: NodeStyle | null = null;
  const labels = new GraphLabels(layer);
  // After each frame of sigma: the titles follow the notes at once.
  sigma.on("afterRender", () =>
    labels.draw({
      titles: graph.titles,
      positions: points,
      camera,
      width: layer.clientWidth,
      height: layer.clientHeight,
      style: nodeStyle,
      current,
      colors,
      labelPixels,
      highlight: marked,
      fade,
      faded: FADED,
    }),
  );

  return {
    setPositions(next) {
      points = next;
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
    setStyle(style) {
      nodeStyle = style;
      model.updateEachNodeAttributes((node, attributes) => {
        const i = Number(node);
        attributes.size = style?.sizes[i] ?? 1;
        attributes.group = style?.groups[i] ?? -1;
        return attributes;
      });
    },
    setHighlight(next) {
      highlight = next;
      // From one note to the next the fade stays: only what is marked
      // changes. Off, the last highlight stays marked until it faded out.
      if (next !== null) {
        mark(marked, false);
        marked = next;
        mark(marked, true);
        sigma.setGraphState({ hasHighlighted: true });
      }
      fadeSoon();
    },
    setColors(next) {
      colors = next;
      sigma.refresh();
    },
    resize() {
      sigma.resize();
      setCamera(camera);
      // sigma draws anew only when the window resizes, and maps the layout
      // to pixels by the size of the view it had when it last processed the
      // notes, not by the size it is given here. Without a full refresh a
      // side panel made wider shows the old picture stretched, and one
      // dragged narrower shrinks the links under titles that stay put,
      // until something else makes sigma process the notes again. Done at
      // once, before the frame is painted (the resize comes from a
      // `ResizeObserver`): the graph keeps its scale, the view only shows
      // more or less of it.
      sigma.refresh();
    },
    destroy() {
      cancelAnimationFrame(fadeFrame);
      labels.destroy();
      sigma.kill();
      layer.remove();
    },
  };
};
