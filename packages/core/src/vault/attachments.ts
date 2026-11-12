import type { NotePath } from "../types";
import { makeFolders, type VaultContext } from "./entries";
import { parentOf, resolveInVault, resolveNewInVault } from "./path";

/** The folder new attachments are saved to, relative to the vault root. */
export const ATTACHMENTS_FOLDER = "attachments";

/**
 * Files that notes show but that are not notes: images, for a start. Paths
 * are relative to the vault root.
 */
export class Attachments {
  constructor(private readonly context: VaultContext) {}

  /** Reads a file of the vault as bytes. */
  async read(path: string): Promise<Uint8Array> {
    const { root, fs } = this.context;
    return fs.readBytes(resolveInVault(root, path));
  }

  /**
   * Saves a new attachment into the attachments folder and resolves with
   * its path. Nothing is ever overwritten: if the name is taken, a number
   * is added to it ("photo.png", then "photo-1.png").
   */
  async save(fileName: string, bytes: Uint8Array): Promise<string> {
    return this.add(fileName, (target) =>
      this.context.fs.writeBytesAtomic(target, bytes),
    );
  }

  /**
   * Copies a file from outside the vault into the attachments folder, under
   * its own name, and resolves with its path in the vault. `source` is an
   * absolute path on the device, `/` separated. The file itself stays
   * where it is.
   */
  async import(source: string): Promise<string> {
    return this.add(source, (target) =>
      this.context.fs.importFile(source, target),
    );
  }

  /** Finds a free name in the attachments folder and puts a file there. */
  private async add(
    fileName: string,
    put: (target: string) => Promise<void>,
  ): Promise<string> {
    const { root, fs, own } = this.context;
    const name = safeName(fileName);
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ending = dot > 0 ? name.slice(dot) : "";

    await makeFolders(this.context, `${root}/${ATTACHMENTS_FOLDER}`);
    for (let n = 0; ; n++) {
      const path = `${ATTACHMENTS_FOLDER}/${stem}${n === 0 ? "" : `-${n}`}${ending}`;
      const target = resolveNewInVault(root, path);
      if (await fs.exists(target)) continue;
      await put(target);
      await own.wrote(target);
      return path;
    }
  }

  /**
   * Finds the file a note points at with `target`, the address written in
   * `![alt](target)`. The address is tried relative to the folder of the
   * note, as Markdown means it, then relative to the vault root. Resolves
   * with `null` if it is not a file of this vault: a web address, a path
   * that leaves the vault, or nothing there.
   */
  async find(note: NotePath, target: string): Promise<string | null> {
    const { root, fs } = this.context;
    const address = decodeTarget(target);
    if (address === null) return null;
    const candidates = [
      normalize(`${parentOf(note)}/${address}`),
      normalize(address),
    ];
    for (const path of candidates) {
      if (path === null) continue;
      const stat = await fs.stat(resolveInVault(root, path)).catch(() => null);
      if (stat?.kind === "file") return path;
    }
    return null;
  }
}

/**
 * The address to write in a note at `note` so that it points at the vault
 * file `path`: relative to the folder of the note, and escaped so it can
 * stand inside `![alt](...)` whatever characters the name has.
 */
export function attachmentLink(note: NotePath, path: string): string {
  const from = note.split("/").slice(0, -1);
  const to = path.split("/");
  let common = 0;
  while (
    common < from.length &&
    common < to.length - 1 &&
    from[common] === to[common]
  ) {
    common++;
  }
  const up = from.slice(common).map(() => "..");
  return [...up, ...to.slice(common)].map(escapeSegment).join("/");
}

/** Percent-escapes what would end or confuse a Markdown link address. */
function escapeSegment(segment: string): string {
  return segment === ".."
    ? segment
    : encodeURIComponent(segment).replace(
        /[()]/g,
        (c) => `%${c.charCodeAt(0).toString(16)}`,
      );
}

/** The path a link address stands for, or `null` if it is not a local path. */
function decodeTarget(target: string): string | null {
  let address = target.trim();
  // An address with spaces is written as `<my file.png>`.
  if (address.startsWith("<") && address.endsWith(">")) {
    address = address.slice(1, -1);
  }
  // "https:", "data:", "//host" and "#heading" are not files of the vault.
  if (address === "" || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(address)) {
    return null;
  }
  try {
    return decodeURIComponent(address);
  } catch {
    // A stray "%" that is not an escape: take the address as written.
    return address;
  }
}

/** Resolves "." and ".."; `null` if the path climbs out of the vault. */
function normalize(path: string): string | null {
  const segments: string[] = [];
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else segments.push(segment);
  }
  return segments.length === 0 ? null : segments.join("/");
}

/** A file name that is one visible path segment on every system. */
function safeName(fileName: string): string {
  // A name that comes with a path keeps only its last part.
  const last = fileName.split(/[\\/]/).pop() ?? "";
  const name = last
    .replace(/[:*?"<>|]/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return name === "" ? "attachment" : name;
}
