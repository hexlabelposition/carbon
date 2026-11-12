import type { Entry, FileSystem, Stat } from "@carbon/core";
import { invoke } from "@tauri-apps/api/core";
import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

/** `FileSystem` on top of the Tauri `fs` plugin. */
export const tauriFileSystem: FileSystem = {
  readText: (path) => readTextFile(path),

  async writeTextAtomic(path, content) {
    const tmp = tempPathFor(path);
    try {
      await writeTextFile(tmp, content);
      await rename(tmp, path);
    } catch (error) {
      await remove(tmp).catch(() => {});
      throw error;
    }
  },

  readBytes: (path) => readFile(path),

  async importFile(source, target) {
    try {
      await invoke("import_file", { source, target });
    } catch (reason) {
      // A command rejects with a plain string, the core expects an `Error`.
      throw new Error(String(reason), { cause: reason });
    }
  },

  async writeBytesAtomic(path, bytes) {
    const tmp = tempPathFor(path);
    try {
      await writeFile(tmp, bytes);
      await rename(tmp, path);
    } catch (error) {
      await remove(tmp).catch(() => {});
      throw error;
    }
  },

  async list(dir) {
    const entries: Entry[] = [];
    for (const entry of await readDir(dir)) {
      // Symlinks are neither: they are skipped so a link cannot lead outside
      // the vault or form a cycle.
      if (entry.isDirectory) entries.push({ name: entry.name, kind: "dir" });
      else if (entry.isFile) entries.push({ name: entry.name, kind: "file" });
    }
    return entries;
  },

  async stat(path): Promise<Stat> {
    const info = await stat(path);
    return {
      kind: info.isDirectory ? "dir" : "file",
      size: info.size,
      mtime: info.mtime?.getTime() ?? 0,
    };
  },

  exists: (path) => exists(path),
  mkdir: (path) => mkdir(path, { recursive: true }),
  rename: (from, to) => rename(from, to),
  remove: (path, options) => remove(path, { recursive: options?.recursive }),
};

/**
 * A hidden sibling of the target: same folder, so the rename stays on one
 * file system and is atomic; hidden, so the indexer ignores it.
 */
function tempPathFor(path: string): string {
  const slash = path.lastIndexOf("/");
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${path.slice(0, slash + 1)}.${path.slice(slash + 1)}.${suffix}.tmp`;
}
