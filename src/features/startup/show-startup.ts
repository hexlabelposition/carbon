import { openDialog } from "../dialogs/open-dialog";

/** Opens the dialog with how the vault started (`StartupHost`). */
export function showStartup(): void {
  openDialog("startup");
}
