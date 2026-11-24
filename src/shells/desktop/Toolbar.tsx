import type { ComponentProps, ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { SlidePanel } from "./SlidePanel";
import { Tooltip } from "../../features/ui/Tooltip";
import { TOOLBAR_WIDTH } from "./layout";

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
          className="size-5"
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
