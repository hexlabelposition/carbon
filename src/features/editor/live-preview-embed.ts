import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { t } from "../i18n/i18n";
import { holdingChanged, keepsFocus } from "./held-selection";
import { linkHost, type LinkHost } from "./link-completion";
import type { LinkPreview, PreviewedLink } from "./link-preview";
import { imageHost } from "./live-preview-image";
import { readingView, setReadingText } from "./reading-view";

/**
 * Embeds: `![[Note]]` shows that note in place, `![[Note#Heading]]` the
 * section of that heading, drawn as reading mode draws it, under a bar
 * with the name of the note; a click on the name opens it. While the
 * cursor is in the embed, its Markdown shows and the note follows it.
 * The note is looked up again when the index changes, so an edit of the
 * embedded note shows. An embedded note shows its own embeds as text.
 */
export const embedPreview = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorate(view);
      }

      update(update: ViewUpdate) {
        const changed =
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          holdingChanged(update) ||
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (changed) this.decorations = decorate(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    ".cm-embed": {
      display: "block",
      margin: "4px 0",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "6px",
      overflow: "hidden",
      cursor: "default",
      // The note text around it is wrapped as a line of the editor.
      whiteSpace: "normal",
    },
    ".cm-embed-title": {
      display: "flex",
      gap: "6px",
      padding: "5px 12px",
      borderBottom: "1px solid var(--cb-line)",
      color: "var(--cb-muted)",
      fontFamily: "var(--cb-ui-font)",
      fontSize: "12px",
      fontWeight: "600",
      lineHeight: "1.5",
    },
    ".cm-embed-name": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      cursor: "pointer",
    },
    ".cm-embed-name:hover": { color: "var(--cb-fg)" },
    ".cm-embed-heading": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: "var(--cb-faint)",
      fontWeight: "400",
    },
    ".cm-embed-body": { padding: "8px 12px" },
    ".cm-embed-empty": { color: "var(--cb-faint)" },
    ".cm-embed-missing": {
      display: "inline-block",
      padding: "1px 6px",
      border: "1px dashed var(--cb-line-strong)",
      borderRadius: "4px",
      fontSize: "13px",
      color: "var(--cb-faint)",
    },
  }),
];

/** What each editor last showed for an embed, so a redraw does not blink. */
const shown = new WeakMap<EditorView, Map<string, LinkPreview>>();

function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  if (state.facet(linkHost) === null) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  const editing = (from: number, to: number) =>
    keepsFocus(view) &&
    state.selection.ranges.some(
      (range) => range.from <= to && range.to >= from,
    );

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        if (name === "Table") return false;
        if (name !== "WikiLink") return;
        if (node.from === 0 || state.sliceDoc(node.from - 1, node.from) !== "!")
          return;
        const link = linkOf(node, (a, b) => state.sliceDoc(a, b));
        if (link.target === "") return;
        const widget = new EmbedWidget(link);
        const start = node.from - 1;
        if (editing(start, node.to)) {
          // Being edited: the Markdown stays, the note follows it.
          ranges.push(Decoration.widget({ widget, side: 1 }).range(node.to));
        } else {
          ranges.push(Decoration.replace({ widget }).range(start, node.to));
        }
      },
    });
  }
  return Decoration.set(ranges, true);
}

/** The target and the heading of a wiki link, as the core reads them. */
function linkOf(
  node: SyntaxNode,
  slice: (from: number, to: number) => string,
): PreviewedLink {
  const part = (name: string) => {
    const child = node.getChild(name);
    const value = child === null ? "" : slice(child.from, child.to).trim();
    return value === "" ? null : value;
  };
  return {
    kind: "wiki",
    target: part("WikiLinkTarget") ?? "",
    fragment: part("WikiLinkFragment"),
  };
}

class EmbedWidget extends WidgetType {
  constructor(private readonly link: PreviewedLink) {
    super();
  }

  private get key(): string {
    return `${this.link.target}#${this.link.fragment ?? ""}`;
  }

