import type { Renderer, View } from "./renderers/renderer";

/** How smoothly a renderer drew while the camera moved. */
export interface FrameStats {
  frames: number;
  /** Frames drawn per second. */
  fps: number;
  /** Time between frames, median and 95th percentile, ms. */
  p50: number;
  p95: number;
  /** The longest time between two frames, ms. */
  worst: number;
}

/**
 * Where the camera is at `t`, 0 to 1 over a run: it pans in a loop
 * around the middle of the graph while zooming from the whole graph to
 * 8 times closer and back, as a person exploring it would.
 */
export function cameraAt(
  t: number,
  middle: { x: number; y: number },
  span: number,
): View {
  const angle = t * Math.PI * 2;
  return {
    x: middle.x + Math.sin(angle * 2) * span * 0.2,
    y: middle.y + Math.cos(angle) * span * 0.2,
    zoom: Math.pow(8, (1 - Math.cos(angle)) / 2),
  };
}

/**
 * Moves the camera of `renderer` along `cameraAt` for `durationMs`, one
 * step per animation frame, and times the frames.
 */
export function measureFrames(
  renderer: Renderer,
  middle: { x: number; y: number },
  span: number,
  durationMs: number,
): Promise<FrameStats> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let start = -1;
    let last = -1;
    const step = (now: number) => {
      if (start < 0) start = now;
      else gaps.push(now - last);
      last = now;
      const t = (now - start) / durationMs;
      if (t >= 1) {
        resolve(stats(gaps, now - start));
        return;
      }
      renderer.setView(cameraAt(t, middle, span));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function stats(gaps: number[], ms: number): FrameStats {
  const sorted = [...gaps].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    frames: gaps.length,
    fps: (gaps.length / ms) * 1000,
    p50: at(0.5),
    p95: at(0.95),
    worst: sorted[sorted.length - 1] ?? 0,
  };
}
