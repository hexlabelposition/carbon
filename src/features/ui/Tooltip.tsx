import { Tooltip as Base } from "@base-ui/react/tooltip";
import {
  useCallback,
  useState,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { pointerOutside, usePointerLeavesWindow } from "./pointer-outside";
import { Shortcut } from "../commands/Shortcut";

/**
 * Holds the tooltips of the app: once one has shown, the next one shows
 * at once while the pointer moves along a row of buttons. Mount it once,
 * above everything that has tooltips.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Base.Provider delay={600} closeDelay={0} timeout={400}>
      {children}
    </Base.Provider>
  );
}

/** Handlers that keep the events of the pointer to the tooltip. */
const keepEvents = {
  onClick: stop,
  onDoubleClick: stop,
  onAuxClick: stop,
  onMouseDown: stop,
  onPointerDown: stop,
  onPointerUp: stop,
};

function stop(event: SyntheticEvent): void {
  event.stopPropagation();
}

interface TooltipProps {
  /** What the tooltip says. */
  label: ReactNode;
  /** The keys that do the same, written with `keys`: shown in boxes. */
  shortcut?: string;
  /** Where it shows, if there is room: below by default. */
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Opens on hover only, not on focus: for a text field, which takes the
   * focus to be typed in, not to be explained.
   */
  hoverOnly?: boolean;
  /** Told as it opens and shuts: to fetch what it says, as it opens. */
  onOpenChange?: (open: boolean) => void;
  /** Kept shut, as while its button is dragged. */
  disabled?: boolean;
  /** The element it is about, which takes its props and its ref. */
  children: ReactElement;
}

/**
 * A tooltip of our own in place of the `title` of the system, which the
 * WebView draws in its own look and late: a small panel in the colors of
 * the theme, with the keys of a shortcut in boxes, as the palette shows
 * them.
 */
export function Tooltip({
  label,
  shortcut,
  side = "bottom",
  hoverOnly = false,
  onOpenChange,
  disabled = false,
  children,
}: TooltipProps) {
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  // Shut as the pointer leaves the window: WebKitGTK does not tell the
  // button under it that it left (`pointer-outside.ts`).
  usePointerLeavesWindow(
    useCallback(() => setOpen(false), [setOpen]),
    open,
  );
  return (
    <Base.Root
      open={open && !disabled}
      onOpenChange={(next, details) => {
        if (next && hoverOnly && details.reason === "trigger-focus") return;
        // Its delay may run out after the pointer left the window by the
        // edge, past the button: it stays shut (`pointerOutside`).
        if (next && pointerOutside() && details.reason !== "trigger-focus") {
          return;
        }
        setOpen(next);
      }}
    >
      <Base.Trigger render={children} />
      <Base.Portal>
        <Base.Positioner
          side={side}
          sideOffset={6}
          collisionPadding={8}
          // Over the dialogs too: their buttons have tooltips.
          className="z-60"
        >
          <Base.Popup
            // Drawn in a portal, but React passes its events up to where
            // the tooltip is written, as a row of the file tree: a click on
            // it, the right button too, must not reach that row or its
            // menu. A right click only shuts it.
            {...keepEvents}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
            // One line, as wide as its text: placed by the side of the
            // window, it would else be squeezed into the room left there
            // and wrap. Only a text wider than the window is cut short.
            className="flex w-max max-w-[calc(100vw-16px)] origin-(--transform-origin) items-center gap-2 rounded-md border border-line bg-panel px-2 py-1 text-small text-fg shadow-dialog transition-[opacity,scale] duration-100 ease-out select-none data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
          >
            <span className="min-w-0 truncate">{label}</span>
            {shortcut !== undefined && <Shortcut text={shortcut} />}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
