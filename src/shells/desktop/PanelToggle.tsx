interface PanelToggleProps {
  side: "left" | "right";
  open: boolean;
  /** The keys that do the same, as the user reads them. */
  shortcut: string;
  onToggle: () => void;
}

/**
 * The button that shows or hides the panel at one side: a window with that
 * side drawn as a column, filled while the panel is open.
 */
export function PanelToggle({
  side,
  open,
  shortcut,
  onToggle,
}: PanelToggleProps) {
  const name = side === "left" ? "left panel" : "right panel";
  const label = `${open ? "Hide" : "Show"} the ${name}`;
  // The column the panel takes, inside the 16 by 16 window.
  const x = side === "left" ? 2 : 10;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={open}
      title={`${label} (${shortcut})`}
      className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-raise hover:text-fg"
      onClick={onToggle}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d={side === "left" ? "M6 2.5v11" : "M10 2.5v11"} />
        {open && (
          <rect
            x={x}
            y="3"
            width="4"
            height="10"
            rx="1"
            fill="currentColor"
            stroke="none"
          />
        )}
      </svg>
    </button>
  );
}
