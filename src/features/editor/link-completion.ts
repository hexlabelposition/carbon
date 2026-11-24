import {
  autocompletion,
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Link, NoteAlias, NotePath } from "@carbon/core";
import type { OpenTarget } from "../workspace/workspace";
import type { LinkPreview, PreviewedLink } from "./link-preview";
import { headingsOf, type Heading } from "./outline";
import { suggestTags } from "./tag-completion";
import {
  suggestCalloutTypes,
  suggestCodeLanguages,
} from "./markdown-completion";

/** What the editor needs to suggest notes to link to, and to follow links. */
export interface LinkHost {
  /** Every note of the vault. */
  notes(): Promise<readonly NotePath[]>;
  /** Every alias of every note; empty while the index is not open. */
  aliases(): Promise<readonly NoteAlias[]>;
  /** The note being edited: it is not suggested. */
  current: NotePath;
  /**
   * The headings of the note `[[target]]` points to, from the note being
   * edited. Empty if it points to none.
   */
  headings(target: string): Promise<readonly Heading[]>;
  /**
   * Of the targets of wiki links of the current note, as written, the
   * ones that find no note.
   */
  missing(targets: readonly string[]): Promise<ReadonlySet<string>>;
  /**
   * Calls `listener` whenever the notes that links find may have changed.
   * Returns a function that stops it.
   */
  onIndexChange(listener: () => void): () => void;
  /** What a hover over a link of the current note shows. */
  preview(link: PreviewedLink): Promise<LinkPreview>;
  /** Opens the note a link of the current note points to. */
  follow(
    link: Pick<Link, "kind" | "target">,
    options: { target: OpenTarget },
  ): void;
}

/**
 * The link host of an editor. Without one, nothing is suggested and no
 * link is followed.
 */
export const linkHost = Facet.define<LinkHost, LinkHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/**
 * Suggests notes after "[[", by their names and their aliases, and their
 * headings after "[[Note#" (the headings of this note after "[[#"): the
 * list narrows while the user types, and picking one writes it and closes
 * the link with "]]". An alias is written as `[[Note|alias]]`, so the
 * link finds the note by its name and reads as the alias. Typing on goes
 * on as usual; Escape closes the list.
 */
