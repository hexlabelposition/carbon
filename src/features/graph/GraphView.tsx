import type { NotePath, Vault } from "@carbon/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "../i18n/i18n";
import { CameraMotion } from "./camera-motion";
import { canvasRenderer } from "./canvas-renderer";
import {
  cameraToFit,
  LABEL_NODE_PIXELS,
  MIN_NODE_PIXELS,
  NODE_RADIUS,
  readGraphColors,
  type Camera,
  type GraphRenderer,
  type GraphRendererFactory,
  type NodeStyle,
} from "./graph-renderer";
import {
  groupNotes,
  MAX_NODE_SIZE,
  PLAIN,
  sizeFor,
  type ColorBy,
  type GraphDisplay,
  type Groups,
} from "./node-style";
import { GraphLegend } from "./GraphLegend";
import { GraphFilterBar } from "./GraphFilterBar";
import { NodeGrid } from "./picking";
import { sigmaRenderer } from "./sigma-renderer";
import {
  useGraphData,
  useLocalGraphData,
  type GraphDataState,
} from "./use-graph-data";
import { useGraphFilters } from "./use-graph-filters";
import {
  indexGraph,
  useGraphLayout,
  type IndexedGraph,
} from "./use-graph-layout";
import { log } from "../log/log";

/**
 * The renderer of the graph: sigma.js (ADR-030); Canvas 2D takes over
 * where WebGL 2 is missing.
 */
const RENDERERS: readonly GraphRendererFactory[] = [
  sigmaRenderer,
  canvasRenderer,
];

/** How far out the camera zooms, as a scale of the fitted graph. */
const MIN_ZOOM = 0.2;
/**
 * How far in, in CSS pixels per unit of the layout: a note is then 32
 * pixels wide, and a small graph is not blown up past that.
 */
const MAX_SCALE = 8;
/** A press that moves less than this, in pixels, is a click, not a drag. */
const CLICK_SLOP = 4;
/** How far from a note the pointer still picks it, in pixels. */
const PICK_PIXELS = 8;
/** The last moments of a drag that set the speed of a fling, in ms. */
const FLING_MS = 80;

interface GraphCanvasProps {
  data: GraphDataState;
  /** Under which the layout is kept: a graph opened again starts there. */
  layoutKey: string;
  /**
   * What the camera is fitted to, such as the note of a local graph: in
   * the same view the camera stays where it is as notes change or the
   * settings filter them; another view is fitted. `layoutKey` if not
   * given.
   */
  viewKey?: string;
  /** The note of the active pane, drawn apart from the others. */
  current: NotePath | null;
  /** Opens a note: in a new tab with Ctrl or Cmd held. */
  onOpen(path: NotePath, newTab: boolean): void;
  /** Escape was pressed in it. */
  onClose?(): void;
  /** Titles show once a note is this wide on screen, in CSS pixels. */
  labelPixels?: number;
  /**
   * How much of the shorter side of the view the graph takes up when it
   * is fitted: less leaves titles at its edge room.
   */
  fill?: number;
  /** For screen readers: what it is and how to use it. */
  label: string;
  /** What it says when the graph has no notes. */
  emptyText: string;
  /** How notes are sized and colored (C-507); all alike by default. */
  display?: GraphDisplay;
  /** Controls drawn over it, such as the depth of a local graph. */
  children?: ReactNode;
}

/**
 * Draws a graph of notes (C-503, C-504), laid out by a force layout in a
 * worker that settles in view. Drag to move, wheel to zoom, click a note
 * to open it.
 */
