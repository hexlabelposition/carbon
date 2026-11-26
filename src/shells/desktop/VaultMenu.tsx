import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode } from "react";
import { AppDialog } from "../../features/dialogs/AppDialog";
import { useT } from "../../features/i18n/i18n";
import { useAppSettings } from "../../features/settings/app-settings";
import { Tooltip } from "../../features/ui/Tooltip";
import { useVaultSession } from "../../features/vault/vault-session";
import { ToolbarIconButton } from "./Toolbar";
import { toolbarIcons } from "./toolbar-icons";

/** How many of the recent vaults the dialog offers, the open one aside. */
const RECENT_SHOWN = 5;

const row =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong disabled:text-faint disabled:hover:bg-transparent";

/** An icon of 16 by 16, drawn as on the toolbar. */
function Icon({
  size = "size-4.5",
  className = "text-muted",
  children,
}: {
  size?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${size} shrink-0 ${className}`}
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

/**
 * The button of the vault at the foot of the toolbar, and its dialog over
 * the blurred window, as the settings: the name and the folder of the
 * open vault, the vaults opened lately to switch to, opening another one
 * in its place and closing it for the start screen.
 */
export function VaultMenu() {
  const t = useT();
  const { vault, opening, open, pickAndOpen, close } = useVaultSession();
  const { recentVaults } = useAppSettings();
  const [shown, setShown] = useState(false);
  if (vault === null) return null;
  const recent = recentVaults
    .filter(({ path }) => path !== vault.root)
    .slice(0, RECENT_SHOWN);

  // The dialog closes first: the vault opened in its place, or the folder
  // picker, takes the window.
  const then = (action: () => void) => () => {
    setShown(false);
    action();
  };

  return (
    <>
      <Tooltip label={t("shell.vault")} side="right">
        <ToolbarIconButton
          label={t("shell.vault")}
          pressed={shown}
          icon={toolbarIcons.vault}
          aria-haspopup="dialog"
          onClick={() => setShown(true)}
        />
      </Tooltip>
      <AppDialog
        open={shown}
        onClose={() => setShown(false)}
        // Centered by its margins, as the settings: a move of half an odd
        // size lands between pixels and blurs the text.
        className="fixed inset-0 m-auto flex h-fit max-h-[min(560px,calc(100vh-96px))] w-[480px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
      >
        {/* A header as the one of the settings: the name, and a way out. */}
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel pr-1.5 pl-4">
          <Dialog.Title className="mr-auto font-semibold">
            {t("shell.vault")}
          </Dialog.Title>
          <Tooltip label={t("common.close")} shortcut="Esc">
            <Dialog.Close
              aria-label={t("common.close")}
              className="flex size-8 items-center justify-center rounded-md text-muted outline-none hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
            >
              <Icon size="size-5" className="">
                <path d="M4 4l8 8M12 4l-8 8" />
              </Icon>
            </Dialog.Close>
          </Tooltip>
        </header>
        <div className="flex min-h-0 flex-col overflow-auto">
          {/* The open vault. */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Icon size="size-5">{toolbarIcons.vault}</Icon>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold">
                {nameOf(vault.root)}
              </span>
              <span className="truncate text-small text-faint">
                {vault.root}
              </span>
            </div>
          </div>
          {recent.length > 0 && (
            <section
              aria-labelledby="vault-dialog-recent"
              className="flex flex-col gap-1 border-b border-line p-2"
            >
              <h2
                id="vault-dialog-recent"
                className="px-2 pt-1 text-label font-semibold tracking-[0.06em] text-faint uppercase"
              >
                {t("start.recentVaults")}
              </h2>
              <ul className="flex flex-col">
                {recent.map(({ path }) => (
                  <li key={path}>
                    <button
                      type="button"
                      className="flex w-full min-w-0 flex-col items-start rounded-md px-2 py-1.5 text-left outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong disabled:text-faint disabled:hover:bg-transparent"
                      disabled={opening}
                      onClick={then(() => void open(path))}
                    >
                      <span className="max-w-full truncate font-medium">
                        {nameOf(path)}
                      </span>
                      <span className="max-w-full truncate text-small text-faint">
                        {path}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-col p-2">
            <button
              type="button"
              className={row}
              disabled={opening}
              onClick={then(() => void pickAndOpen())}
            >
              <Icon>{toolbarIcons.openVault}</Icon>
              {t("shell.openAnotherVault")}
            </button>
            <button type="button" className={row} onClick={then(close)}>
              <Icon>{toolbarIcons.closeVault}</Icon>
              {t("shell.closeVault")}
            </button>
          </div>
        </div>
      </AppDialog>
    </>
  );
}

/** The folder name of a vault: the last part of its path. */
function nameOf(root: string): string {
  return root.slice(root.lastIndexOf("/") + 1);
}
