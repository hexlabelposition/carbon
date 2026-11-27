import { ContextMenu } from "@base-ui/react/context-menu";
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
  /** The buttons from the top, the hidden ones too. */
  items: readonly ToolbarItem[];
  /** The ids of the buttons at the top that are hidden. */
  hidden: ReadonlySet<string>;
  /** Shows a button at the top, or hides it: from the right-click menu. */
  onShowItem: (id: string, shown: boolean) => void;
  /**
   * The buttons at the foot, such as the settings, parted from those above
   * by a line across the whole toolbar.
   */
  footer: readonly ToolbarItem[];
  /** What stands above them in that group: the notifications. */
  footerStart?: ReactNode;
  /** What stands below them in that group, at the very foot: the vault. */
  footerEnd?: ReactNode;
}

/**
 * The strip at the left edge of the window with small buttons, one above
 * the other, below the top row: as wide as that row is tall, so it stands
 * right under the mark in the corner. Layout only: what the buttons do
 * comes from outside. The right button opens a menu that shows or hides
 * each button at the top.
 */
export function Toolbar({
  open,
  items,
  hidden,
  onShowItem,
  footer,
  footerStart,
  footerEnd,
}: ToolbarProps) {
  const t = useT();
  return (
    <SlidePanel open={open} width={TOOLBAR_WIDTH}>
      <ContextMenu.Root>
        <ContextMenu.Trigger
          render={
            <nav
              aria-label={t("shell.toolbar")}
              className="flex h-full flex-col border-r border-line bg-panel"
            />
          }
        >
          <ToolbarGroup items={items.filter((item) => !hidden.has(item.id))} />
          <div data-tauri-drag-region className="min-h-0 flex-1" />
          <ToolbarGroup
            items={footer}
            start={footerStart}
            end={footerEnd}
            className="border-t border-line"
          />
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner className="z-50 outline-none">
            <ContextMenu.Popup className="min-w-56 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none">
              {items.map((item) => (
                <ContextMenu.CheckboxItem
                  key={item.id}
                  className="flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise"
                  checked={!hidden.has(item.id)}
                  onCheckedChange={(checked) => onShowItem(item.id, checked)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <ContextMenu.CheckboxItemIndicator
                      render={<MenuIcon>{CHECK}</MenuIcon>}
                    />
                  </span>
                  <MenuIcon className="opacity-80">{item.icon}</MenuIcon>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </ContextMenu.CheckboxItem>
              ))}
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </SlidePanel>
  );
}

/** A check mark, before a shown button in the menu. */
const CHECK = <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />;

/** An icon of 16 by 16 in the menu, drawn with lines as on the toolbar. */
function MenuIcon({
  className = "",
  children,
  ...props
}: { className?: string; children: ReactNode } & ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      className={`size-4 shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

function ToolbarGroup({
  items,
  start,
  end,
  className = "",
}: {
  items: readonly ToolbarItem[];
  /** What stands before the buttons, such as one that opens a popup. */
  start?: ReactNode;
  /** What stands after them, such as a button with a menu. */
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 flex-col py-1.5 ${className}`}>
      {start}
      {items.map((item) => (
        <ToolbarButton key={item.id} item={item} />
      ))}
      {end}
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
