import { open } from "@tauri-apps/plugin-dialog";
import { toCorePath } from "./paths";

/**
 * Asks the user for a vault folder. Resolves to its absolute path, or `null`
 * if the dialog was cancelled. Picking a folder is also what grants the app
 * access to it and everything inside: the `fs` scope is extended to that
 * folder, and the `persisted-scope` plugin keeps the grant between runs.
 */
export async function pickVaultFolder(title?: string): Promise<string | null> {
  const path = await open({ directory: true, recursive: true, title });
  return path === null ? null : toCorePath(path);
}
