import type { SettingsStore } from "@carbon/core";
import { appConfigDir } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readTextFile,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { toCorePath } from "./paths";

let configDir: Promise<string> | undefined;

/** The folder the system gives the app for its settings. */
function dir(): Promise<string> {
  configDir ??= appConfigDir().then(toCorePath);
  return configDir;
}

/** `SettingsStore` as the file `settings.json` in the app config directory. */
export const tauriSettingsStore: SettingsStore = {
  async read() {
    const file = `${await dir()}/settings.json`;
    return (await exists(file)) ? readTextFile(file) : null;
  },

  async write(text) {
    const folder = await dir();
    const temp = `${folder}/settings.json.tmp`;
    // The folder does not exist before the first save.
    await mkdir(folder, { recursive: true });
    await writeTextFile(temp, text);
    await rename(temp, `${folder}/settings.json`);
  },
};
