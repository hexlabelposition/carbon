import type { EditorState } from "@codemirror/state";

/** The longest a frontmatter is looked for; past that it is text. */
const LOOKUP = 65536;

/**
 * Where the frontmatter at the start of the note ends: the end of the
 * "---" or "..." line that closes it, after a "---" first line, as the
 * core finds it (`readFrontmatter`). `null` without one. Lines are
 * checked, not parsed: the Markdown grammar of the editor does not know
 * frontmatter.
 */
export function frontmatterEnd(state: EditorState): number | null {
  if (!/^---[ \t]*$/.test(state.doc.line(1).text)) return null;
  const limit = Math.min(state.doc.length, LOOKUP);
  for (let n = 2; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (line.from > limit) return null;
    if (/^(---|\.\.\.)[ \t]*$/.test(line.text)) return line.to;
  }
  return null;
}
