import type { FileSystem } from "../platform";
import { CARBON_FOLDER } from "./path";

/** Where the bookmarks of a vault are kept, relative to its root. */
export const BOOKMARKS_FILE = `${CARBON_FOLDER}/bookmarks.json`;
/**
 * Where they were kept while they were called favorites (C-620): read when
 * there is no bookmarks file yet, and deleted once that is written.
 */
const OLD_FILE = `${CARBON_FOLDER}/favorites.json`;

export interface BookmarksOptions {
  root: string;
  fs: FileSystem;
  /** After the list changed. */
  onChange: () => void;
}

/**
 * The notes and files the user marked as bookmarks, in the order they
 * were added, kept in `.carbon/bookmarks.json` so they travel with the
 * vault. Moves and deletions made through the vault keep the list right;
 * an entry that another program moved away is left out of `list()` until
 * it is back.
 */
export class Bookmarks {
  /** The list as on disk; read once, then kept here. */
  private paths: Promise<string[]> | null = null;
  /** Writes one after another, so a later list never loses to an earlier. */
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly options: BookmarksOptions) {}

  /** The bookmarks that exist now, in the order they were added. */
  async list(): Promise<string[]> {
    const { root, fs } = this.options;
    const paths = await this.load();
    const found = await Promise.all(
      paths.map((path) => fs.exists(`${root}/${path}`)),
    );
    return paths.filter((_, i) => found[i]);
  }

  /** Whether `path` is a bookmark, whether it exists now or not. */
  async has(path: string): Promise<boolean> {
    return (await this.load()).includes(path);
  }

  /** Adds `path` at the end. Does nothing if it is a bookmark already. */
  async add(path: string): Promise<void> {
    const paths = await this.load();
    if (paths.includes(path)) return;
    await this.save([...paths, path]);
  }

  /** Takes `path` off the list. */
  async remove(path: string): Promise<void> {
    const paths = await this.load();
    if (!paths.includes(path)) return;
    await this.save(paths.filter((p) => p !== path));
  }

  /** The vault moved `from`, a file or a folder, to `to`. */
  async moved(from: string, to: string): Promise<void> {
    const paths = await this.load();
    if (!paths.some((p) => within(p, from))) return;
    await this.save(
      paths.map((p) => (within(p, from) ? to + p.slice(from.length) : p)),
    );
  }

  /** The vault deleted `path`, a file or a folder with all inside. */
  async removed(path: string): Promise<void> {
    const paths = await this.load();
    if (!paths.some((p) => within(p, path))) return;
    await this.save(paths.filter((p) => !within(p, path)));
  }

  private load(): Promise<string[]> {
    this.paths ??= this.read();
    return this.paths;
  }

  /** The list on disk; empty if there is none or it cannot be read. */
  private async read(): Promise<string[]> {
    const { root, fs } = this.options;
    try {
      const file = (await fs.exists(`${root}/${BOOKMARKS_FILE}`))
        ? BOOKMARKS_FILE
        : OLD_FILE;
      const data: unknown = JSON.parse(await fs.readText(`${root}/${file}`));
      const items =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>).items
          : undefined;
      if (!Array.isArray(items)) return [];
      return [
        ...new Set(
          items.filter(
            (p): p is string =>
              typeof p === "string" &&
              p !== "" &&
              !p.split("/").some((s) => s === "" || s === "." || s === ".."),
          ),
        ),
      ];
    } catch {
      return [];
    }
  }

  private async save(paths: string[]): Promise<void> {
    const { root, fs, onChange } = this.options;
    this.paths = Promise.resolve(paths);
    const text = `${JSON.stringify({ items: paths }, null, 2)}\n`;
    const write = this.writing.then(async () => {
      await fs.mkdir(`${root}/${CARBON_FOLDER}`);
      await fs.writeTextAtomic(`${root}/${BOOKMARKS_FILE}`, text);
      // Its list is in the new file now.
      if (await fs.exists(`${root}/${OLD_FILE}`)) {
        await fs.remove(`${root}/${OLD_FILE}`).catch(() => {});
      }
    });
    // A failed write must not stop the ones after it.
    this.writing = write.catch(() => {});
    onChange();
    await write;
  }
}

/** True if `path` is `folder` itself or something inside it. */
function within(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}
