import { useT } from "../../features/i18n/i18n";
import { Tooltip } from "../../features/ui/Tooltip";

const LABELS = {
  left: { show: "panels.showLeft", hide: "panels.hideLeft" },
  right: { show: "panels.showRight", hide: "panels.hideRight" },
} as const;

/**
 * Inside the 16 by 16 window: where the line that sets the column off is,
 * and the column filled while the panel is open.
 */
const COLUMNS = {
  left: { line: 6, x: 2, width: 4 },
  right: { line: 10, x: 10, width: 4 },
} as const;

interface PanelToggleProps {
  /** The panel at the left or the right. */
  side: "left" | "right";
  open: boolean;
  /** The keys that do the same, as the user reads them, if any. */
  shortcut?: string;
  onToggle: () => void;
}

/**
 * The button that shows or hides the panel at one side: a window with that
 * side drawn as a column, filled while the panel is open. The toolbar has
 * none: it is shown or hidden from the settings, the command palette or
 * its shortcut.
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
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
            <path d={`M${line} 2.5v11`} />
            {open && (
              <rect
                x={x}
                y="3"
                width={width}
                height="10"
                rx="1"
                fill="currentColor"
                stroke="none"
              />
            )}
          </svg>
        </span>
      </button>
    </Tooltip>
  );
}
