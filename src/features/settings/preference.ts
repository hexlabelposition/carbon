import { useSyncExternalStore } from "react";

/**
 * One setting of this device, such as the theme: remembered between app
 * starts, and shared by every part of the app that reads it, so the
 * settings dialog, a command and a shortcut always agree.
 */
export interface Preference<T> {
  get(): T;
  set(value: T): void;
  /** The value, kept up to date in a component. */
  use(): T;
  /**
   * Calls `listener` whenever the value changes, for code outside React.
   * Returns a function that stops it.
   */
  subscribe(listener: () => void): () => void;
  /** Back to the value it has until the user picks another. */
  reset(): void;
}

/** Every setting made, so all of them can be reset at once. */
const all: Preference<unknown>[] = [];

/** Puts every setting of this device back to its default. */
export function resetPreferences(): void {
  for (const setting of all) setting.reset();
}

/**
 * A setting stored under `key` in the local storage of the WebView.
 * `parse` reads a stored value back, `undefined` for one that is not
 * valid any more: then, and when nothing is stored, it is `fallback`.
 */
export function preference<T>(
  key: string,
  fallback: T,
  parse: (stored: string) => T | undefined,
  write: (value: T) => string = String,
): Preference<T> {
  const listeners = new Set<() => void>();
  let value = load();

  function load(): T {
    try {
      const stored = localStorage.getItem(key);
      return (stored === null ? undefined : parse(stored)) ?? fallback;
    } catch {
      // No storage: the setting works, it only resets on the next start.
      return fallback;
    }
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const get = () => value;
  const changed = () => {
    for (const listener of listeners) listener();
  };

  const setting: Preference<T> = {
    get,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      try {
        localStorage.setItem(key, write(next));
      } catch {
        // As above: kept for this run only.
      }
      changed();
    },
    use: () => useSyncExternalStore(subscribe, get),
    subscribe,
    reset() {
      // Nothing stored: a later version may give it another default.
      try {
        localStorage.removeItem(key);
      } catch {
        // As above.
      }
      if (Object.is(fallback, value)) return;
      value = fallback;
      changed();
    },
  };
  all.push(setting as Preference<unknown>);
  return setting;
}

/** Parses a stored value that must be one of `options`. */
export function oneOf<T extends string>(options: readonly T[]) {
  return (stored: string): T | undefined =>
    (options as readonly string[]).includes(stored) ? (stored as T) : undefined;
}
