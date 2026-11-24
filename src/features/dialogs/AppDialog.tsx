import { Dialog } from "@base-ui/react/dialog";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { changeDialogCount } from "./dialog-count";
import { openDialogId } from "./open-dialog";

/**
 * What the focus is not given back to: closed by Escape, base-ui would
 * draw its focus ring on it (`focusVisible`), as if reached by keys.
 */
const NO_FOCUS_BACK = "button, a[href], [role='button']";

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
  /** Whether it stays in the page, hidden, while closed. */
  keepMounted?: boolean;
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
 * starts below, so the window buttons and those of the panels can still
 * be pressed, and a press on one does not close the dialog. It keeps the
 * focus inside and closes on Escape.
 * Inside it, `Dialog.Title` and `Dialog.Close` of base-ui work.
 */
export function AppDialog({
  open = true,
  onClose,
  className,
  backdrop = BLURRED,
  closeOnOutsidePress = true,
  keepMounted = false,
  initialFocus,
  popupProps,
  children,
  ...aria
}: AppDialogProps) {
  // Where the focus was before it opened, read as it opens: the popup
  // takes the focus in an effect, after this render.
  const [before, setBefore] = useState(() =>
    open ? document.activeElement : null,
  );
  const popup = useRef<HTMLDivElement>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBefore(document.activeElement);
  }

  useEffect(() => {
    if (!open) return;
    changeDialogCount(1);
    return () => changeDialogCount(-1);
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
      <Dialog.Portal keepMounted={keepMounted}>
        <Dialog.Backdrop
          className={`fixed inset-x-0 top-bar bottom-0 z-50 data-closed:hidden ${backdrop}`}
        />
        <Dialog.Popup
          {...popupProps}
          {...aria}
          ref={popup}
          initialFocus={initialFocus}
          // Closed for another dialog: the focus is that one's to keep,
          // not given back to where it was before. Nor to a button, nor
          // when something outside took it already, as a note that was
          // opened from the dialog (`focusOnOpenPreference`).
          finalFocus={() =>
            openDialogId() === null &&
            !(before?.matches(NO_FOCUS_BACK) ?? false) &&
            !focusTakenOutside(popup.current)
          }
          className={`z-50 text-ui text-fg outline-none data-closed:hidden ${className}`}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Whether an element outside `popup` holds the focus. */
function focusTakenOutside(popup: HTMLElement | null): boolean {
  const focused = document.activeElement;
  return (
    focused !== null &&
    focused !== document.body &&
    !(popup?.contains(focused) ?? false)
  );
}
