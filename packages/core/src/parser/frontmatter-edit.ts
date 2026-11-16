import {
  isMap,
  isScalar,
  isSeq,
  parse,
  parseDocument,
  type Document,
} from "yaml";
import { findFrontmatter } from "./frontmatter";

/** A change to one property of a frontmatter. */
export type PropertyEdit =
  /** Sets a key, adding it at the end if it is new. */
  | { kind: "set"; key: string; value: unknown }
  /** Gives a key another name, in its place, with its value. */
  | { kind: "rename"; from: string; to: string }
  | { kind: "remove"; key: string };

/** A change to a text: what goes in place of `from` to `to`. */
export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * The change to a note that makes `edit` in its frontmatter (C-408): the
 * YAML between the fences is written anew, so the rest of the note stays
 * as it is. Comments and the order of keys are kept; the layout of the
 * YAML may be made regular, such as the indent of lists. A note without
 * frontmatter gets one for a `set`.
 *
 * `null` when the edit cannot be made: YAML that does not parse or is no
 * mapping, a key that is not there to rename or remove, or a rename onto
 * a key that is.
 */
export function editFrontmatter(
  text: string,
  edit: PropertyEdit,
): TextChange | null {
  const found = findFrontmatter(text);
  if (found === null) {
    if (edit.kind !== "set") return null;
    const doc: Document = parseDocument("");
    doc.contents = doc.createNode({ [edit.key]: edit.value });
    return { from: 0, to: 0, insert: `---\n${write(doc)}---\n` };
  }

  // Not `Document.Parsed`: new nodes go into it.
  const doc: Document = parseDocument(found.yaml, { uniqueKeys: false });
  if (doc.errors.length > 0) return null;
  if (doc.contents === null) doc.contents = doc.createNode({});
  const map = doc.contents;
  if (!isMap(map)) return null;

  if (edit.kind === "set") {
    const value = doc.createNode(edit.value);
    const old = doc.get(edit.key, true);
    // A list written as "[a, b]" stays on one line.
    if (isSeq(old) && isSeq(value)) value.flow = old.flow;
    doc.set(edit.key, value);
  } else if (edit.kind === "rename") {
    if (edit.to === edit.from) return null;
    if (doc.has(edit.to)) return null;
    const pair = map.items.find((item) => keyOf(item.key) === edit.from);
    if (pair === undefined) return null;
    pair.key = doc.createNode(edit.to);
  } else {
    if (!doc.delete(edit.key)) return null;
  }

  // Between the opening fence and the closing one.
  const from = found.block.indexOf("\n") + 1;
  return { from, to: from + found.yaml.length, insert: write(doc) };
}

/**
 * The change to a note that renames tags in the `tags` of its
 * frontmatter, as written: `rename` gets each tag without "#" and gives
 * its new name, or `null` to keep it. One string keeps its commas and
 * spaces, a list its items and their quotes; a "#" in front stays.
 * `null` if no tag changes or the YAML does not parse.
 */
export function renameFrontmatterTags(
  text: string,
  rename: (tag: string) => string | null,
): TextChange | null {
  const found = findFrontmatter(text);
  if (found === null) return null;
  const doc: Document = parseDocument(found.yaml, { uniqueKeys: false });
  if (doc.errors.length > 0) return null;

  let changed = false;
  const renamed = (written: string): string => {
    const hash = written.startsWith("#") ? "#" : "";
    const next = rename(written.slice(hash.length));
    if (next === null) return written;
    changed = true;
    return hash + next;
  };
  const tags = doc.get("tags", true);
  if (isScalar(tags) && typeof tags.value === "string") {
    tags.value = tags.value.replace(/[^\s,]+/g, renamed);
  } else if (isSeq(tags)) {
    for (const item of tags.items) {
      if (isScalar(item) && typeof item.value === "string") {
        item.value = renamed(item.value.trim());
      }
    }
  }
  if (!changed) return null;
  const from = found.block.indexOf("\n") + 1;
  return { from, to: from + found.yaml.length, insert: write(doc) };
}

/** The YAML of a document, ending with a line break unless empty. */
function write(doc: Document): string {
  const map = doc.contents;
  if (isMap(map) && map.items.length === 0 && !doc.commentBefore) return "";
  // No folding: a long value stays on one line, as it was typed.
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

function keyOf(key: unknown): unknown {
  return key !== null && typeof key === "object" && "value" in key
    ? key.value
    : key;
}

/**
 * The value a property gets from what was typed for it, given the value
 * it had (`undefined` for a new one):
 *
 * - `tags` and `aliases`, and any list: the parts apart by commas, without
 *   the "#" before a tag.
 * - Text stays text, even "42": it was text before.
 * - Otherwise a number, `true`, `false`, or text as typed.
 *
 * Blank gives `null`, an empty value.
 */
export function propertyValue(
  key: string,
  input: string,
  old: unknown,
): unknown {
  if (key === "tags" || key === "aliases" || Array.isArray(old)) {
    return input
      .split(",")
      .map((part) => part.trim())
      .map((part) => (key === "tags" ? part.replace(/^#/, "") : part))
      .filter((part) => part !== "");
  }
  const text = input.trim();
  if (text === "") return null;
  if (typeof old === "string") return input;
  let read: unknown;
  try {
    read = parse(text);
  } catch {
    return input;
  }
  return typeof read === "number" || typeof read === "boolean" ? read : input;
}
