import { open } from "@tauri-apps/plugin-dialog";
import { toCorePath } from "./paths";

/**
 * Asks the user for a vault folder. Resolves to its absolute path, or `null`
 * if the dialog was cancelled. Picking a folder is also what grants the app
 * access to it: the `fs` scope is extended to that folder for this session.
 */
export async function pickVaultFolder(): Promise<string | null> {
  const path = await open({ directory: true, recursive: true });
  return path === null ? null : toCorePath(path);
}
