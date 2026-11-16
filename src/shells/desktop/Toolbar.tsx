import type { ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { SlidePanel } from "./SlidePanel";

/** How wide the toolbar is open: `w-12`, as the mark above it, in rem. */
export const TOOLBAR_WIDTH = "3rem";

/** A button of the toolbar. */
export interface ToolbarItem {
  id: string;
  /** What it does, for the tooltip and screen readers. */
  label: string;
  /** The keys that do the same, as the user reads them. */
  shortcut?: string;
  /** Lit while what it shows is shown, such as the files in the sidebar. */
  pressed?: boolean;
  /** The shapes of a 16 by 16 icon, drawn with lines. */
  icon: ReactNode;
  run(): void;
}

interface ToolbarProps {
  /** Shown, or slid shut to the left edge. */
  open: boolean;
  /** The buttons from the top. */
  items: readonly ToolbarItem[];
  /** The buttons at the foot, such as the settings. */
  footer: readonly ToolbarItem[];
}

/**
 * The strip at the left edge of the window with small buttons, one above
 * the other, below the top row: as wide as that row is tall, so it stands
 * right under the mark in the corner. Layout only: what the buttons do
 * comes from outside.
 */
export function Toolbar({ open, items, footer }: ToolbarProps) {
  const t = useT();
  return (
    <SlidePanel open={open} width={TOOLBAR_WIDTH}>
      <nav
        aria-label={t("shell.toolbar")}
        className="flex h-full flex-col border-r border-line bg-panel"
      >
        <ToolbarGroup items={items} />
        <div data-tauri-drag-region className="min-h-0 flex-1" />
        <ToolbarGroup items={footer} />
      </nav>
    </SlidePanel>
  );
}

function ToolbarGroup({ items }: { items: readonly ToolbarItem[] }) {
  return (
    <div className="flex shrink-0 flex-col py-1.5">
      {items.map((item) => (
        <ToolbarButton key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToolbarButton({
  item: { label, shortcut, pressed, icon, run },
}: {
  item: ToolbarItem;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={shortcut === undefined ? label : `${label} (${shortcut})`}
      // The whole width of the strip takes the click; only a rounded square
      // around the icon lights up, as on the panel buttons.
      className={`group flex h-9 w-full shrink-0 items-center justify-center outline-none hover:text-fg ${
        pressed === true ? "text-fg" : "text-muted"
      }`}
      onClick={run}
    >
      <span
        className={`flex size-7 items-center justify-center rounded-md transition-colors duration-100 group-hover:bg-selected group-focus-visible:ring-1 group-focus-visible:ring-line-strong ${
          pressed === true ? "bg-selected" : ""
        }`}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
    </button>
  );
}

/** The icons of the toolbar buttons, 16 by 16. */
export const toolbarIcons = {
  files: (
    <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" />
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l4 4" />
    </>
  ),
  note: (
    <>
      <path d="M4 1.5h5l3.5 3.5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" />
      <path d="M9 1.5V5h3.5M6 8.5h4M6 11h4" />
    </>
  ),
  commands: (
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M4.5 6l2 2-2 2M8.5 10h3" />
    </>
  ),
  settings: (
    <>
      <path d="M2 4.5h2M7.5 4.5H14M2 11.5h6.5M12 11.5h2" />
      <circle cx="5.75" cy="4.5" r="1.75" />
      <circle cx="10.25" cy="11.5" r="1.75" />
    </>
  ),
  closeVault: (
    <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10.5 5l3 3-3 3M13.5 8H6" />
  ),
} satisfies Record<string, ReactNode>;
