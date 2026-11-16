import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { Facet, type EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { TagCount } from "@carbon/core";
import { frontmatterEnd } from "./frontmatter-range";

/** What the editor needs to suggest tags. */
export interface TagHost {
  /**
   * The tags to offer in the note being edited, whose text has the tags
   * `written` (`Tags.suggestions`).
   */
  suggestions(written: readonly string[]): Promise<readonly TagCount[]>;
}

/** The tag host of an editor. Without one, no tags are suggested. */
export const tagHost = Facet.define<TagHost, TagHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/** What a tag label may hold while it is typed: see `hashtag`. */
const LABEL = /^[\p{L}\p{N}\p{M}_/-]*$/u;

/**
 * Suggests tags of the vault while a tag is typed: after "#" and a
 * letter, or after "#" alone when asked for (Ctrl+Space). The list
 * narrows while the user types, a nested tag included; picking one
 * replaces the whole label. A tag is only where the grammar finds one
 * (`hashtag`), so nothing is suggested in code, links or headings, nor
 * in the frontmatter, where "#" starts a YAML comment.
 */
export async function suggestTags(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { state, pos } = context;
  const host = state.facet(tagHost);
  if (host === null) return null;
  const span = typedLabel(state, pos, context.explicit);
  if (span === null || inFrontmatter(state, pos)) return null;

  const written = writtenTags(state, span.from);
  const suggestions = await host.suggestions(written);
  if (context.aborted) return null;
  const typed = state.sliceDoc(span.from, pos).toLowerCase();
  // The tag as typed so far is no suggestion, and each tag is one.
  const seen = new Set([typed]);
  const options: Completion[] = [];
  for (const { tag, count } of suggestions) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ label: tag, detail: String(count) });
  }
  return { from: span.from, to: span.to, options, validFor: LABEL };
}

/**
 * The label of the tag the cursor is at the end of, or inside: where it
 * starts and ends. `#` alone, with the cursor after it, counts only when
 * asked for, as the grammar has no tag without a letter yet.
 */
function typedLabel(
  state: EditorState,
  pos: number,
  explicit: boolean,
): { from: number; to: number } | null {
  const node = syntaxTree(state).resolveInner(pos, -1);
  const label = labelOf(node);
  if (label !== null) return { from: label.from, to: label.to };
  if (!explicit || state.sliceDoc(pos - 1, pos) !== "#") return null;
  const before = state.sliceDoc(pos - 2, pos - 1);
  if (pos - 1 > state.doc.lineAt(pos).from && !/\s/.test(before)) return null;
  // Not in code, a link or a heading mark: the same places as a tag.
  const inside = syntaxTree(state).resolveInner(pos - 1, 1);
  for (let n: SyntaxNode | null = inside; n !== null; n = n.parent) {
    if (/Code|Link|URL|HeaderMark|Comment|HTML/.test(n.name)) return null;
  }
  return { from: pos, to: pos };
}

function labelOf(node: SyntaxNode): SyntaxNode | null {
  if (node.name === "HashtagLabel") return node;
  if (node.name === "Hashtag") return node.getChild("HashtagLabel");
  return null;
}

/** The tags in the note, but the one whose label starts at `except`. */
function writtenTags(state: EditorState, except: number): string[] {
  const tags: string[] = [];
  syntaxTree(state).iterate({
    enter({ name, from, to }) {
      if (name === "HashtagLabel" && from !== except) {
        tags.push(state.sliceDoc(from, to));
      }
    },
  });
  return tags;
}

/** Whether `pos` is inside the frontmatter at the start of the note. */
function inFrontmatter(state: EditorState, pos: number): boolean {
  const end = frontmatterEnd(state);
  return end !== null && pos <= end;
}
