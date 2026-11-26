import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode } from "react";
import { AppDialog } from "../dialogs/AppDialog";
import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import {
  dismiss,
  dismissAll,
  markRead,
  useNotifications,
  type AppNotification,
} from "./notifications";

/**
 * A bell at the foot of the toolbar that opens the notifications in a
 * dialog over the blurred window, as the settings: news that need not
 * interrupt, such as a slow start. A dot on the bell tells of one not yet
 * seen; opening the dialog takes it away. Shown with nothing in it too,
 * so the buttons beside it keep their places.
 */
export function NotificationsButton() {
  const t = useT();
  const { list, unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const label = unread ? t("notifications.unread") : t("notifications.title");

  return (
    <>
      <Tooltip label={label} side="right">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          // As the other buttons of the toolbar: the whole width of the
          // strip takes the click, only a rounded square around the icon
          // lights up.
          className={`group flex h-10 w-full shrink-0 items-center justify-center outline-none hover:text-fg ${
            open ? "text-fg" : "text-muted"
          }`}
          onClick={() => {
            markRead();
            setOpen(true);
          }}
        >
          <span
            className={`relative flex size-8 items-center justify-center rounded-md transition-colors duration-100 group-hover:bg-selected group-focus-visible:ring-1 group-focus-visible:ring-line-strong ${
              open ? "bg-selected" : ""
            }`}
          >
            <Icon size="size-5">
              {/* A bell: its body, the rim, the clapper below. */}
              <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5M2.75 11.5h10.5M6.75 13.75a1.4 1.4 0 0 0 2.5 0" />
            </Icon>
            {unread && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-link ring-2 ring-panel" />
            )}
          </span>
        </button>
      </Tooltip>
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        // Centered by its margins, as the settings: a move of half an odd
        // size lands between pixels and blurs the text. As tall as what it
        // holds, up to a limit.
        className="fixed inset-0 m-auto flex h-fit max-h-[min(560px,calc(100vh-96px))] w-[480px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
      >
        {/* A header as the one of the settings: the name, and a way out. */}
        <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel pr-1.5 pl-4">
          <Dialog.Title className="mr-auto font-semibold">
            {t("notifications.title")}
          </Dialog.Title>
          {list.length > 0 && (
            <button
              type="button"
              className="h-7 rounded-md px-2 text-muted outline-none hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
              onClick={dismissAll}
            >
              {t("notifications.clear")}
            </button>
          )}
          <Tooltip label={t("common.close")} shortcut="Esc">
            <Dialog.Close
              aria-label={t("common.close")}
              className="flex size-8 items-center justify-center rounded-md text-muted outline-none hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
            >
              <Icon size="size-5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </Icon>
            </Dialog.Close>
          </Tooltip>
        </header>
        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted">
            {t("notifications.empty")}
          </p>
        ) : (
          <ul className="flex min-h-0 flex-col divide-y divide-line overflow-auto">
            {list.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </ul>
        )}
      </AppDialog>
    </>
  );
}

/** An icon of 16 by 16, drawn with lines as the others of the app. */
function Icon({ size, children }: { size: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const t = useT();
  const { id, title, text, params, action } = notification;
  return (
    <li className="flex items-start gap-2 py-3 pr-2 pl-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{t(title, params)}</p>
        {text !== undefined && <p className="text-muted">{t(text, params)}</p>}
        {action !== undefined && (
          <Dialog.Close
            className="mt-1 h-7 self-start rounded-md border border-line-strong bg-panel px-3 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong"
            onClick={action.run}
          >
            {t(action.label)}
          </Dialog.Close>
        )}
      </div>
      <Tooltip label={t("notifications.dismiss")}>
        <button
          type="button"
          aria-label={t("notifications.dismiss")}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
          onClick={() => dismiss(id)}
        >
          <Icon size="size-4">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </Icon>
        </button>
      </Tooltip>
    </li>
  );
}
