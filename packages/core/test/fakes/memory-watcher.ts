import type { FsEvent, Watcher } from "../../src/index";

/**
 * An in-memory `Watcher`. Nothing happens on its own: a test calls `emit`
 * to play the role of the operating system.
 */
export class MemoryWatcher implements Watcher {
  private readonly watches = new Set<{
    dir: string;
    onEvent: (event: FsEvent) => void;
  }>();

  async watch(
    dir: string,
    onEvent: (event: FsEvent) => void,
  ): Promise<() => void> {
    const entry = { dir, onEvent };
    this.watches.add(entry);
    return () => {
      this.watches.delete(entry);
    };
  }

  /** Test helper: delivers an event to every watch that covers its path. */
  emit(event: FsEvent): void {
    for (const { dir, onEvent } of [...this.watches]) {
      if (event.path === dir || event.path.startsWith(`${dir}/`)) {
        onEvent(event);
      }
    }
  }

  /** Test helper: the number of active watches. */
  get watchCount(): number {
    return this.watches.size;
  }
}
