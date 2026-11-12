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
  /**
   * Saves an image that was dropped as a path: some systems give a file
   * dragged from the file manager as its absolute path, not its content.
   * Resolves with the address to write in the note.
   */
  importFile(path: string): Promise<string>;
  /** Tells the user why something dropped on the note was not taken. */
  refuse(reason: string): void;
}

/** The image host of an editor. Without one, images stay text. */
export const imageHost = Facet.define<ImageHost, ImageHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/**
 * Images in the editor: `![alt](file.png)` that points at a file of the
 * vault is shown as the image. While the cursor is in it, its Markdown is
 * shown as well.
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
    // The address of an image is one long word. Without this the line
    // would break before it, at the "(", and leave "![]" alone on a line.
    ".cm-image-source": { wordBreak: "break-all" },
    ".cm-image-missing": {
      padding: "1px 6px",
      border: "1px dashed var(--cb-line-strong)",
      borderRadius: "4px",
      fontSize: "13px",
      color: "var(--cb-faint)",
    },
  }),
];

/**
 * An image pasted from the clipboard or dropped from another program is
 * saved into the vault, and a link to it is written at that place. Apart
 * from `imagePreview`, so it works in source mode too.
 */
export const imageInput = [
  ViewPlugin.fromClass(
    class {
      /**
       * When something was last dropped that the page could not read. The
       * WebView then inserts the dropped text itself, see `update`.
       */
      unreadableDropAt = 0;

      update(update: ViewUpdate) {
        if (update.docChanged && Date.now() - this.unreadableDropAt < 1000) {
          const inserted = droppedPathsIn(update);
          if (inserted !== null) {
            this.unreadableDropAt = 0;
            // A view cannot be changed while it is being updated.
            setTimeout(() => void replaceDroppedPaths(update.view, inserted));
          }
        }
      }
    },
    {
      eventHandlers: {
        paste(event, view) {
          const host = view.state.facet(imageHost);
          const images = [...(event.clipboardData?.files ?? [])].filter(
            (file) => isImage(file.name, file.type),
          );
          if (host === null || images.length === 0) return false;
          event.preventDefault();
          void insertImages(
            view,
            images.map((image) => () => host.save(image)),
          );
          return true;
        },

        // Without this the editor would not be a place files can be
        // dropped on.
        dragover(event) {
          if (!event.dataTransfer?.types.includes("Files")) return false;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          return true;
        },

        drop(event, view) {
          const dropped = readDrop(event.dataTransfer);
          if (dropped === null) {
            // Text, a link, or a file whose path the WebView keeps from
            // the page: the text is inserted as usual, and `update` looks
            // at what arrived.
            this.unreadableDropAt = Date.now();
            return false;
          }
          // Files are never left to the WebView: it would open them in
          // place of the app.
          event.preventDefault();
          const host = view.state.facet(imageHost);
          if (host === null) return true;

          const saves = [
            ...dropped.files
              .filter((file) => isImage(file.name, file.type))
              .map((file) => () => host.save(file)),
            ...dropped.paths
              .filter((path) => isImage(path))
              .map((path) => () => host.importFile(path)),
          ];
          if (saves.length === 0) {
            host.refuse(
              dropped.files.length + dropped.paths.length === 0
                ? "The dropped file could not be read."
                : "Only images can be dropped into a note.",
            );
            return true;
          }
          // The images go where they were dropped, not where the cursor
          // was.
          const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (at !== null) view.dispatch({ selection: { anchor: at } });
          void insertImages(view, saves);
          return true;
        },
      },
    },
  ),
];

const imageSource = Decoration.mark({ class: "cm-image-source" });

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
        if (editing(node.from, node.to)) {
          // Being edited: the Markdown stays, the image follows it.
          ranges.push(
            imageSource.range(node.from, node.to),
            Decoration.widget({ widget, side: 1 }).range(node.to),
          );
        } else {
          ranges.push(Decoration.replace({ widget }).range(node.from, node.to));
        }
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