function GraphCanvas({
  data,
  layoutKey,
  viewKey = layoutKey,
  current,
  onOpen,
  onClose,
  labelPixels = LABEL_NODE_PIXELS,
  fill = 0.9,
  label,
  emptyText,
  display = PLAIN,
  children,
}: GraphCanvasProps) {
  const t = useT();
  const graph = useMemo(
    () => (data.status === "ready" ? indexGraph(data.graph) : null),
    [data],
  );
  const { positions, settled } = useGraphLayout(layoutKey, graph);
  const hasPositions = positions !== null;

  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<GraphRenderer | null>(null);
  const camera = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  /** The scale that shows the whole graph: zoom limits are relative to it. */
  const fitScale = useRef(1);
  /**
   * The camera follows the layout as it spreads: from when a view is
   * fitted until the layout first settles, or the user moves the camera.
   * After that, notes that come and go do not move it.
   */
  const following = useRef(true);
  /** The view the camera was last fitted or moved in. */
  const viewFor = useRef<string | null>(null);
  const grid = useRef<NodeGrid | null>(null);
  const latest = useRef<Float32Array | null>(null);
  /** The note under the pointer, by index, with the graph it is of. */
  const [hover, setHover] = useState<{
    graph: IndexedGraph;
    node: number;
  } | null>(null);
  const hovered = hover !== null && hover.graph === graph ? hover.node : null;
  /** The links of each note, by their index in `graph.edges` / 2. */
  const links = useMemo(
    () => (graph === null ? null : linksOf(graph)),
    [graph],
  );

  // The groups that get a color keep it while they stay among the
  // largest, as filters come and go: a color follows its group.
  const [slots, setSlots] = useState<{
    graph: IndexedGraph | null;
    colorBy: ColorBy;
    groups: Groups | null;
  }>({ graph: null, colorBy: "none", groups: null });
  if (slots.graph !== graph || slots.colorBy !== display.colorBy) {
    const kept = slots.colorBy === display.colorBy ? slots.groups : null;
    setSlots({
      graph,
      colorBy: display.colorBy,
      groups:
        graph === null || display.colorBy === "none"
          ? null
          : groupNotes(graph, display.colorBy, kept),
    });
  }
  const groups = slots.graph === graph ? slots.groups : null;
  const style = useMemo<NodeStyle | null>(() => {
    if (graph === null || links === null) return null;
    if (!display.sizeByLinks && groups === null) return null;
    const count = graph.titles.length;
    return {
      sizes: display.sizeByLinks
        ? Float32Array.from(links, (own) => sizeFor(own.length))
        : new Float32Array(count).fill(1),
      groups: groups?.of ?? new Int8Array(count).fill(-1),
    };
  }, [graph, links, groups, display.sizeByLinks]);
  /** The style, for the pointer to pick big notes by their edge. */
  const styleRef = useRef(style);
  /** The group under the pointer in the legend, by slot. */
  const [legendHover, setLegendHover] = useState<number | null>(null);

  // Before the renderer is made: it starts from these positions.
  useEffect(() => {
    latest.current = positions;
    if (positions === null) return;
    grid.current = new NodeGrid(positions, NODE_RADIUS * 8);
    const shown = renderer.current;
    if (shown === null) return;
    shown.setPositions(positions);
    const container = stage.current;
    if (following.current && container !== null) {
      const fitted = cameraToFit(
        positions,
        container.clientWidth,
        container.clientHeight,
        fill,
      );
      camera.current = fitted;
      fitScale.current = fitted.scale;
      shown.setCamera(fitted);
    }
  }, [positions, fill]);

  // Once the layout has settled, the view is laid out: what comes later,
  // such as other filters, leaves the camera where it is.
  const settledRef = useRef(settled);
  useEffect(() => {
    settledRef.current = settled;
    if (settled) following.current = false;
  }, [settled]);

  // One renderer per graph, made with its first positions.
  useEffect(() => {
    const container = stage.current;
    const first = latest.current;
    if (container === null || graph === null || first === null) return;
    // The same view, with notes changed or filtered: the camera stays.
    // Another view, or the first graph of one, is fitted.
    if (viewFor.current !== viewKey) {
      const fitted = cameraToFit(
        first,
        container.clientWidth,
        container.clientHeight,
        fill,
      );
      camera.current = fitted;
      fitScale.current = fitted.scale;
      // A layout kept from before is settled already: nothing to follow.
      following.current = !settledRef.current;
    }
    viewFor.current = viewKey;
    const fitted = camera.current;
    const colors = readGraphColors(document.documentElement);
    let made: GraphRenderer | null = null;
    for (const create of RENDERERS) {
      try {
        made = create(container, graph, first, fitted, colors, labelPixels);
        break;
      } catch (error) {
        container.replaceChildren();
        log.warn("A graph renderer could not start", error);
      }
    }
    renderer.current = made;
    const resize = new ResizeObserver(() => made?.resize());
    resize.observe(container);
    // The theme can change while the graph is open.
    const recolor = () =>
      made?.setColors(readGraphColors(document.documentElement));
    const themes = new MutationObserver(recolor);
    themes.observe(document.documentElement, { attributes: true });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", recolor);
    return () => {
      resize.disconnect();
      themes.disconnect();
      scheme.removeEventListener("change", recolor);
      made?.destroy();
      renderer.current = null;
      container.replaceChildren();
    };
  }, [graph, hasPositions, labelPixels, fill, viewKey]);

  useEffect(() => {
    const index = current === null ? undefined : graph?.indexOf.get(current);
    renderer.current?.setCurrent(index ?? null);
  }, [current, graph, hasPositions]);

  useEffect(() => {
    styleRef.current = style;
    renderer.current?.setStyle(style);
  }, [style, hasPositions]);

  // The note under the pointer, its neighbors and its links stand out; or
  // the notes of the group under the pointer in the legend.
  useEffect(() => {
    if (graph === null || links === null) return;
    if (hovered === null && legendHover !== null && groups !== null) {
      const nodes = new Set<number>();
      groups.of.forEach((slot, i) => {
        if (slot === legendHover) nodes.add(i);
      });
      const edges: number[] = [];
      for (let edge = 0; edge < graph.edges.length / 2; edge++) {
        const a = graph.edges[edge * 2];
        const b = graph.edges[edge * 2 + 1];
        if (nodes.has(a) && nodes.has(b)) edges.push(edge);
      }
      renderer.current?.setHighlight({ node: null, nodes, edges });
      return;
    }
    if (hovered === null) {
      renderer.current?.setHighlight(null);
      return;
    }
    const edges = links[hovered];
    const nodes = new Set([hovered]);
    for (const edge of edges) {
      nodes.add(graph.edges[edge * 2]);
      nodes.add(graph.edges[edge * 2 + 1]);
    }
    renderer.current?.setHighlight({ node: hovered, nodes, edges });
  }, [graph, links, hovered, legendHover, groups, hasPositions]);

  // Drag to move, wheel to zoom, click to open, hover to highlight. The
  // camera eases as it zooms and pans, and glides on after a fling.
  useEffect(() => {
    const container = stage.current;
    if (container === null || graph === null) return;
    let press: {
      x: number;
      y: number;
      camera: Camera;
      dragged: boolean;
      /** Where the pointer was lately, for the speed of a fling. */
      trail: { x: number; y: number; time: number }[];
    } | null = null;
    /** Where the pointer is over the view, or `null` outside it. */
    let pointer: { x: number; y: number } | null = null;
    /** The note under the pointer as last told to React. */
    let hoverIndex: number | null = null;
    let pickFrame = 0;

    const point = (event: { clientX: number; clientY: number }) => {
      const box = container.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    /** The note under a point of the view, by index, or `null`. */
    const pick = (x: number, y: number) => {
      const { x: cx, y: cy, scale } = camera.current;
      const worldX = cx + (x - container.clientWidth / 2) / scale;
      const worldY = cy + (y - container.clientHeight / 2) / scale;
      const sizes = styleRef.current?.sizes;
      const smallest = MIN_NODE_PIXELS / scale;
      const radiusOf = (i: number) =>
        Math.max(NODE_RADIUS * (sizes?.[i] ?? 1), smallest);
      const pad = PICK_PIXELS / scale;
      const reach = Math.max(NODE_RADIUS * MAX_NODE_SIZE, smallest) + pad;
      return (
        grid.current?.nearest(worldX, worldY, reach, pad, radiusOf) ?? null
      );
    };
    const setHovered = (index: number | null) => {
      if (index === hoverIndex) return;
      hoverIndex = index;
      container.style.cursor = index === null ? "" : "pointer";
      setHover(index === null ? null : { graph, node: index });
    };
    // Once a frame at most: a mouse can report far more often than that.
    const pickSoon = () => {
      if (pickFrame !== 0) return;
      pickFrame = requestAnimationFrame(() => {
        pickFrame = 0;
        if (press?.dragged === true) return;
        setHovered(pointer === null ? null : pick(pointer.x, pointer.y));
      });
    };

    const motion = new CameraMotion({
      get: () => camera.current,
      apply: (next) => {
        camera.current = next;
        following.current = false;
        renderer.current?.setCamera(next);
      },
      view: () => ({
        width: container.clientWidth,
        height: container.clientHeight,
      }),
      limits: () => ({
        min: Math.min(fitScale.current * MIN_ZOOM, MAX_SCALE),
        max: MAX_SCALE,
      }),
      // Notes move under a still pointer as the camera moves.
      onFrame: pickSoon,
    });

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      motion.stop();
      const at = point(event);
      press = {
        ...at,
        camera: camera.current,
        dragged: false,
        trail: [{ ...at, time: event.timeStamp }],
      };
      container.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const at = point(event);
      pointer = at;
      if (press === null) {
        pickSoon();
        return;
      }
      press.trail.push({ ...at, time: event.timeStamp });
      while (
        press.trail.length > 2 &&
        event.timeStamp - press.trail[0].time > FLING_MS
      ) {
        press.trail.shift();
      }
      const dx = at.x - press.x;
      const dy = at.y - press.y;
      if (!press.dragged && Math.hypot(dx, dy) < CLICK_SLOP) return;
      if (!press.dragged) {
        press.dragged = true;
        setHovered(null);
        container.style.cursor = "grabbing";
      }
      const { scale } = press.camera;
      motion.jumpTo({
        ...press.camera,
        x: press.camera.x - dx / scale,
        y: press.camera.y - dy / scale,
      });
    };
    const up = (event: PointerEvent) => {
      if (press === null) return;
      const { dragged, trail } = press;
      press = null;
      container.style.cursor = "";
      if (dragged) {
        // The speed of the last moments of the drag carries it on; a
        // pointer held still before it was let go does not.
        const first = trail[0];
        const last = trail[trail.length - 1];
        const time = last.time - first.time;
        if (time > 0 && event.timeStamp - last.time < FLING_MS / 2) {
          motion.glide((last.x - first.x) / time, (last.y - first.y) / time);
        }
        pickSoon();
        return;
      }
      const at = point(event);
      const index = pick(at.x, at.y);
      if (index !== null)
        onOpen(graph.paths[index], event.ctrlKey || event.metaKey);
    };
    const leave = () => {
      pointer = null;
      setHovered(null);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = point(event);
      // Pixels for a mouse, lines for some, pages rarely.
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 400 : 1);
      motion.zoomAt(at.x, at.y, Math.exp(-delta / 400));
    };
    const key = (event: KeyboardEvent) => {
      const middleX = container.clientWidth / 2;
      const middleY = container.clientHeight / 2;
      const step = 80 / camera.current.scale;
      switch (event.key) {
        case "+":
        case "=":
          motion.zoomAt(middleX, middleY, 1.4);
          break;
        case "-":
          motion.zoomAt(middleX, middleY, 1 / 1.4);
          break;
        case "ArrowLeft":
          motion.panBy(-step, 0);
          break;
        case "ArrowRight":
          motion.panBy(step, 0);
          break;
        case "ArrowUp":
          motion.panBy(0, -step);
          break;
        case "ArrowDown":
          motion.panBy(0, step);
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    // A press on the graph starts no selection: the stage is `select-none`,
    // yet WebKit starts one from the nearest text it can select, the note
    // beside the panel, and drags it along with the pointer. The press does
    // not focus the stage either then, so it is focused here, for the keys.
    const noSelect = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      container.focus({ preventScroll: true });
    };
    container.addEventListener("mousedown", noSelect);
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", up);
    container.addEventListener("pointerleave", leave);
    container.addEventListener("wheel", wheel, { passive: false });
    container.addEventListener("keydown", key);
    return () => {
      motion.stop();
      cancelAnimationFrame(pickFrame);
      container.removeEventListener("mousedown", noSelect);
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", up);
      container.removeEventListener("pointerleave", leave);
      container.removeEventListener("wheel", wheel);
      container.removeEventListener("keydown", key);
    };
  }, [graph, onOpen]);

  // Escape closes the graph wherever the focus is inside it.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" || onClose === undefined) return;
    event.preventDefault();
    onClose();
  };

  const empty = data.status === "ready" && data.graph.nodes.length === 0;
  return (
    <div
      // On the background of what holds it: the note area or a panel.
      className="relative h-full w-full overflow-hidden"
      onKeyDown={onKeyDown}
    >
      <div
        ref={stage}
        tabIndex={0}
        role="application"
        aria-label={label}
        aria-busy={!settled}
        className="absolute inset-0 touch-none outline-none select-none"
      />
      {/* The renderer shows the title by the note; this says it aloud. */}
      <div className="sr-only" aria-live="polite" data-hovered>
        {hovered !== null && graph !== null ? graph.titles[hovered] : ""}
      </div>
      {/* Its first line level with the middle of the settings button. */}
      <div className="pointer-events-none absolute top-3 left-4 flex flex-col gap-1 py-1.5 text-small text-faint">
        {data.status === "loading" && <p>{t("graph.loading")}</p>}
        {data.status === "error" && (
          <p className="text-danger">
            {t("graph.failed", { reason: data.message })}
          </p>
        )}
        {empty && <p>{emptyText}</p>}
        {data.status === "ready" && data.partial && <p>{t("graph.partial")}</p>}
        {data.status === "ready" && !empty && (
          <p>
            {t("graph.count", { count: data.graph.nodes.length })}
            {!settled && ` · ${t("graph.settling")}`}
          </p>
        )}
      </div>
      {groups !== null && groups.legend.length > 0 && (
        <GraphLegend
          groups={groups}
          onHover={setLegendHover}
          other={t("graph.otherGroup")}
          label={t("graph.legend")}
        />
      )}
      {children}
    </div>
  );
}

