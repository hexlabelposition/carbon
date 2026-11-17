import type { NoteGraph } from "@carbon/core";
import { useEffect, useRef, useState } from "react";
import {
  fromNoteGraph,
  syntheticGraph,
  type BenchGraph,
  type Positions,
} from "./graph-data";
import { layOut } from "./layout";
import { measureFrames } from "./measure";
import { canvasRenderer } from "./renderers/canvas";
import { pixiRenderer } from "./renderers/pixi";
import {
  fit,
  type Renderer,
  type RendererFactory,
  type View,
} from "./renderers/renderer";
import { sigmaRenderer } from "./renderers/sigma";

const RENDERERS: Record<string, RendererFactory> = {
  "Canvas 2D": canvasRenderer,
  "Pixi.js": pixiRenderer,
  "sigma.js": sigmaRenderer,
};
const SYNTHETIC_NOTES = 10_000;
const LAYOUT_TICKS = 300;
const RUN_MS = 8000;

/**
 * Temporary M5 measurement (C-502): the candidate graph renderers draw
 * the same laid out graph of 10,000 notes while the camera pans and
 * zooms, and each is timed. Afterwards the graph can be explored with
 * any of them: drag to pan, wheel to zoom. Remove once C-502 is decided.
 */
export function GraphBench({
  loadVault,
}: {
  loadVault?: () => Promise<NoteGraph>;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const active = useRef<{ renderer: Renderer; view: View } | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const [done, setDone] = useState(false);
  const [data, setData] = useState<{
    graph: BenchGraph;
    positions: Positions;
  } | null>(null);

  useEffect(() => () => active.current?.renderer.destroy(), []);

  async function show(name: string, graph: BenchGraph, positions: Positions) {
    const container = stage.current;
    if (container === null) throw new Error("No stage");
    active.current?.renderer.destroy();
    active.current = null;
    container.replaceChildren();
    const started = performance.now();
    const renderer = await RENDERERS[name](container, graph, positions);
    const base = fit(positions, container.clientWidth, container.clientHeight);
    const view = { x: base.x, y: base.y, zoom: 1 };
    renderer.setView(view);
    // The first frame on screen ends the setup.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    active.current = { renderer, view };
    return { renderer, base, setupMs: performance.now() - started };
  }

  async function run(source: "synthetic" | "vault") {
    const lines: string[] = [];
    const print = (line = "") => {
      lines.push(line);
      setLog(lines.join("\n"));
    };
    setRunning(true);
    setDone(false);
    try {
      let graph: BenchGraph;
      if (source === "vault" && loadVault !== undefined) {
        const started = performance.now();
        graph = fromNoteGraph(await loadVault());
        print(
          `vault.graph.global(): ${(performance.now() - started).toFixed(0)} ms`,
        );
      } else {
        graph = syntheticGraph(SYNTHETIC_NOTES);
      }
      print(`${graph.titles.length} nodes, ${graph.edges.length / 2} edges`);
      const { positions, ms } = await layOut(
        graph,
        LAYOUT_TICKS,
        (tick, total) =>
          setLog([...lines, `layout: tick ${tick} of ${total}`].join("\n")),
      );
      print(
        `d3-force layout in a worker, ${LAYOUT_TICKS} ticks: ${(ms / 1000).toFixed(1)} s`,
      );
      setData({ graph, positions });
      print(`user agent: ${navigator.userAgent}`);
      print(`WebGL: ${webGlRenderer()}`);
      print(
        `screen: ${window.devicePixelRatio}x pixel ratio, stage ${stage.current?.clientWidth}x${stage.current?.clientHeight}`,
      );
      print();
      print(
        "renderer        setup     fps   frame p50   frame p95   worst frame   heap",
      );
      for (const name of Object.keys(RENDERERS)) {
        try {
          const { renderer, base, setupMs } = await show(
            name,
            graph,
            positions,
          );
          const frames = await measureFrames(renderer, base, base.span, RUN_MS);
          const memory = (
            performance as { memory?: { usedJSHeapSize: number } }
          ).memory;
          const heap =
            memory === undefined
              ? "-"
              : `${(memory.usedJSHeapSize / 1048576).toFixed(0)} MB`;
          print(
            `${name.padEnd(12)} ${`${setupMs.toFixed(0)} ms`.padStart(8)} ${frames.fps.toFixed(1).padStart(7)} ` +
              `${`${frames.p50.toFixed(1)} ms`.padStart(11)} ${`${frames.p95.toFixed(1)} ms`.padStart(11)} ` +
              `${`${frames.worst.toFixed(0)} ms`.padStart(13)} ${heap.padStart(6)}`,
          );
        } catch (error) {
          print(
            `${name.padEnd(12)} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      setDone(true);
    } catch (error) {
      print(
        `Failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setRunning(false);
    }
  }

  function explore(event: React.MouseEvent<HTMLButtonElement>) {
    const name = event.currentTarget.dataset.renderer;
    if (data === null || name === undefined) return;
    void show(name, data.graph, data.positions);
  }

  // Drag to pan, wheel to zoom, whichever renderer is shown.
  useEffect(() => {
    const container = stage.current;
    if (container === null) return;
    let dragging: { x: number; y: number } | null = null;
    const scale = () => {
      if (data === null || active.current === null) return null;
      return (
        fit(data.positions, container.clientWidth, container.clientHeight)
          .scale * active.current.view.zoom
      );
    };
    const down = (event: PointerEvent) => {
      dragging = { x: event.clientX, y: event.clientY };
      container.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const current = active.current;
      const s = scale();
      if (dragging === null || current === null || s === null) return;
      current.view = {
        ...current.view,
        x: current.view.x - (event.clientX - dragging.x) / s,
        y: current.view.y - (event.clientY - dragging.y) / s,
      };
      dragging = { x: event.clientX, y: event.clientY };
      current.renderer.setView(current.view);
    };
    const up = () => {
      dragging = null;
    };
    const wheel = (event: WheelEvent) => {
      const current = active.current;
      if (current === null) return;
      event.preventDefault();
      const zoom = Math.min(
        64,
        Math.max(0.25, current.view.zoom * Math.exp(-event.deltaY / 500)),
      );
      current.view = { ...current.view, zoom };
      current.renderer.setView(current.view);
    };
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("wheel", wheel, { passive: false });
    return () => {
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("wheel", wheel);
    };
  }, [data]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Graph renderers (C-502)</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-line bg-raise px-3 py-1 disabled:opacity-50"
          disabled={running}
          onClick={() => void run("synthetic")}
        >
          Run on 10,000 random notes
        </button>
        {loadVault !== undefined && (
          <button
            type="button"
            className="rounded-md border border-line bg-raise px-3 py-1 disabled:opacity-50"
            disabled={running}
            onClick={() => void run("vault")}
          >
            Run on the open vault
          </button>
        )}
        {data !== null &&
          !running &&
          Object.keys(RENDERERS).map((name) => (
            <button
              key={name}
              type="button"
              className="rounded-md border border-line px-3 py-1"
              data-renderer={name}
              onClick={explore}
            >
              Explore with {name}
            </button>
          ))}
      </div>
      <div
        ref={stage}
        className="h-120 w-full touch-none overflow-hidden rounded-md border border-line bg-bg"
      />
      {log !== "" && (
        <pre
          data-done={done}
          className="overflow-x-auto rounded-md bg-panel p-3 font-mono text-small"
        >
          {log}
        </pre>
      )}
    </section>
  );
}

/**
 * The GPU that WebGL draws with, to tell hardware rendering from a
 * software fallback such as SwiftShader or llvmpipe.
 */
function webGlRenderer(): string {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (gl === null) return "no WebGL 2";
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = gl.getParameter(
    info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL,
  );
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return String(name);
}