/** File names the editor takes for images. */
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Some systems give a dropped file no type: its name decides then. */
function isImage(name: string, type = ""): boolean {
  return type.startsWith("image/") || IMAGE_NAME.test(name);
}

/**
 * The file paths written in `text`, one per line: "file://" addresses, and
 * bare absolute paths if they name an image. `only` tells whether the text
 * is nothing but such lines.
 */
function filePathsIn(text: string): { paths: string[]; only: boolean } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const paths: string[] = [];
  for (const line of lines) {
    if (line.startsWith("file://")) {
      try {
        paths.push(decodeURIComponent(new URL(line).pathname));
      } catch {
        // Not an address after all: skip it.
      }
    } else if (/^(\/|[A-Za-z]:[\\/])/.test(line) && IMAGE_NAME.test(line)) {
      // A bare path, as some file managers give it.
      paths.push(line.replaceAll("\\", "/"));
    }
  }
  return { paths, only: lines.length > 0 && paths.length === lines.length };
}

/**
 * The files of a drop, in the two forms systems hand them over: as files
 * with their content, or as addresses in a list of links. `null` if the
 * page can see no files in the drop.
 */
function readDrop(
  data: DataTransfer | null,
): { files: File[]; paths: string[] } | null {
  if (data === null) return null;
  const files = [...data.files];
  const paths =
    files.length > 0
      ? []
      : filePathsIn(data.getData("text/uri-list") || data.getData("text/plain"))
          .paths;
  const carriesFiles = data.types.includes("Files") || paths.length > 0;
  return carriesFiles ? { files, paths } : null;
}

interface DroppedPaths {
  /** Where the dropped text now stands in the note. */
  from: number;
  to: number;
  text: string;
  paths: string[];
}

/**
 * Looks at what an update inserted: if it is nothing but file paths, that
 * is a file dragged from the file manager on a system whose WebView hides
 * the path from the page during the drop, then inserts it as text itself.
 */
function droppedPathsIn(update: ViewUpdate): DroppedPaths | null {
  let found: DroppedPaths | null = null;
  let insertions = 0;
  update.changes.iterChanges((_fromA, _toA, from, to, inserted) => {
    if (inserted.length === 0) return;
    insertions++;
    const text = inserted.toString();
    const { paths, only } = filePathsIn(text);
    if (only) found = { from, to, text, paths };
  });
  return insertions === 1 ? found : null;
}

/** Puts images in place of the paths the WebView inserted for a drop. */
async function replaceDroppedPaths(
  view: EditorView,
  dropped: DroppedPaths,
): Promise<void> {
  const host = view.state.facet(imageHost);
  // Only if the text is still there, untouched.
  if (
    host === null ||
    view.state.sliceDoc(dropped.from, dropped.to) !== dropped.text
  ) {
    return;
  }
  const images = dropped.paths.filter((path) => isImage(path));
  view.dispatch({
    changes: { from: dropped.from, to: dropped.to },
    selection: { anchor: dropped.from },
  });
  if (images.length === 0) {
    host.refuse("Only images can be dropped into a note.");
    return;
  }
  const saved = await insertImages(
    view,
    images.map((path) => () => host.importFile(path)),
  );
  // Nothing could be copied: better the path back than nothing at all.
  if (saved === 0) {
    const at = view.state.selection.main.head;
    view.dispatch({ changes: { from: at, insert: dropped.text } });
  }
}

/**
 * Saves the images one by one and writes a link to each at the cursor.
 * Resolves with the number of images that were saved.
 */
async function insertImages(
  view: EditorView,
  saves: (() => Promise<string>)[],
): Promise<number> {
  let saved = 0;
  for (const save of saves) {
    let target: string;
    try {
      target = await save();
    } catch {
      // The host has told the user; the next image may still work.
      continue;
    }
    saved++;
    // The cursor may have moved while the image was being saved.
    const at = view.state.selection.main.head;
    const text = `![](${target})`;
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      scrollIntoView: true,
    });
  }
  return saved;
}
