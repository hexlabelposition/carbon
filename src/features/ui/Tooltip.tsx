import { Tooltip as Base } from "@base-ui/react/tooltip";
import { useState, type ReactElement, type ReactNode } from "react";
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
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <Base.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next && hoverOnly && details.reason === "trigger-focus") return;
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
          <Base.Popup className="flex max-w-80 origin-(--transform-origin) items-center gap-2 rounded-md border border-line bg-panel px-2 py-1 text-small text-fg shadow-dialog transition-[opacity,scale] duration-100 ease-out select-none data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            <span className="min-w-0 break-words">{label}</span>
            {shortcut !== undefined && <Shortcut text={shortcut} />}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
