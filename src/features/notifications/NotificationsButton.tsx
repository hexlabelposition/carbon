import { Popover } from "@base-ui/react/popover";
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
 * A bell in the top row that opens the notifications under it: news that
 * need not interrupt, such as a slow start. A dot on the bell tells of
 * one not yet seen; opening the panel takes it away. Shown with nothing
 * in it too, so the buttons beside it keep their places.
 */
export function NotificationsButton() {
  const t = useT();
  const { list, unread } = useNotifications();
  const label = unread ? t("notifications.unread") : t("notifications.title");

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) markRead();
      }}
    >
      <Tooltip label={label}>
        <Popover.Trigger
          aria-label={label}
          // As the buttons of the panels beside it: as tall as the row, only
          // a rounded square around the icon lights up.
          className="group flex h-full w-10 shrink-0 items-center justify-center text-muted outline-none hover:text-fg data-popup-open:text-fg"
        >
          <span className="relative flex size-8 items-center justify-center rounded-md transition-colors duration-100 group-hover:bg-selected group-focus-visible:ring-1 group-focus-visible:ring-line-strong group-data-popup-open:bg-selected">
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
              {/* A bell: its body, the rim, the clapper below. */}
              <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5M2.75 11.5h10.5M6.75 13.75a1.4 1.4 0 0 0 2.5 0" />
            </svg>
            {unread && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-link ring-2 ring-panel" />
            )}
          </span>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-50 outline-none"
        >
          <Popover.Popup
            aria-label={t("notifications.title")}
            className="flex max-h-[min(480px,calc(100vh-80px))] w-[340px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border border-line bg-bg text-ui text-fg shadow-dialog outline-none"
          >
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line pr-1.5 pl-3">
              <h2 className="font-semibold">{t("notifications.title")}</h2>
              {list.length > 0 && (
                <button
                  type="button"
                  className="h-7 rounded-md px-2 text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
                  onClick={dismissAll}
                >
                  {t("notifications.clear")}
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-muted">
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const t = useT();
  const { id, title, text, params, action } = notification;
  return (
    <li className="flex items-start gap-2 py-2.5 pr-1.5 pl-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{t(title, params)}</p>
        {text !== undefined && <p className="text-muted">{t(text, params)}</p>}
        {action !== undefined && (
          <Popover.Close
            className="mt-1 h-7 self-start rounded-md border border-line-strong bg-panel px-3 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong"
            onClick={action.run}
          >
            {t(action.label)}
          </Popover.Close>
        )}
      </div>
      <Tooltip label={t("notifications.dismiss")}>
        <button
          type="button"
          aria-label={t("notifications.dismiss")}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
          onClick={() => dismiss(id)}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      </Tooltip>
    </li>
  );
}