interface GraphViewProps {
  vault: Vault;
  /** The note of the active pane, drawn apart from the others. */
  current: NotePath | null;
  /** Opens a note: in a new tab with Ctrl or Cmd held. */
  onOpen(path: NotePath, newTab: boolean): void;
  onClose(): void;
}

/**
 * The graph of the vault (C-503): every note and the links between them.
 * Escape closes it.
 */
export function GraphView({ vault, current, onOpen, onClose }: GraphViewProps) {
  const t = useT();
  const { filters, change } = useGraphFilters();
  const data = useGraphData(vault, true, filters);
  const filtered =
    filters.tag.trim() !== "" || !filters.orphans || filters.missing;
  // A note that links miss is made when it is clicked, as by a link.
  const open = useCallback(
    (path: NotePath, newTab: boolean) => {
      const node =
        data.status === "ready"
          ? data.graph.nodes.find((n) => n.path === path)
          : undefined;
      if (node?.missing !== true) {
        onOpen(path, newTab);
        return;
      }
      vault.notes.create(path).then(
        () => onOpen(path, newTab),
        // Made meanwhile, by another program or a link: open it all the same.
        () => onOpen(path, newTab),
      );
    },
    [data, vault, onOpen],
  );
  return (
    <GraphCanvas
      data={data}
      layoutKey={vault.root}
      current={current}
      onOpen={open}
      onClose={onClose}
      label={t("graph.label")}
      emptyText={t(filtered ? "graph.noMatch" : "graph.empty")}
      display={filters}
    >
      <GraphFilterBar vault={vault} filters={filters} onChange={change} />
    </GraphCanvas>
  );
}

