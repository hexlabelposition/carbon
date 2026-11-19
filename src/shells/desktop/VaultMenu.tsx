import { Menu } from "@base-ui/react/menu";
import { useState, type ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { Tooltip } from "../../features/ui/Tooltip";
import { useVaultSession } from "../../features/vault/vault-session";
import { ToolbarIconButton, toolbarIcons } from "./Toolbar";

const item =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise";

/** An icon of 16 by 16 in a menu item, drawn as on the toolbar. */
function ItemIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 shrink-0 text-muted"
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
 * The button of the vault at the foot of the toolbar, and its menu: the
 * name and the folder of the open vault, opening another one in its place
 * and closing it for the start screen.
 */
export function VaultMenu() {
  const t = useT();
  const { vault, pickAndOpen, close } = useVaultSession();
  const [open, setOpen] = useState(false);
  if (vault === null) return null;
  const name = vault.root.slice(vault.root.lastIndexOf("/") + 1);

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Tooltip label={t("shell.vault")} side="right">
        <Menu.Trigger
          render={
            <ToolbarIconButton
              label={t("shell.vault")}
              pressed={open}
              icon={toolbarIcons.vault}
            />
          }
        />
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner
          side="right"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 outline-none"
        >
          <Menu.Popup className="w-64 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none">
            <div className="flex flex-col gap-0.5 px-2 pt-1.5 pb-2">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-small text-faint">
                {vault.root}
              </span>
            </div>
            <Menu.Separator className="mx-1 my-1 h-px bg-line" />
            <Menu.Item className={item} onClick={() => void pickAndOpen()}>
              <ItemIcon>{toolbarIcons.openVault}</ItemIcon>
              {t("shell.openAnotherVault")}
            </Menu.Item>
            <Menu.Item className={item} onClick={close}>
              <ItemIcon>{toolbarIcons.closeVault}</ItemIcon>
              {t("shell.closeVault")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
