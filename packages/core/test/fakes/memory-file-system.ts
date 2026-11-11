import type { Entry, FileSystem, RemoveOptions, Stat } from "../../src/index";

interface FileNode {
  content: string;
  mtime: number;
}

/**
 * An in-memory `FileSystem`. Paths are absolute and `/` separated, like the
 * real adapters. Modification times come from a counter, so tests are
 * deterministic: every write is one tick later than the previous one.
 */
export class MemoryFileSystem implements FileSystem {
  private readonly files = new Map<string, FileNode>();
  private readonly dirs = new Set<string>(["/"]);
  private clock = 0;

  /** Seeds files from a `path -> content` map, creating parent folders. */
  constructor(files: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(files)) {
      this.addDirs(parentOf(path));
      this.files.set(path, { content, mtime: ++this.clock });
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async mkdir(dir: string): Promise<void> {
    this.addDirs(dir);
  }

  private addDirs(dir: string): void {
    for (let d = dir; !this.dirs.has(d); d = parentOf(d)) {
      if (this.files.has(d)) throw new Error(`ENOTDIR: ${d}`);
      this.dirs.add(d);
    }
  }

  async readText(path: string): Promise<string> {
    return this.file(path).content;
  }

  async writeTextAtomic(path: string, content: string): Promise<void> {
    if (this.dirs.has(path)) throw new Error(`EISDIR: ${path}`);
    this.dir(parentOf(path));
    this.files.set(path, { content, mtime: ++this.clock });
  }

  async list(dir: string): Promise<Entry[]> {
    this.dir(dir);
    const entries: Entry[] = [];
    for (const path of this.dirs) {
      if (path !== dir && parentOf(path) === dir) {
        entries.push({ name: nameOf(path), kind: "dir" });
      }
    }
    for (const path of this.files.keys()) {
      if (parentOf(path) === dir) {
        entries.push({ name: nameOf(path), kind: "file" });
      }
    }
    return entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  async stat(path: string): Promise<Stat> {
    if (this.dirs.has(path)) return { kind: "dir", size: 0, mtime: 0 };
    const file = this.file(path);
    return { kind: "file", size: byteLength(file.content), mtime: file.mtime };
  }

  async rename(from: string, to: string): Promise<void> {
    this.dir(parentOf(to));
    const file = this.files.get(from);
    if (file) {
      if (this.dirs.has(to)) throw new Error(`EISDIR: ${to}`);
      this.files.delete(from);
      this.files.set(to, file);
      return;
    }
    this.dir(from);
    if (this.files.has(to) || this.dirs.has(to)) {
      throw new Error(`EEXIST: ${to}`);
    }
    const moved = (path: string) => to + path.slice(from.length);
    for (const path of [...this.dirs].filter((p) => isWithin(p, from))) {
      this.dirs.delete(path);
      this.dirs.add(moved(path));
    }
    for (const [path, node] of [...this.files]) {
      if (!isWithin(path, from)) continue;
      this.files.delete(path);
      this.files.set(moved(path), node);
    }
  }

  async remove(path: string, options?: RemoveOptions): Promise<void> {
    if (this.files.delete(path)) return;
    this.dir(path);
    if (!options?.recursive && (await this.list(path)).length > 0) {
      throw new Error(`ENOTEMPTY: ${path}`);
    }
    for (const file of [...this.files.keys()]) {
      if (isWithin(file, path)) this.files.delete(file);
    }
    for (const dir of [...this.dirs]) {
      if (isWithin(dir, path)) this.dirs.delete(dir);
    }
  }

  private file(path: string): FileNode {
    const file = this.files.get(path);
    if (file) return file;
    throw new Error(`${this.dirs.has(path) ? "EISDIR" : "ENOENT"}: ${path}`);
  }

  private dir(path: string): void {
    if (this.dirs.has(path)) return;
    throw new Error(`${this.files.has(path) ? "ENOTDIR" : "ENOENT"}: ${path}`);
  }
}

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/")) || "/";
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function isWithin(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}/`);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
