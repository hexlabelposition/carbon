import { parseDocument } from "yaml";
import { matchKey } from "../links/resolve";
import { isTagLabel } from "./hashtag";

/** What the frontmatter of a note gives the index. */
export interface Frontmatter {
  tags: string[];
  aliases: string[];
  /** Every other key, with its value as YAML reads it. */
  properties: Record<string, unknown>;
}

/**
 * The frontmatter block at the start of a note: "---" on the first line,
 * then the YAML, then "---" or "..." on a line of its own.
 */
const BLOCK = /^---[ \t]*\r?\n((?:.*\r?\n)*?)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/** The whole block and the YAML inside it; `null` without frontmatter. */
export function findFrontmatter(
  text: string,
): { block: string; yaml: string } | null {
  const match = BLOCK.exec(text);
  return match === null ? null : { block: match[0], yaml: match[1] };
}

/**
 * Reads the frontmatter of a note (ARCHITECTURE.md, section 4.2).
 *
 * - `tags`: a list, or one string with the tags apart by commas or
 *   spaces. "#" before a tag is allowed. A tag follows the rules of an
 *   inline tag (`isTagLabel`); anything else is dropped. Tags that
 *   differ only in case are one, written as the first of them.
 * - `aliases`: a list, or one string as a single alias. Numbers count
 *   as text; other values are dropped, and so are repeats.
 * - `properties`: every other key.
 *
 * YAML that does not parse, or that is not a mapping, gives nothing: a
 * typo in the frontmatter must not stop the note from being indexed.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const empty: Frontmatter = { tags: [], aliases: [], properties: {} };
  const found = findFrontmatter(text);
  if (found === null) return empty;

  // A repeated key is a mistake YAML refuses; the last one wins instead,
  // as the rest of the frontmatter is still worth reading.
  const doc = parseDocument(found.yaml, { uniqueKeys: false });
  if (doc.errors.length > 0) return empty;
  const data: unknown = doc.toJS();
  if (!isRecord(data)) return empty;

  const { tags, aliases, ...properties } = data;
  return {
    tags: tagsOf(tags),
    aliases: aliasesOf(aliases),
    properties,
  };
}

function tagsOf(value: unknown): string[] {
  const items =
    typeof value === "string"
      ? value.split(/[\s,]+/)
      : Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
  return unique(
    items
      .map((item) => item.trim().replace(/^#/, ""))
      .filter((tag) => isTagLabel(tag)),
  );
}

function aliasesOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return unique(
    items
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter((alias) => alias !== ""),
  );
}

/** Each value once, ignoring case, as the first of them is written. */
export function unique(values: string[]): string[] {
  const kept = new Map<string, string>();
  for (const value of values) {
    const key = matchKey(value);
    if (!kept.has(key)) kept.set(key, value);
  }
  return [...kept.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