  eq(other: EmbedWidget): boolean {
    return other.key === this.key;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("div");
    box.className = "cm-embed";
    const host = view.state.facet(linkHost);
    if (host === null) return box;

    const cache = shown.get(view) ?? new Map<string, LinkPreview>();
    shown.set(view, cache);
    const embed = new Embed(view, host, this.link, box);
    const last = cache.get(this.key);
    if (last !== undefined) embed.show(last);
    const load = () => {
      host.preview(this.link).then(
        (preview) => {
          cache.set(this.key, preview);
          embed.show(preview);
        },
        () => embed.show({ path: null, canCreate: true }),
      );
    };
    load();
    const stop = host.onIndexChange(load);
    // The height changes when the note loads and when its images do.
    const resize = new ResizeObserver(() => view.requestMeasure());
    resize.observe(box);
    embeds.set(box, () => {
      stop();
      resize.disconnect();
      embed.destroy();
    });
    return box;
  }

  destroy(dom: HTMLElement): void {
    embeds.get(dom)?.();
    embeds.delete(dom);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** How to take down what an embed set up, by its box. */
const embeds = new WeakMap<HTMLElement, () => void>();

/** The content of one embed box, drawn again when the note changes. */
class Embed {
  private note: EditorView | null = null;
  private drawn: LinkPreview | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly host: LinkHost,
    private readonly link: PreviewedLink,
    private readonly box: HTMLElement,
  ) {
    box.addEventListener("mousedown", (event) => this.onMouseDown(event));
  }

  show(preview: LinkPreview): void {
    // Only the text changed: the editor inside keeps its place.
    if (
      this.note !== null &&
      this.drawn?.path !== null &&
      preview.path !== null &&
      this.drawn?.path === preview.path &&
      preview.markdown.trim() !== ""
    ) {
      setReadingText(this.note, preview.markdown);
      this.drawn = preview;
      return;
    }
    this.destroy();
    this.drawn = preview;
    this.box.replaceChildren();
    this.box.className = "cm-embed";
    const name = this.link.fragment
      ? `${this.link.target}#${this.link.fragment}`
      : this.link.target;

    if (preview.path === null) {
      // A missing note is a line of text, as a missing image is.
      this.box.className = "cm-embed-missing";
      this.box.textContent = preview.canCreate
        ? t("embed.missing", { name })
        : t("embed.notNote", { name });
      return;
    }

    const title = document.createElement("div");
    title.className = "cm-embed-title";
    const open = document.createElement("span");
    open.className = "cm-embed-name";
    open.textContent = preview.title;
    open.title = t("embed.open", { name: preview.path });
    title.append(open);
    if (preview.heading !== null) {
      const heading = document.createElement("span");
      heading.className = "cm-embed-heading";
      heading.textContent = preview.heading;
      title.append(heading);
    }

    const body = document.createElement("div");
    body.className = "cm-embed-body";
    this.box.append(title, body);
    if (preview.markdown.trim() === "") {
      body.classList.add("cm-embed-empty");
      body.textContent = t("linkPreview.empty");
      return;
    }
    this.note = readingView(
      body,
      preview.markdown,
      this.view.state.facet(imageHost),
    );
  }

  /**
   * A click on the name opens the note: in place, with Ctrl (Cmd on a
   * Mac) in a new tab, with Shift as well in the pane beside. A click
   * elsewhere puts the cursor after the embed, which shows its Markdown
   * to edit. In reading mode nothing can be edited: the text of the note
   * is selected as usual.
   */
  private onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".cm-embed-name")) {
      event.preventDefault();
      const mod = event.ctrlKey || event.metaKey;
      this.host.follow(this.link, {
        target: mod ? (event.shiftKey ? "beside" : "newTab") : "here",
      });
      return;
    }
    const view = this.view;
    if (view.state.readOnly) return;
    event.preventDefault();
    let at: number;
    try {
      at = view.posAtDOM(this.box);
    } catch {
      return;
    }
    // After the link: from the start of the widget to its end.
    const end = view.state.doc.lineAt(at).to;
    const link = view.state.sliceDoc(at, end).match(/^!?\[\[[^\]]*\]\]/);
    view.dispatch({
      selection: { anchor: link === null ? at : at + link[0].length },
    });
    view.focus();
  }

  destroy(): void {
    this.note?.destroy();
    this.note = null;
  }
}
