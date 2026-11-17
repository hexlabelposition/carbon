import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { entryLabel, placeOf } from "../vault/place";
import type { BookmarksView } from "./use-bookmarks";

interface BookmarksPanelProps {
  bookmarks: BookmarksView;
  /** The note open now, marked in the list. */
  activePath: string | null;
  /** Opens a bookmark, in a new tab if `newTab`. */
  onOpen: (path: string, newTab: boolean) => void;
}

/**
 * The bookmarks, in the order they were added, each with where it is. A
 * click opens one; Ctrl+click and the middle button in a new tab. The
 * bookmark of a row takes it off the list.
 */
export function BookmarksPanel({
  bookmarks,
  activePath,
  onOpen,
}: BookmarksPanelProps) {
  const t = useT();
  const { paths } = bookmarks;
  if (paths === null) return null;
  return (
    <div className="flex h-full flex-col">
      {bookmarks.error !== null && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2 text-small"
        >
          <p className="min-w-0 flex-1 text-danger">{bookmarks.error}</p>
          <button
            type="button"
            className="shrink-0 rounded-sm px-1 text-muted hover:bg-raise hover:text-fg"
            onClick={bookmarks.dismiss}
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}
      {paths.length === 0 ? (
        <p className="px-3 py-4 text-center text-faint">
          {t("bookmarks.empty")}
        </p>
      ) : (
        <ul
          aria-label={t("shell.bookmarks")}
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-2"
        >
          {paths.map((path) => (
            <li
              key={path}
              className={`group flex cursor-default items-center gap-1 rounded-md py-1 pr-1 pl-2 select-none ${
                path === activePath ? "bg-selected" : "hover:bg-raise"
              }`}
              onClick={(event) => onOpen(path, event.ctrlKey || event.metaKey)}
              onAuxClick={(event) => {
                // The middle button opens it in a new tab.
                if (event.button !== 1) return;
                event.preventDefault();
                onOpen(path, true);
              }}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // The click of the row opens it; this is Ctrl+Enter.
                  if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpen(path, true);
                  }
                }}
              >
                <span className="block truncate">{entryLabel(path)}</span>
                <span className="block truncate text-small text-faint">
                  {placeOf(path, t)}
                </span>
              </button>
              <Tooltip label={t("bookmarks.remove")}>
                <button
                  type="button"
                  aria-label={t("bookmarks.remove")}
                  className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted opacity-0 outline-none group-hover:opacity-100 hover:bg-selected hover:text-fg focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-line-strong"
                  onClick={(event) => {
                    event.stopPropagation();
                    bookmarks.remove(path);
                  }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="size-3.5"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                  >
                    <path d={BOOKMARK} />
                  </svg>
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A bookmark ribbon on 16 by 16, for the toolbar and the rows. */
export const BOOKMARK =
  "M4.5 1.75h7a.75.75 0 0 1 .75.75v11.75L8 11.4l-4.25 2.85V2.5a.75.75 0 0 1 .75-.75z";
