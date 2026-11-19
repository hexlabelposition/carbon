import type { ComponentProps, ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { SlidePanel } from "./SlidePanel";
import { Tooltip } from "../../features/ui/Tooltip";
import { BOOKMARK } from "../../features/bookmarks/BookmarksPanel";

/** How wide the toolbar is open: as the mark above it (`w-bar`). */
export const TOOLBAR_WIDTH = "var(--spacing-bar)";

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
  /** What stands below them, at the very foot. */
  footerEnd?: ReactNode;
}

/**
 * The strip at the left edge of the window with small buttons, one above
 * the other, below the top row: as wide as that row is tall, so it stands
 * right under the mark in the corner. Layout only: what the buttons do
 * comes from outside.
 */
export function Toolbar({ open, items, footer, footerEnd }: ToolbarProps) {
  const t = useT();
  return (
    <SlidePanel open={open} width={TOOLBAR_WIDTH}>
      <nav
        aria-label={t("shell.toolbar")}
        className="flex h-full flex-col border-r border-line bg-panel"
      >
        <ToolbarGroup items={items} />
        <div data-tauri-drag-region className="min-h-0 flex-1" />
        <ToolbarGroup items={footer}>{footerEnd}</ToolbarGroup>
      </nav>
    </SlidePanel>
  );
}

function ToolbarGroup({
  items,
  children,
}: {
  items: readonly ToolbarItem[];
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col py-1.5">
      {items.map((item) => (
        <ToolbarButton key={item.id} item={item} />
      ))}
      {children}
    </div>
  );
}

function ToolbarButton({
  item: { label, shortcut, pressed, icon, run },
}: {
  item: ToolbarItem;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="right">
      <ToolbarIconButton
        label={label}
        pressed={pressed}
        icon={icon}
        aria-pressed={pressed}
        onClick={run}
      />
    </Tooltip>
  );
}

/**
 * The look of a toolbar button, for one that does more than run a
 * command, such as opening a menu: it takes the props of a `<button>`.
 */
export function ToolbarIconButton({
  label,
  pressed,
  icon,
  ...props
}: {
  label: string;
  /** Lit, as while what it shows is shown. */
  pressed?: boolean;
  icon: ReactNode;
} & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      // The whole width of the strip takes the click; only a rounded square
      // around the icon lights up, as on the panel buttons.
      className={`group flex h-10 w-full shrink-0 items-center justify-center outline-none hover:text-fg ${
        pressed === true ? "text-fg" : "text-muted"
      }`}
    >
      <span
        className={`flex size-8 items-center justify-center rounded-md transition-colors duration-100 group-hover:bg-selected group-focus-visible:ring-1 group-focus-visible:ring-line-strong ${
          pressed === true ? "bg-selected" : ""
        }`}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4.5"
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

/** The icons of the toolbar buttons, drawn on 16 by 16. */
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
  tags: (
    <>
      <path d="M1.5 2.5v4.6a1 1 0 0 0 .3.7l6.4 6.4a1 1 0 0 0 1.4 0l4.1-4.1a1 1 0 0 0 0-1.4L7.3 2.3a1 1 0 0 0-.7-.3H2a.5.5 0 0 0-.5.5z" />
      <circle cx="4.75" cy="5.25" r="1" />
    </>
  ),
  bookmarks: <path d={BOOKMARK} />,
  // A page with a pencil across its corner.
  drafts: (
    <>
      <path d="M8.5 14.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5h5l3.5 3.5v2" />
      <path d="M9 1.5V5h3.5M13.25 8.75l1 1-4.5 4.5-1.5.5.5-1.5z" />
    </>
  ),
  trash: (
    <>
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.75 9.5a1 1 0 0 0 1 .9h4.5a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.75 7v4.5M9.25 7v4.5" />
    </>
  ),
  note: (
    <>
      <path d="M4 1.5h5l3.5 3.5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" />
      <path d="M9 1.5V5h3.5M6 8.5h4M6 11h4" />
    </>
  ),
  // A die showing three.
  randomNote: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <circle cx="5.25" cy="5.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10.75" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Three notes and the links between them.
  graph: (
    <>
      <circle cx="4" cy="4.5" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="6.5" cy="12" r="2" />
      <path d="M5.95 4.95l4.1.6M10.6 7.45l-2.7 3.1M4.8 6.35l.95 3.8" />
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
  // A safe: its door, the dial on it and its feet.
  vault: (
    <>
      <rect x="2" y="2" width="12" height="10.5" rx="1.5" />
      <circle cx="8" cy="7.25" r="2.25" />
      <path d="M8 5v.75M4.5 12.5v1.5M11.5 12.5v1.5" />
    </>
  ),
  closeVault: (
    <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10.5 5l3 3-3 3M13.5 8H6" />
  ),
  openVault: (
    <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" />
  ),
} satisfies Record<string, ReactNode>;
