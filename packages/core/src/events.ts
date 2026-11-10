/** A minimal typed event emitter. `Events` maps event names to payloads. */
export class Emitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Subscribes to an event. Returns a function that unsubscribes. */
  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      (listener as (payload: Events[K]) => void)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
