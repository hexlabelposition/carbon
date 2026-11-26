import { syntaxTree } from "@codemirror/language";
import { Facet, type EditorState, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { createContext, useContext } from "react";
import { log } from "../log/log";

/** A link to a web page or an email address, as it is opened. */
export interface WebLink {
  /** What the system opens: `https://…`, `http://…` or `mailto:…`. */
  url: string;
  /** An email address: it opens the mail app, not the browser. */
  email: boolean;
}

/** Opens a web page in the browser, or an email address in the mail app. */
export type OpenWebLink = (url: string) => Promise<void>;

/** How the app opens web links; without one, they are not opened. */
export const WebLinkContext = createContext<OpenWebLink | null>(null);

export function useOpenWebLink(): OpenWebLink | null {
  return useContext(WebLinkContext);
}

/** The opener of an editor, from `WebLinkContext`. */
export const webLinkOpener = Facet.define<
  OpenWebLink | null,
  OpenWebLink | null
>({
  combine: (openers) => openers[0] ?? null,
});

/** The schemes opened outside the app: nothing that runs or reads files. */
const OPENED = /^(https?:\/\/|mailto:)/i;
const EMAIL = /^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/;

/**
 * The web link or email address at `pos`: a Markdown link to one, an
 * address in angle brackets, or one written bare in the text (GFM). `null`
 * on anything else, as a link to a note or an image.
 */
export function webLinkAt(state: EditorState, pos: number): WebLink | null {
  for (const side of [1, -1] as const) {
    for (
      let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);
      node !== null;
      node = node.parent
    ) {
      if (node.name === "Image" || node.name === "WikiLink") return null;
      if (node.name === "Link" || node.name === "Autolink") {
        const url = node.getChild("URL");
        return url === null
          ? null
          : toWebLink(state.sliceDoc(url.from, url.to));
      }
      // Written bare in the text, GFM makes it a URL of its own; in a
      // link or angle brackets, the node above it is the one.
      if (node.name === "URL") {
        const parent = node.parent?.name;
        if (parent === "Image") return null;
        if (parent === "Link" || parent === "Autolink") continue;
        return toWebLink(state.sliceDoc(node.from, node.to));
      }
    }
  }
  return null;
}

/** What the address written in a note opens, if it is opened at all. */
function toWebLink(written: string): WebLink | null {
  const address = written.replace(/^<|>$/g, "").trim();
  if (OPENED.test(address)) {
    return { url: address, email: /^mailto:/i.test(address) };
  }
  if (/^www\./i.test(address))
    return { url: `https://${address}`, email: false };
  if (EMAIL.test(address)) return { url: `mailto:${address}`, email: true };
  return null;
}

/**
 * Ctrl+click, or Cmd+click, on a web link or an email address opens it in
 * the browser or the mail app; in reading mode a plain click does. After
 * the links to notes (`followOnModClick`), which take the click first.
 */
export const openWebLinkOnClick = [
  EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0 || event.shiftKey || event.altKey) return false;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod && !view.state.readOnly) return false;
      const open = view.state.facet(webLinkOpener);
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (open === null || pos === null) return false;
      const link = webLinkAt(view.state, pos);
      if (link === null) return false;
      event.preventDefault();
      open(link.url).catch((reason: unknown) =>
        log.error("Could not open a link", reason),
      );
      return true;
    },
  }),
];

const webLinkMark = Decoration.mark({ class: "cm-web-link" });

/**
 * The web links and email addresses in sight: the text of a Markdown link
 * to one, an address in angle brackets or one written bare.
 */
function webLinkMarks(view: EditorView): DecorationSet {
  const { state } = view;
  const ranges: Range<Decoration>[] = [];
  const opens = (node: SyntaxNode | null) =>
    node !== null && toWebLink(state.sliceDoc(node.from, node.to)) !== null;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        if (name === "Image" || name === "WikiLink") return false;
        if (name === "Link") {
          // The text between "[" and "]", not the address after it.
          const [open, close] = node.getChildren("LinkMark");
          if (opens(node.getChild("URL")) && close && close.from > open.to) {
            ranges.push(webLinkMark.range(open.to, close.from));
          }
          return false;
        }
        if (name === "Autolink") {
          const url = node.getChild("URL");
          if (url !== null && opens(url)) {
            ranges.push(webLinkMark.range(url.from, url.to));
          }
          return false;
        }
        if (name === "URL" && opens(node)) {
          ranges.push(webLinkMark.range(node.from, node.to));
        }
      },
    });
  }
  return Decoration.set(ranges, true);
}

/**
 * Web links and email addresses drawn as links to notes are
 * (`live-preview.ts`): in the link color with a quiet line below, so a
 * link to the web reads as one, written bare in the text too.
 */
export const webLinkStyle = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = webLinkMarks(view);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = webLinkMarks(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    ".cm-web-link": { borderBottom: "1px solid var(--cb-line-strong)" },
    // The highlighting draws the text in a span of its own inside: a bare
    // address in the faint color of addresses.
    ".cm-web-link, .cm-web-link *": { color: "var(--cb-link)" },
    ".cm-web-link:hover, .cm-web-link:hover *": { color: "var(--cb-fg)" },
  }),
];
