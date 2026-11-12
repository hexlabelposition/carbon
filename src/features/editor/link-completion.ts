import {
  autocompletion,
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { NotePath } from "@carbon/core";

/** What the editor needs to suggest notes to link to. */
export interface LinkHost {
  /** Every note of the vault. */
  notes(): Promise<readonly NotePath[]>;
  /** The note being edited: it is not suggested. */
  current: NotePath;
}

/** The link host of an editor. Without one, nothing is suggested. */
export const linkHost = Facet.define<LinkHost, LinkHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/**
 * Suggests notes after "[[": the list narrows while the user types, and
 * picking a note writes its name and closes the link with "]]". Typing
 * on goes on as usual; Escape closes the list.
 */
export const linkCompletion = [
  autocompletion({ override: [suggestNotes], icons: false }),
  EditorView.baseTheme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "6px",
      backgroundColor: "var(--cb-panel)",
      overflow: "hidden",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-sans)",
      fontSize: "14px",
      maxHeight: "16em",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      padding: "3px 10px",
      color: "var(--cb-fg)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--cb-selected)",
      color: "var(--cb-fg)",
    },
    ".cm-completionMatchedText": {
      textDecoration: "none",
      fontWeight: "600",
    },
    ".cm-completionDetail": {
      marginLeft: "12px",
      fontStyle: "normal",
      color: "var(--cb-faint)",
    },
  }),
];

/** Characters that end the note name of a wiki link. */
const NAME_END = /[[\]|#\n]/;

async function suggestNotes(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { state, pos } = context;
  const typed = context.matchBefore(/\[\[[^[\]|#\n]*/);
  const host = state.facet(linkHost);
  if (typed === null || host === null) return null;

  const from = typed.from + 2;
  const line = state.doc.lineAt(pos);
  let end = pos;
  while (end < line.to && !NAME_END.test(state.sliceDoc(end, end + 1))) end++;
  // "]]", "|alias" or "#heading" follows: the link is already closed, and
  // the rest of its name is replaced too. In a link not closed yet, the
  // text after the cursor is not part of it.
  const closed = /^(\]\]|[|#])/.test(state.sliceDoc(end, end + 2));
  const to = closed ? end : pos;

  const notes = (await host.notes()).filter((path) => path !== host.current);
  if (context.aborted) return null;
  const titleCount = new Map<string, number>();
  for (const path of notes) {
    const key = titleOf(path).toLowerCase();
    titleCount.set(key, (titleCount.get(key) ?? 0) + 1);
  }

  const options = notes.map((path): Completion => {
    const title = titleOf(path);
    // Two notes of one name: the path tells which one is meant.
    const unique = titleCount.get(title.toLowerCase()) === 1;
    const name = unique ? title : path.replace(/\.md$/i, "");
    const folder = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : undefined;
    return {
      label: title,
      detail: folder,
      apply: (view, completion, start, end) => {
        const insert = closed ? name : `${name}]]`;
        view.dispatch({
          changes: { from: start, to: end, insert },
          selection: { anchor: start + insert.length },
          userEvent: "input.complete",
          annotations: pickedCompletion.of(completion),
        });
      },
    };
  });
  return { from, to, options, validFor: /^[^[\]|#\n]*$/ };
}

function titleOf(path: NotePath): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}
