import { ContextMenu } from "@base-ui/react/context-menu";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
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
  /** The buttons from the top, the hidden ones too, in their order. */
  items: readonly ToolbarItem[];
  /** The ids of the buttons at the top that are hidden. */
  hidden: ReadonlySet<string>;
  /** Shows a button at the top, or hides it: from the right-click menu. */
  onShowItem: (id: string, shown: boolean) => void;
  /**
   * Moves a button at the top to `to` among those shown: dragged there,
   * or by Alt+Up and Alt+Down.
   */
  onMoveItem: (id: string, to: number) => void;
  /** Puts the buttons back in their usual order; absent while they are. */
  onResetOrder?: () => void;
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
 * each button at the top. Those can be dragged up and down to another
 * place, or moved by Alt+Up and Alt+Down while one has the focus.
 */
export function Toolbar({
  open,
  items,
  hidden,
  onShowItem,
  onMoveItem,
  onResetOrder,
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
          <SortableGroup
            items={items.filter((item) => !hidden.has(item.id))}
            onMove={onMoveItem}
          />
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
              {onResetOrder !== undefined && (
                <>
                  <ContextMenu.Separator className="mx-1 my-1 h-px bg-line" />
                  <ContextMenu.Item
                    className="flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise"
                    onClick={onResetOrder}
                  >
                    {/* As far in as the names above, past their checks. */}
                    <span className="size-4 shrink-0" />
                    <MenuIcon className="opacity-80">{RESET}</MenuIcon>
                    <span className="min-w-0 flex-1 truncate">
                      {t("toolbar.resetOrder")}
                    </span>
                  </ContextMenu.Item>
                </>
              )}
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </SlidePanel>
  );
}

/** A check mark, before a shown button in the menu. */
const CHECK = <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />;

/** An arrow turning back: the usual order. */
const RESET = <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H6M5.5 4 3 6.5 5.5 9" />;

/** How far the pointer goes with the button held before a drag starts. */
const DRAG_START = 4;

/** How long the buttons take to slide to their places, in milliseconds. */
const SLIDE_MS = 160;

const SLIDE = `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0, 0, 1)`;

/** Whether the system asks for less motion. */
function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A button pressed, and dragged once the pointer went far enough. */
interface Press {
  id: string;
  /** Its place among the buttons. */
  from: number;
  pointerId: number;
  /** Where the pointer went down. */
  y: number;
  /** The top of the first button and the height of one, as they were. */
  top: number;
  height: number;
  dragging: boolean;
}

/**
 * A button on the move: dragged, with the pointer `dy` from where it went
 * down, or settling, sliding to the place `to` before the order changes.
 */
interface Move {
  id: string;
  from: number;
  to: number;
  height: number;
  dy: number;
  /** Sliding to `to`; then moved there if `commit`, else put back. */
  settling: boolean;
  commit: boolean;
}

/**
 * The buttons at the top: in a column that can be put in another order.
 * A button dragged up or down follows the pointer, and the others slide
 * out of its way as it passes; let go, it slides into the place it is
 * over and is kept there. Escape slides it back. A drag does not click
 * the button. Alt+Up and Alt+Down move the button with the focus by one
 * place, sliding as well.
 */