export const linkCompletion = [
  // Tags, the languages of code blocks and the types of callouts too: the
  // editor has one list of suggestions for all of them.
  autocompletion({
    override: [
      suggestNotes,
      suggestHeadings,
      suggestTags,
      suggestCodeLanguages,
      suggestCalloutTypes,
    ],
    icons: false,
  }),
  // As the menus of the app (`EditorContextMenu`, `VaultMenu`): a card
  // with a hairline and a shadow, rows of 28 pixels lit as when hovered,
  // the hint at the right. A theme, not a base theme: base themes lose to
  // the one of the suggestions themselves, which sets a monospace font.
  EditorView.theme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
      border: "1px solid var(--cb-line)",
      borderRadius: "var(--radius-md)",
      backgroundColor: "var(--cb-bg)",
      boxShadow: "var(--cb-shadow-dialog)",
      padding: "4px",
      overflow: "hidden",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
      lineHeight: "1.4",
      minWidth: "14rem",
      maxWidth: "min(28rem, 90vw)",
      // Ten rows, then it scrolls, with the thin bar of the app.
      maxHeight: "17.5rem",
      scrollbarWidth: "thin",
      scrollbarColor: "var(--cb-line-strong) transparent",
      // The rows end short of the bar, the lit one too.
      paddingRight: "4px",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "24px",
      height: "28px",
      padding: "0 8px",
      borderRadius: "var(--radius-sm)",
      color: "var(--cb-fg)",
      cursor: "default",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--cb-raise)",
      color: "var(--cb-fg)",
    },
    ".cm-completionLabel": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    ".cm-completionMatchedText": {
      textDecoration: "none",
      fontWeight: "600",
    },
    ".cm-completionDetail": {
      flexShrink: "0",
      marginLeft: "0",
      fontStyle: "normal",
      fontSize: "12px",
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
  const { to, closed } = partEnd(state, pos, NAME_END, /^(\]\]|[|#])/);

  const [allNotes, aliases] = await Promise.all([host.notes(), host.aliases()]);
  if (context.aborted) return null;
  const notes = allNotes.filter((path) => path !== host.current);
  // "[[Alias|" or "[[Alias#" has its next part written already: only the
  // note goes in, as there is no room for the alias.
  const nextPart = /^[|#]/.test(state.sliceDoc(to, to + 1));
  const titleCount = new Map<string, number>();
  for (const path of notes) {
    const key = titleOf(path).toLowerCase();
    titleCount.set(key, (titleCount.get(key) ?? 0) + 1);
  }

  /** How a link names the note: two notes of one name need the path. */
  const nameOf = (path: NotePath) => {
    const title = titleOf(path);
    return titleCount.get(title.toLowerCase()) === 1
      ? title
      : path.replace(/\.md$/i, "");
  };
  const write = (text: string): Completion["apply"] => {
    const insert = closed ? text : `${text}]]`;
    return (view, completion, start, end) => {
      view.dispatch({
        changes: { from: start, to: end, insert },
        selection: { anchor: start + insert.length },
        userEvent: "input.complete",
        annotations: pickedCompletion.of(completion),
      });
    };
  };

  const options = notes.map((path): Completion => {
    const folder = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : undefined;
    return { label: titleOf(path), detail: folder, apply: write(nameOf(path)) };
  });
  for (const { path, alias } of aliases) {
    if (path === host.current) continue;
    // An alias that is the name of its note adds nothing to the list; one
    // with a character that ends a part of a link cannot be typed or
    // written into one.
    if (alias.toLowerCase() === titleOf(path).toLowerCase()) continue;
    if (NAME_END.test(alias)) continue;
    const name = nameOf(path);
    options.push({
      label: alias,
      detail: `→ ${titleOf(path)}`,
      apply: write(nextPart ? name : `${name}|${alias}`),
    });
  }
  return { from, to, options, validFor: /^[^[\]|#\n]*$/ };
}

/**
 * A heading as it can be written after "#" in a wiki link: the characters
 * that end the link or its parts are left out.
 */
export function asFragment(heading: string): string {
  return heading
    .replace(/[[\]|#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Characters that end the heading of a wiki link. */
const HEADING_END = /[[\]|\n]/;

async function suggestHeadings(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { state, pos } = context;
  const typed = context.matchBefore(/\[\[[^[\]|#\n]*#[^[\]|#\n]*/);
  const host = state.facet(linkHost);
  if (typed === null || host === null) return null;

  const written = state.sliceDoc(typed.from + 2, typed.to);
  const hash = written.indexOf("#");
  const target = written.slice(0, hash).trim();
  const from = typed.from + 2 + hash + 1;
  const { to, closed } = partEnd(state, pos, HEADING_END, /^(\]\]|\|)/);

  // "[[#": a heading of this note, as it is now, saved or not.
  const headings =
    target === "" ? headingsOf(state) : await host.headings(target);
  if (context.aborted) return null;

  const seen = new Set<string>();
  const options: Completion[] = [];
  for (const { level, text } of headings) {
    const name = asFragment(text);
    if (name === "" || seen.has(name)) continue;
    seen.add(name);
    options.push({
      label: name,
      detail: "#".repeat(level),
      apply: (view, completion, start, end) => {
        const insert = closed ? name : `${name}]]`;
        view.dispatch({
          changes: { from: start, to: end, insert },
          selection: { anchor: start + insert.length },
          userEvent: "input.complete",
          annotations: pickedCompletion.of(completion),
        });
      },
    });
  }
  return { from, to, options, validFor: /^[^[\]|#\n]*$/ };
}

/**
 * Where the part of a link the cursor is in ends. If `closing` follows,
 * the link is already closed and the rest of the part is replaced too; in
 * a link not closed yet, the text after the cursor is not part of it.
 */
function partEnd(
  state: CompletionContext["state"],
  pos: number,
  partEnds: RegExp,
  closing: RegExp,
): { to: number; closed: boolean } {
  const line = state.doc.lineAt(pos);
  let end = pos;
  while (end < line.to && !partEnds.test(state.sliceDoc(end, end + 1))) end++;
  const closed = closing.test(state.sliceDoc(end, end + 2));
  return { to: closed ? end : pos, closed };
}

function titleOf(path: NotePath): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}
