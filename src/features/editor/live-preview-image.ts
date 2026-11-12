import { syntaxTree } from "@codemirror/language";
import { Facet, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/** What the editor needs from outside to show and to take in images. */
export interface ImageHost {
  /**
   * A URL the browser can show for the image a note addresses with
   * `target`, the address in `![alt](target)`. `null` if there is no such
   * image in the vault.
   */
  load(target: string): Promise<string | null>;
  /**
   * Saves an image that was pasted or dropped. Resolves with the address
   * to write in the note.
   */
  save(file: File): Promise<string>;
}

/** The image host of an editor. Without one, images stay text. */
export const imageHost = Facet.define<ImageHost, ImageHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/**
 * Images in the editor:
 *
 * - `![alt](file.png)` that points at a file of the vault is shown as the
 *   image. While the cursor is in it, its Markdown is shown as well.
 * - An image pasted from the clipboard or dropped from another program is
 *   saved into the vault, and a link to it is written at that place.
 *
 * Images from the web are not loaded: the note stays local, and opening it
 * tells nobody that it was opened.
 */
export const imagePreview = [
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
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (changed) this.decorations = decorate(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.domEventHandlers({
    paste(event, view) {
      const images = imagesIn(event.clipboardData);
      if (images.length === 0) return false;
      event.preventDefault();
      void insertImages(view, images);
      return true;
    },
    drop(event, view) {
      const images = imagesIn(event.dataTransfer);
      if (images.length === 0) return false;
      event.preventDefault();
      // The images go where they were dropped, not where the cursor was.
      const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (at !== null) view.dispatch({ selection: { anchor: at } });
      void insertImages(view, images);
      return true;
    },
  }),
  EditorView.baseTheme({
    ".cm-image": {
      display: "inline-block",
      maxWidth: "100%",
      verticalAlign: "top",
      cursor: "default",
    },
    ".cm-image img": {
      display: "block",
      maxWidth: "100%",
      borderRadius: "6px",
    },
    ".cm-image-missing": {
      padding: "1px 6px",
      border: "1px dashed var(--cb-line-strong)",
      borderRadius: "4px",
      fontSize: "13px",
      color: "var(--cb-faint)",
    },
  }),
];

function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  if (state.facet(imageHost) === null) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  const editing = (from: number, to: number) =>
    view.hasFocus &&
    state.selection.ranges.some(
      (range) => range.from <= to && range.to >= from,
    );

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        if (name !== "Image") return;
        const url = node.getChild("URL");
        if (url === null) return;
        const target = state.sliceDoc(url.from, url.to);
        if (!isLocal(target)) return;
        // What stands between "![" and "]".
        const alt = /^!\[(.*?)\]/s.exec(state.sliceDoc(node.from, node.to));
        const widget = new ImageWidget(target, alt?.[1] ?? "");
        ranges.push(
          editing(node.from, node.to)
            ? // Being edited: the Markdown stays, the image follows it.
              Decoration.widget({ widget, side: 1 }).range(node.to)
            : Decoration.replace({ widget }).range(node.from, node.to),
        );
      },
    });
  }
  return Decoration.set(ranges, true);
}

/** False for addresses on the web: "https:", "data:", "//host". */
function isLocal(target: string): boolean {
  return !/^<?([a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.target === this.target && other.alt === this.alt;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("span");
    box.className = "cm-image";
    // A click selects the place of the image, which shows its Markdown.
    box.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: view.posAtDOM(box) } });
      view.focus();
    });

    const missing = () => {
      box.classList.add("cm-image-missing");
      box.textContent = `Image not found: ${this.alt || this.target}`;
    };
    const host = view.state.facet(imageHost);
    if (host === null) {
      missing();
      return box;
    }
    host.load(this.target).then((url) => {
      if (url === null) {
        missing();
        return;
      }
      const image = document.createElement("img");
      image.alt = this.alt;
      image.draggable = false;
      // The image has a height only once it is loaded; the editor must
      // measure its lines again then.
      image.addEventListener("load", () => view.requestMeasure());
      image.addEventListener("error", missing);
      image.src = url;
      box.append(image);
    }, missing);
    return box;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function imagesIn(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((file) =>
    file.type.startsWith("image/"),
  );
}

/** Saves the images and writes a link to each at the cursor. */
async function insertImages(view: EditorView, images: File[]): Promise<void> {
  const host = view.state.facet(imageHost);
  if (host === null) return;
  for (const image of images) {
    let target: string;
    try {
      target = await host.save(image);
    } catch {
      // The host has told the user; the next image may still work.
      continue;
    }
    // The cursor may have moved while the image was being saved.
    const at = view.state.selection.main.head;
    const text = `![](${target})`;
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      scrollIntoView: true,
    });
  }
}