function SortableGroup({
  items,
  onMove,
}: {
  items: readonly ToolbarItem[];
  onMove: (id: string, to: number) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  /** The click that ends a drag, which must not run the button. */
  const swallowClick = useRef(false);
  const [move, setMove] = useState<Move | null>(null);
  /** The button moved by the keys, to take the focus back once moved. */
  const refocus = useRef<string | null>(null);
  const latestMove = useRef(onMove);
  /** `move`, for the key handler outside React. */
  const moveNow = useRef<Move | null>(null);
  useLayoutEffect(() => {
    latestMove.current = onMove;
    moveNow.current = move;
  });

  /** Slides the button on the move to `to`, then ends the move. */
  const settle = useCallback((to: number, commit: boolean) => {
    const current = press.current;
    press.current = null;
    if (current?.dragging === true) {
      group.current?.releasePointerCapture(current.pointerId);
    }
    setMove((old) =>
      old === null ? old : { ...old, to, settling: true, commit },
    );
  }, []);

  // Once slid into its place, the button is moved there for real: in the
  // same render the slides are taken off, so nothing jumps.
  const settling = move?.settling === true ? move : null;
  useEffect(() => {
    if (settling === null) return;
    const done = () => {
      if (settling.commit && settling.to !== settling.from) {
        latestMove.current(settling.id, settling.to);
      }
      setMove(null);
    };
    if (reducedMotion()) {
      done();
      return;
    }
    const timer = window.setTimeout(done, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [settling]);

  // Escape slides a dragged button back.
  const dragging = move !== null && !move.settling;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      swallowClick.current = true;
      const current = moveNow.current;
      if (current !== null) settle(current.from, false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dragging, settle]);

  useLayoutEffect(() => {
    const id = refocus.current;
    if (id === null) return;
    refocus.current = null;
    group.current
      ?.querySelector<HTMLElement>(`[data-tool="${CSS.escape(id)}"] button`)
      ?.focus();
  }, [items]);

  const placeAt = (y: number, current: Press) =>
    Math.min(
      items.length - 1,
      Math.max(0, Math.floor((y - current.top) / current.height)),
    );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || move !== null || group.current === null) {
      return;
    }
    // A click left over from a drag put back by Escape and let go away
    // from the toolbar never came: this press is a new one.
    swallowClick.current = false;
    const first = group.current.querySelector<HTMLElement>("[data-tool]");
    if (first === null) return;
    const box = first.getBoundingClientRect();
    press.current = {
      id,
      from: items.findIndex((item) => item.id === id),
      pointerId: event.pointerId,
      y: event.clientY,
      top: box.top,
      height: box.height,
      dragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    if (!current.dragging) {
      if (Math.abs(event.clientY - current.y) < DRAG_START) return;
      current.dragging = true;
      group.current?.setPointerCapture(event.pointerId);
    }
    const { from, height } = current;
    // Not past the first place or the last.
    const dy = Math.min(
      (items.length - 1 - from) * height,
      Math.max(-from * height, event.clientY - current.y),
    );
    setMove({
      id: current.id,
      from,
      to: placeAt(event.clientY, current),
      height,
      dy,
      settling: false,
      commit: false,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    if (current.dragging) {
      swallowClick.current = true;
      settle(placeAt(event.clientY, current), true);
    } else {
      press.current = null;
    }
  };

  const onKeyDown = (event: KeyboardEvent, id: string, index: number) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const by = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (by === 0) return;
    event.preventDefault();
    const to = index + by;
    if (move !== null || to < 0 || to >= items.length) return;
    const row = event.currentTarget.getBoundingClientRect();
    refocus.current = id;
    setMove({
      id,
      from: index,
      to,
      height: row.height,
      dy: 0,
      settling: true,
      commit: true,
    });
  };

  /** Where a button is drawn while one is on the move. */
  const styleOf = (index: number): CSSProperties | undefined => {
    if (move === null) return undefined;
    const { from, to, height } = move;
    if (index === from) {
      return {
        transform: `translateY(${move.settling ? (to - from) * height : move.dy}px)`,
        // Right under the pointer while dragged; sliding once let go.
        transition: move.settling ? SLIDE : "none",
        position: "relative",
        zIndex: 1,
      };
    }
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -height;
    if (from > to && index >= to && index < from) shift = height;
    return { transform: `translateY(${shift}px)`, transition: SLIDE };
  };

  return (
    <div
      ref={group}
      className={`flex shrink-0 flex-col py-1.5 ${
        dragging ? "cursor-grabbing" : ""
      }`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (press.current?.dragging === true) settle(press.current.from, false);
        else press.current = null;
      }}
      onLostPointerCapture={() => {
        if (press.current?.dragging === true) settle(press.current.from, false);
      }}
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          data-tool={item.id}
          style={styleOf(index)}
          onPointerDown={(event) => onPointerDown(event, item.id)}
          onKeyDown={(event) => onKeyDown(event, item.id, index)}
        >
          <ToolbarButton
            item={item}
            tooltip={move === null}
            lifted={move?.id === item.id}
          />
        </div>
      ))}
    </div>
  );
}

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
  tooltip = true,
  lifted = false,
}: {
  item: ToolbarItem;
  /** Shown on hover; not while a button is dragged. */
  tooltip?: boolean;
  /** Lit as on hover: dragged, or sliding to its new place. */
  lifted?: boolean;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="right" disabled={!tooltip}>
      <ToolbarIconButton
        label={label}
        pressed={pressed}
        lifted={lifted}
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
  lifted = false,
  icon,
  ...props
}: {
  label: string;
  /** Lit, as while what it shows is shown. */
  pressed?: boolean;
  /** Picked up, as while dragged: lit, a little larger. */
  lifted?: boolean;
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
        pressed === true || lifted ? "text-fg" : "text-muted"
      }`}
    >
      <span
        className={`flex size-8 items-center justify-center rounded-md transition-[background-color,scale] duration-100 group-hover:bg-selected group-focus-visible:ring-1 group-focus-visible:ring-line-strong motion-reduce:transition-none ${
          pressed === true || lifted ? "bg-selected" : ""
        } ${lifted ? "scale-110" : ""}`}
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