/** The depths a local graph can have, in links from its note. */
const DEPTHS = [1, 2, 3] as const;
const DEPTH_KEY = "carbon.graph.localDepth";

interface LocalGraphViewProps {
  vault: Vault;
  /** The note the graph is around. */
  path: NotePath;
  onOpen(path: NotePath, newTab: boolean): void;
}

/**
 * The graph around one note (C-504): the notes at most a few links from
 * it, whichever way the links go, and the links between them. It follows
 * the note as it changes and as another note is opened. The depth is
 * remembered between app starts.
 */
export function LocalGraphView({ vault, path, onOpen }: LocalGraphViewProps) {
  const t = useT();
  const [depth, setDepth] = useState(loadDepth);
  useEffect(() => {
    try {
      localStorage.setItem(DEPTH_KEY, String(depth));
    } catch {
      // Without storage it works, it only forgets the depth.
    }
  }, [depth]);
  const data = useLocalGraphData(vault, path, depth);
  return (
    <GraphCanvas
      data={data}
      // Apart from the graph of the vault, whose layout is far wider.
      layoutKey={`${vault.root}#local`}
      // Another depth keeps the camera, as the settings of the graph do.
      viewKey={path}
      current={path}
      onOpen={onOpen}
      // A local graph has few notes: their titles always show.
      labelPixels={0}
      fill={0.7}
      label={t("graph.localLabel")}
      emptyText={t("graph.notIndexed")}
    >
      <div
        role="radiogroup"
        aria-label={t("graph.depth")}
        className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-md border border-line bg-panel p-0.5 text-small"
      >
        <span className="px-1 text-faint">{t("graph.depth")}</span>
        {DEPTHS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={depth === value}
            className={`h-5 min-w-5 rounded px-1 outline-none focus-visible:ring-1 focus-visible:ring-line-strong ${
              depth === value
                ? "bg-selected text-fg"
                : "text-muted hover:bg-raise hover:text-fg"
            }`}
            onClick={() => setDepth(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </GraphCanvas>
  );
}

function loadDepth(): number {
  try {
    const saved = Number(localStorage.getItem(DEPTH_KEY));
    return DEPTHS.find((depth) => depth === saved) ?? 1;
  } catch {
    return 1;
  }
}

/** The links of each note of `graph`, by their index in its edges / 2. */
function linksOf(graph: IndexedGraph): number[][] {
  const links: number[][] = graph.titles.map(() => []);
  for (let edge = 0; edge < graph.edges.length / 2; edge++) {
    links[graph.edges[edge * 2]].push(edge);
    links[graph.edges[edge * 2 + 1]].push(edge);
  }
  return links;
}
