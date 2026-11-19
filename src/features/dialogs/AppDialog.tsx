import { Dialog } from "@base-ui/react/dialog";
import {
  useEffect,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { openDialogId } from "./open-dialog";

// How many dialogs are open now: the panels of the window wait for none.
const listeners = new Set<() => void>();
let openCount = 0;

function changeCount(by: number) {
  openCount += by;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether any dialog stands over the window. */
export function useAnyDialogOpen(): boolean {
  return useSyncExternalStore(subscribe, () => openCount > 0);
}

/** The backdrop most dialogs have: the window, dimmed and blurred. */
const BLURRED = "bg-backdrop/40 backdrop-blur-xs";

interface AppDialogProps {
  /** Whether it is shown; by default it is while mounted. */
  open?: boolean;
  /** Escape, a click outside or a close button asks to close it. */
  onClose: () => void;
  /** The classes of the dialog itself, with its place in the window. */
  className: string;
  /** The classes of the backdrop, which starts below the top row. */
  backdrop?: string;
  /** Whether a click outside closes it, as Escape does. */
  closeOnOutsidePress?: boolean;
  /** What takes the focus when it opens: its first control by default. */
  initialFocus?: RefObject<HTMLElement | null>;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Extra attributes of the dialog element. */
  popupProps?: Omit<ComponentProps<typeof Dialog.Popup>, "className">;
  children: ReactNode;
}

/**
 * A dialog over the window. The top row stays out of it: its backdrop
 * starts below, so the window buttons can still be pressed and a press on
 * one does not close the dialog. The buttons of the panels wait meanwhile
 * (`useAnyDialogOpen`). It keeps the focus inside and closes on Escape.
 * Inside it, `Dialog.Title` and `Dialog.Close` of base-ui work.
 */
export function AppDialog({
  open = true,
  onClose,
  className,
  backdrop = BLURRED,
  closeOnOutsidePress = true,
  initialFocus,
  popupProps,
  children,
  ...aria
}: AppDialogProps) {
  useEffect(() => {
    if (!open) return;
    changeCount(1);
    return () => changeCount(-1);
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={!closeOnOutsidePress}
      onOpenChange={(next, details) => {
        if (next) return;
        if (
          details.reason === "outside-press" &&
          details.event.target instanceof Element &&
          details.event.target.closest("[data-window-controls]") !== null
        ) {
          return;
        }
        onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={`fixed inset-x-0 top-bar bottom-0 z-50 ${backdrop}`}
        />
        <Dialog.Popup
          {...popupProps}
          {...aria}
          initialFocus={initialFocus}
          // Closed for another dialog: the focus is that one's to keep,
          // not given back to where it was before.
          finalFocus={() => openDialogId() === null}
          className={`z-50 text-ui text-fg outline-none ${className}`}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
