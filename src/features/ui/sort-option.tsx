import type { ReactNode } from "react";
import type { MessageKey } from "../i18n/i18n";

/** One order of a sort menu. */
export interface SortOption<T extends string> {
  value: T;
  label: MessageKey;
  /** What is sorted by, drawn at the right of the arrow (`SORT_BY`). */
  by: ReactNode;
  /**
   * The first order of its pair, drawn with the arrow up: A to Z, the
   * newest first, the most first.
   */
  first: boolean;
}

/**
 * What an order sorts by, drawn on 16 by 16 at the right of its arrow,
 * shared by the sort menus so the same key looks the same in each.
 */
export const SORT_BY = {
  /** Lines of text. */
  name: <path d="M9.5 4h5M9.5 8h3.75M9.5 12h2.5" />,
  /** A spark, four points: something new. */
  created: (
    <path d="M12 4.5c.3 2 1.2 3.2 3 3.5-1.8.3-2.7 1.5-3 3.5-.3-2-1.2-3.2-3-3.5 1.8-.3 2.7-1.5 3-3.5z" />
  ),
  /** A pencil: when it changed. */
  modified: <path d="M13.25 3.5l1.5 1.5-5 5-2.25.5.5-2.25z" />,
  /** A plus: when it was added. */
  added: <path d="M12 5v6M9 8h6" />,
  /** A hash: how many. */
  count: <path d="M9.5 6.25h5M9 9.75h5M11.25 4l-.75 8M13.75 4 13 12" />,
  /** A small bin: when it was deleted. */
  deleted: <path d="M9.5 5.5h5M11 5.5V4.5h2v1M10.25 5.5l.5 6.5h2.5l.5-6.5" />,
  /** A small folder: where it is. */
  place: (
    <path d="M9 6a1 1 0 0 1 1-1h1.5l1 1H14a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
  ),
} satisfies Record<string, ReactNode>;
