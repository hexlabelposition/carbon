import type { Trash } from "@carbon/core";
import { invoke } from "@tauri-apps/api/core";

/** `Trash` on top of the `move_to_trash` command in `tauri/src/lib.rs`. */
export const tauriTrash: Trash = {
  async moveToTrash(path) {
    try {
      await invoke("move_to_trash", { path });
    } catch (reason) {
      // A command rejects with a plain string, the core expects an `Error`.
      throw new Error(String(reason), { cause: reason });
    }
  },
};
