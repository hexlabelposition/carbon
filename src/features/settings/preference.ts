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

  return {
    get,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      try {
        localStorage.setItem(key, write(next));
      } catch {
        // As above: kept for this run only.
      }
      for (const listener of listeners) listener();
    },
    use: () => useSyncExternalStore(subscribe, get),
  };
}

/** Parses a stored value that must be one of `options`. */
export function oneOf<T extends string>(options: readonly T[]) {
  return (stored: string): T | undefined =>
    (options as readonly string[]).includes(stored) ? (stored as T) : undefined;
}
