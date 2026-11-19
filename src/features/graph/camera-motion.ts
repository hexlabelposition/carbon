import type { Camera } from "./graph-renderer";

/**
 * How fast the camera reaches where it is sent, in milliseconds: about a
 * third of the way is left after this. Short enough to feel at once, long
 * enough that a wheel's steps run into one move.
 */
const EASE_MS = 70;
/** How fast a fling slows down, in milliseconds, as a scroll on a phone. */
const GLIDE_MS = 325;
/** A fling slower than this, in pixels per millisecond, does not glide. */
const MIN_GLIDE_SPEED = 0.05;
/** A frame longer than this, in ms, counts as this: a hiccup is no leap. */
const MAX_FRAME_MS = 50;

/** A point of the view that stays on one point of the layout as it zooms. */
interface Anchor {
  /** In CSS pixels from the top left of the view. */
  screenX: number;
  screenY: number;
  /** In units of the layout. */
  worldX: number;
  worldY: number;
}

export interface CameraMotionOptions {
  /** The camera now: the motion starts from it each time. */
  get(): Camera;
  /** Shows a camera: once for each frame of a move. */
  apply(camera: Camera): void;
  /** The size of the view, in CSS pixels. */
  view(): { width: number; height: number };
  /** How far the camera may zoom, as `scale`. */
  limits(): { min: number; max: number };
  /** Called after each frame of a move, as for what is under the pointer. */
  onFrame?(): void;
}

/**
 * Moves the camera of the graph smoothly: a zoom eases to its scale with
 * the point under the pointer kept in place, a pan eases to its place, and
 * a drag let go with speed glides on and slows down. One animation frame
 * at a time; nothing runs while the camera is still.
 */
export class CameraMotion {
  private target: Camera | null = null;
  private anchor: Anchor | null = null;
  /** The speed of a glide, in CSS pixels per millisecond. */
  private speed: { x: number; y: number } | null = null;
  private frame = 0;
  private last = 0;

  constructor(private readonly options: CameraMotionOptions) {}

  /** Zooms by `factor` about a point of the view. */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    this.speed = null;
    const now = this.options.get();
    const from = this.target ?? now;
    const { min, max } = this.options.limits();
    const scale = Math.max(min, Math.min(max, from.scale * factor));
    const { width, height } = this.options.view();
    // The point of the layout under the pointer, as the camera is now.
    this.anchor = {
      screenX,
      screenY,
      worldX: now.x + (screenX - width / 2) / now.scale,
      worldY: now.y + (screenY - height / 2) / now.scale,
    };
    this.target = this.anchored(scale);
    this.run();
  }

  /** Moves by so many units of the layout, eased. */
  panBy(dx: number, dy: number): void {
    this.speed = null;
    this.anchor = null;
    const from = this.target ?? this.options.get();
    this.target = { ...from, x: from.x + dx, y: from.y + dy };
    this.run();
  }

  /** Shows `camera` now, as a drag does: what was easing stops. */
  jumpTo(camera: Camera): void {
    this.stop();
    this.options.apply(camera);
  }

  /** Lets the camera glide on at a speed in CSS pixels per millisecond. */
  glide(x: number, y: number): void {
    this.target = null;
    this.anchor = null;
    if (Math.hypot(x, y) < MIN_GLIDE_SPEED) return;
    this.speed = { x, y };
    this.run();
  }

  /** Stops where the camera is now. */
  stop(): void {
    this.target = null;
    this.anchor = null;
    this.speed = null;
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.last = 0;
  }

  /** Whether the camera is moving by itself. */
  get moving(): boolean {
    return this.frame !== 0;
  }

  /** The camera of `scale` that keeps the anchor where it is on screen. */
  private anchored(scale: number): Camera {
    const anchor = this.anchor;
    const now = this.options.get();
    if (anchor === null) return { ...now, scale };
    const { width, height } = this.options.view();
    return {
      x: anchor.worldX - (anchor.screenX - width / 2) / scale,
      y: anchor.worldY - (anchor.screenY - height / 2) / scale,
      scale,
    };
  }

  private run() {
    if (this.frame === 0) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (time: number) => {
    this.frame = 0;
    const dt = this.last === 0 ? 16 : Math.min(time - this.last, MAX_FRAME_MS);
    this.last = time;
    const now = this.options.get();
    let next = now;
    let done = true;

    if (this.speed !== null) {
      next = {
        ...now,
        x: now.x - (this.speed.x * dt) / now.scale,
        y: now.y - (this.speed.y * dt) / now.scale,
      };
      const slow = Math.exp(-dt / GLIDE_MS);
      this.speed = { x: this.speed.x * slow, y: this.speed.y * slow };
      if (Math.hypot(this.speed.x, this.speed.y) < MIN_GLIDE_SPEED / 4) {
        this.speed = null;
      } else {
        done = false;
      }
    } else if (this.target !== null) {
      const target = this.target;
      const step = 1 - Math.exp(-dt / EASE_MS);
      // The scale eases on a log scale: each step zooms by the same factor.
      const scale = Math.exp(
        Math.log(now.scale) +
          (Math.log(target.scale) - Math.log(now.scale)) * step,
      );
      next =
        this.anchor !== null
          ? this.anchored(scale)
          : {
              x: now.x + (target.x - now.x) * step,
              y: now.y + (target.y - now.y) * step,
              scale,
            };
      // Close enough once less than a tenth of a pixel is left to go.
      const left =
        Math.abs(Math.log(target.scale / next.scale)) * 1000 +
        Math.hypot(target.x - next.x, target.y - next.y) * next.scale;
      if (left < 0.1) {
        next = target;
        this.target = null;
        this.anchor = null;
      } else {
        done = false;
      }
    }

    this.options.apply(next);
    this.options.onFrame?.();
    if (done) this.last = 0;
    else this.run();
  };
}
