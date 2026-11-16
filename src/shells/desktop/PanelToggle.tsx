import { useT } from "../../features/i18n/i18n";
import { Tooltip } from "../../features/ui/Tooltip";

const LABELS = {
  left: { show: "panels.showLeft", hide: "panels.hideLeft" },
  right: { show: "panels.showRight", hide: "panels.hideRight" },
  toolbar: { show: "panels.showToolbar", hide: "panels.hideToolbar" },
} as const;

/**
 * Inside the 16 by 16 window: where the line that sets the column off is,
 * and the column filled while the panel is open.
 */
const COLUMNS = {
  left: { line: 6, x: 2, width: 4 },
  right: { line: 10, x: 10, width: 4 },
  toolbar: { line: 5.5, x: 2, width: 3.5 },
} as const;

interface PanelToggleProps {
  /** The panel at the left or the right, or the toolbar at the left edge. */
  side: "left" | "right" | "toolbar";
  open: boolean;
  /** The keys that do the same, as the user reads them. */
  shortcut: string;
  onToggle: () => void;
}

/**
 * The button that shows or hides the panel at one side: a window with that
 * side drawn as a column, filled while the panel is open. The toolbar is
 * a narrow column at the very left with three small buttons in it.
 */
export function PanelToggle({
  side,
  open,
  shortcut,
  onToggle,
}: PanelToggleProps) {
  const t = useT();
  const label = t(LABELS[side][open ? "hide" : "show"]);
  const { line, x, width } = COLUMNS[side];
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={open}
        // As tall as the top row, as the window buttons beside it.
        // The whole height of the row takes the click; only a rounded square
        // around the icon lights up.
        className="group flex h-full w-10 shrink-0 items-center justify-center text-muted outline-none hover:text-fg"
        onClick={onToggle}
      >
        <span className="flex size-8 items-center justify-center rounded-md transition-colors duration-100 group-hover:bg-selected group-focus-visible:ring-1 group-focus-visible:ring-line-strong">
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
            <path d={`M${line} 2.5v11`} />
            {open ? (
              <rect
                x={x}
                y="3"
                width={width}
                height="10"
                rx="1"
                fill="currentColor"
                stroke="none"
              />
            ) : (
              side === "toolbar" &&
              [4.3, 7.1, 9.9].map((y) => (
                <rect
                  key={y}
                  x="2.6"
                  y={y}
                  width="1.8"
                  height="1.8"
                  rx="0.4"
                  fill="currentColor"
                  stroke="none"
                />
              ))
            )}
          </svg>
        </span>
      </button>
    </Tooltip>
  );
}
