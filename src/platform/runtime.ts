import { isTauri } from "@tauri-apps/api/core";

/**
 * Whether the page runs inside the Tauri app, not in a plain web browser
 * such as one pointed at the dev server. Apart from the rest of the
 * platform, so asking loads nothing else of Tauri.
 */
export function insideTauri(): boolean {
  return isTauri();
}
