import { useSyncExternalStore } from "react";
import type { MessageKey, MessageParams } from "../i18n/i18n";

/**
 * A notification in the panel under the bell in the top row: something
 * worth knowing that need not interrupt, such as a slow start. Its texts
 * are keys of the interface texts, so it follows a change of language.
 */
export interface AppNotification {
  /** Stays the same for the same news: a new one with it replaces the old. */
  id: string;
  title: MessageKey;
  text?: MessageKey;
  /** Put into the title and the text in place of `{name}`. */
  params?: MessageParams;
  /** A button under the text, such as "Details". */
  action?: { label: MessageKey; run: () => void };
  /** When it came, as `Date.now()`. */
  at: number;
}

interface NotificationsState {
  /** The newest first. */
  list: readonly AppNotification[];
  /** Whether one came since the panel was last opened. */
  unread: boolean;
}

// Only while the app runs: what they tell of, such as a slow start, is
// about this run.
let state: NotificationsState = { list: [], unread: false };
const listeners = new Set<() => void>();

function set(next: NotificationsState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Adds a notification at the top, in place of one with its `id`. */
export function notify(notification: Omit<AppNotification, "at">): void {
  const added = { ...notification, at: Date.now() };
  set({
    list: [added, ...state.list.filter((n) => n.id !== notification.id)],
    unread: true,
  });
}

/** Takes a notification away. */
export function dismiss(id: string): void {
  set({ ...state, list: state.list.filter((n) => n.id !== id) });
}

/** Takes every notification away. */
export function dismissAll(): void {
  set({ list: [], unread: false });
}

/** The panel was opened: the news is read. */
export function markRead(): void {
  if (state.unread) set({ ...state, unread: false });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The notifications now, and whether one is unread. */
export function currentNotifications(): NotificationsState {
  return state;
}

/** The notifications, and whether one is unread, kept up to date. */
export function useNotifications(): NotificationsState {
  return useSyncExternalStore(subscribe, currentNotifications);
}
