import type { FileSystem } from "../platform";
import { CARBON_FOLDER } from "./path";

/** The settings that travel with a vault, relative to its root (4.1). */
export const CONFIG_FILE = `${CARBON_FOLDER}/config.json`;

/**
 * The id of the vault at `root`: the one in `.carbon/config.json`, or a
 * new one written there with what else the file holds. It stays when the
 * folder is moved or renamed; a copy of the folder has the same id.
 *
 * A vault that cannot be written to, as on a read-only drive, still gets
 * an id, only a new one each time it opens.
 */
export async function vaultId(root: string, fs: FileSystem): Promise<string> {
  const path = `${root}/${CONFIG_FILE}`;
  const config = await readConfig(fs, path);
  if (config !== null && isId(config.id)) return config.id;
  const id = crypto.randomUUID();
  // A file that could not be parsed is not overwritten: what the user
  // wrote there would be lost. The id then lasts until the vault closes.
  if (config === null && (await fs.exists(path))) return id;
  try {
    await fs.mkdir(`${root}/${CARBON_FOLDER}`);
    const text = `${JSON.stringify({ ...config, id }, null, 2)}\n`;
    await fs.writeTextAtomic(path, text);
  } catch {
    // Read-only: as above.
  }
  return id;
}

/** The settings as an object; `{}` with no file, `null` if unreadable. */
async function readConfig(
  fs: FileSystem,
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    if (!(await fs.exists(path))) return {};
    const data: unknown = JSON.parse(await fs.readText(path));
    return typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** An id is any short line of text: one written by hand is kept too. */
function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= 200 &&
    !/[\r\n]/.test(value)
  );
}
