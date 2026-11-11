import type { NotePath } from "../types";
import { WriteConflictError, type Notes } from "./notes";

/** Where the text in the editor stands compared to the note on disk. */
export type SaveState =
  /** The disk holds what the editor holds. */
  | { status: "saved" }
  /** There are edits that are waiting to be written or being written. */
  | { status: "unsaved" }
  /**
   * The note changed on disk since the editor read it. Nothing is written
   * until that is resolved with `keepMine` or `useDisk`, so neither
   * version is lost.
   */
  | { status: "conflict" }
  /** The last write failed. The next edit or `flush` tries again. */
  | { status: "failed"; message: string };

export interface AutosaveOptions {
  notes: Pick<Notes, "write">;
  path: NotePath;
  /** `contentHash` of the text the editor started from. */
  baseHash: string;
  /** How long typing must pause before the note is written. */
  delayMs?: number;
  /** The longest the first unsaved edit waits while typing goes on. */
  maxDelayMs?: number;
  /** Called whenever the state changes. */
  onState?: (state: SaveState) => void;
}

const DEFAULT_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 5000;

/**
 * Saves one note while it is edited (ARCHITECTURE.md, section 8, "Save
 * flow"). Give it the text after every edit; it writes when typing pauses,
 * one write at a time, each based on the hash the previous one returned.
 */
export class Autosave {
  private readonly notes: Pick<Notes, "write">;
  private readonly path: NotePath;
  private readonly delayMs: number;
  private readonly maxDelayMs: number;
  private onState: ((state: SaveState) => void) | undefined;

  private base: string | null;
  /** The newest text that is not written yet. */
  private pending: string | null = null;
  private pause: ReturnType<typeof setTimeout> | undefined;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private current: SaveState = { status: "saved" };
  private closed = false;

  constructor(options: AutosaveOptions) {
    this.notes = options.notes;
    this.path = options.path;
    this.base = options.baseHash;
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.onState = options.onState;
  }

  get state(): SaveState {
    return this.current;
  }

  /** The editor now holds `text`. */
  edit(text: string): void {
    if (this.closed) return;
    this.pending = text;
    // A conflict stays until it is resolved; the edit is kept for then.
    if (this.current.status === "conflict") return;
    this.set({ status: "unsaved" });
    clearTimeout(this.pause);
    this.pause = setTimeout(() => void this.flush(), this.delayMs);
    if (this.deadline === undefined) {
      this.deadline = setTimeout(() => void this.flush(), this.maxDelayMs);
    }
  }

  /**
   * Writes what is unsaved now, without waiting for a pause. Resolves when
   * there is nothing left to write or writing is not possible; it never
   * rejects, `state` tells how it went.
   */
  flush(): Promise<void> {
    clearTimeout(this.pause);
    clearTimeout(this.deadline);
    this.deadline = undefined;
    this.running ??= this.writePending().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /**
   * Resolves a conflict in favor of the editor: its text replaces the
   * version on disk. `diskHash` is the `contentHash` of that version as the
   * user saw it, or `null` if the note was deleted. If the disk changes yet
   * again before the write, that is a new conflict.
   */
  keepMine(diskHash: string | null): Promise<void> {
    this.base = diskHash;
    if (this.current.status === "conflict") {
      this.set({ status: this.pending === null ? "saved" : "unsaved" });
    }
    return this.flush();
  }

  /**
   * The editor now shows the version on disk, whose `contentHash` is
   * `diskHash`: unsaved edits are dropped. Resolves a conflict in favor of
   * the disk, and is also how a note that changed on disk is reloaded.
   */
  useDisk(diskHash: string): void {
    clearTimeout(this.pause);
    clearTimeout(this.deadline);
    this.deadline = undefined;
    this.pending = null;
    this.base = diskHash;
    this.set({ status: "saved" });
  }

  /**
   * Writes what is unsaved and stops: later edits are ignored and the state
   * is no longer reported. Call it when the editor goes away.
   */
  close(): Promise<void> {
    const done = this.flush();
    this.closed = true;
    this.onState = undefined;
    return done;
  }

  private async writePending(): Promise<void> {
    // Edits made during a write are written by the next round.
    while (this.pending !== null && this.current.status !== "conflict") {
      const text = this.pending;
      this.pending = null;
      try {
        this.base = await this.notes.write(this.path, text, this.base);
      } catch (reason) {
        // Still unsaved: keep it, unless a newer text arrived meanwhile.
        this.pending ??= text;
        if (reason instanceof WriteConflictError) {
          this.set({ status: "conflict" });
        } else {
          const message =
            reason instanceof Error ? reason.message : String(reason);
          this.set({ status: "failed", message });
        }
        return;
      }
    }
    if (this.pending === null) this.set({ status: "saved" });
  }

  private set(state: SaveState): void {
    const same =
      state.status === this.current.status &&
      (state.status !== "failed" ||
        (this.current.status === "failed" &&
          state.message === this.current.message));
    if (same) return;
    this.current = state;
    this.onState?.(state);
  }
}
