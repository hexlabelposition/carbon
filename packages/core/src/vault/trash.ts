import type { EntryKind, FileSystem } from "../platform";
import { makeFolders } from "./entries";
import type { OwnChanges } from "./own-changes";
import {
  DRAFTS_FOLDER,
  isVaultPath,
  parentOf,
  resolveNewInVault,
  TRASH_FOLDER,
} from "./path";

/** A deleted note, file or folder that the trash keeps. */
export interface TrashItem {
  /** Names the item in the trash: the name of its folder there. */
  id: string;
  /** Where it was, relative to the vault root: where `restore` puts it. */
  path: string;
  kind: "folder" | "note" | "file";
  /** When it was deleted, milliseconds since the Unix epoch. */
  deletedAt: number;
}

export interface VaultTrashOptions {
  root: string;
  fs: FileSystem;
  own: OwnChanges;
  /** After the trash got, gave back or dropped something. */
  onChange: () => void;
}

/**
 * What an item folder says about the entry next to it. Hidden, so it can
 * never be the name of the entry: those are visible (`isVaultPath`).
 */
const INFO_FILE = ".item.json";

/**
 * The trash of a vault, in `.carbon/trash` (ADR-031). Each deleted entry
 * gets a folder of its own there, named by its id, which holds the entry
 * as it was and a small file that says where it was and when it went.
 * Hidden, so neither the tree, the watcher nor the index see it.
 */
export class VaultTrash {
  constructor(private readonly options: VaultTrashOptions) {}

  private get dir(): string {
    return `${this.options.root}/${TRASH_FOLDER}`;
  }

  /**
   * Moves the entry at `path`, relative to the vault root, into the trash.
   * Leaves it in place and rejects if that is not possible. Tells the
   * vault nothing about the entry being gone: the caller does.
   */
  async put(path: string, kind: EntryKind): Promise<void> {
    const { root, fs, onChange } = this.options;
    const id = await this.freeId(Date.now());
    const folder = `${this.dir}/${id}`;
    const item: TrashItem = {
      id,
      path,
      kind: kindOf(path, kind),
      deletedAt: Date.now(),
    };
    await fs.mkdir(folder);
    try {
      await fs.writeTextAtomic(
        `${folder}/${INFO_FILE}`,
        JSON.stringify({ path, kind: item.kind, deletedAt: item.deletedAt }),
      );
      await fs.rename(`${root}/${path}`, `${folder}/${nameOf(path)}`);
    } catch (error) {
      await fs.remove(folder, { recursive: true }).catch(() => {});
      throw error;
    }
    onChange();
  }

  /** What the trash holds, the latest deleted first. */
  async list(): Promise<TrashItem[]> {
    const { fs } = this.options;
    if (!(await fs.exists(this.dir))) return [];
    const entries = await fs.list(this.dir);
    const items = await Promise.all(
      entries
        .filter((entry) => entry.kind === "dir" && isId(entry.name))
        .map((entry) => this.read(entry.name).catch(() => null)),
    );
    return items
      .filter((found): found is Found => found !== null)
      .map(({ item }) => item)
      .sort((a, b) => b.deletedAt - a.deletedAt || (a.id < b.id ? 1 : -1));
  }

  /**
   * Puts an item back where it was, with the folders above it if they are
   * gone. If its place is taken, it gets a free name with a number, as
   * "Note 1.md". Resolves with the path it got.
   */
  async restore(id: string): Promise<string> {
    const { root, fs, own, onChange } = this.options;
    const { item, source } = await this.read(id);
    const target = await this.freePath(item.path, item.kind === "folder");
    const absolute = resolveNewInVault(root, target);
    await makeFolders({ root, fs, own, trash: this }, parentOf(absolute));
    await fs.rename(source, absolute);
    await own.wrote(absolute);
    await fs.remove(`${this.dir}/${id}`, { recursive: true });
    onChange();
    return target;
  }

  /** Deletes an item for good. */
  async remove(id: string): Promise<void> {
    if (!isId(id)) throw new Error(`Not in the trash: ${id}`);
    await this.options.fs.remove(`${this.dir}/${id}`, { recursive: true });
    this.options.onChange();
  }

  /** Deletes everything in the trash for good. */
  async empty(): Promise<void> {
    const { fs, onChange } = this.options;
    if (!(await fs.exists(this.dir))) return;
    await fs.remove(this.dir, { recursive: true });
    onChange();
  }

  /** The item `id` and the absolute path of its entry in the trash. */
  private async read(id: string): Promise<Found> {
    const { fs } = this.options;
    if (!isId(id)) throw new Error(`Not in the trash: ${id}`);
    const folder = `${this.dir}/${id}`;
    const entry = (await fs.list(folder)).find((e) => !e.name.startsWith("."));
    if (entry === undefined) throw new Error(`Not in the trash: ${id}`);
    const fallback: TrashItem = {
      id,
      path: entry.name,
      kind: kindOf(entry.name, entry.kind),
      deletedAt: Number.parseInt(id, 10) || 0,
    };
    let item = fallback;
    try {
      const info: unknown = JSON.parse(
        await fs.readText(`${folder}/${INFO_FILE}`),
      );
      item = { ...fallback, ...readInfo(info, entry.name) };
    } catch {
      // Without its info the item goes back to the root under its name.
    }
    return { item, source: `${folder}/${entry.name}` };
  }

  /** An id no item has: the time, and a number after it if needed. */
  private async freeId(time: number): Promise<string> {
    const { fs } = this.options;
    let id = String(time);
    for (let n = 1; await fs.exists(`${this.dir}/${id}`); n++) {
      id = `${time}-${n}`;
    }
    return id;
  }

  /** `path`, or the first free path with a number before the ending. */
  private async freePath(path: string, folder: boolean): Promise<string> {
    const { root, fs } = this.options;
    const name = nameOf(path);
    const ending = folder ? "" : (/(?<=.)\.[^.]+$/.exec(name)?.[0] ?? "");
    const base = path.slice(0, path.length - ending.length);
    let candidate = path;
    for (let n = 1; await fs.exists(`${root}/${candidate}`); n++) {
      candidate = `${base} ${n}${ending}`;
    }
    return candidate;
  }
}

interface Found {
  item: TrashItem;
  source: string;
}

/** Ids are made by `freeId`; anything else is not an item. */
function isId(id: string): boolean {
  return /^\d+(-\d+)?$/.test(id);
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function kindOf(path: string, kind: EntryKind): TrashItem["kind"] {
  if (kind === "dir") return "folder";
  return /\.md$/i.test(path) ? "note" : "file";
}

/**
 * The parts of an info file that can be trusted: a path back into the
 * vault that ends in the name of the entry, and a time.
 */
function readInfo(
  info: unknown,
  name: string,
): Partial<Pick<TrashItem, "path" | "deletedAt">> {
  if (typeof info !== "object" || info === null) return {};
  const { path, deletedAt } = info as Record<string, unknown>;
  const result: Partial<Pick<TrashItem, "path" | "deletedAt">> = {};
  if (
    typeof path === "string" &&
    nameOf(path) === name &&
    isVaultPath(path) &&
    path !== DRAFTS_FOLDER &&
    !path.split("/").some((s) => s === "" || s === "..")
  ) {
    result.path = path;
  }
  if (typeof deletedAt === "number") result.deletedAt = deletedAt;
  return result;
}
