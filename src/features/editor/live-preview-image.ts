import { syntaxTree } from "@codemirror/language";
import { Facet, StateEffect, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { t } from "../i18n/i18n";
import { imageTypeOf } from "../image/image-file";
import { holdingChanged, keepsFocus } from "./held-selection";
import {
  allowWebImage,
  isWebImage,
  onWebImagesChange,
  webImageAddress,
  webImageAllowed,
} from "./web-images";

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
  /** Shows an image of the note on its own, over the whole window. */
  open(image: ShownImage): void;
}

/** An image of a note, ready to be shown. */
export interface ShownImage {
  /** What `ImageHost.load` gave for it. */
  url: string;
  /** The address in the note, `target` in `![alt](target)`. */
  target: string;
  alt: string;
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
 * Images from the web are loaded only when the settings say so, or once
 * the user clicks "Show" on the line that stands in for one: opening a
 * note tells nobody that it was opened (`web-images.ts`).
 */
export const imagePreview = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private readonly stop: () => void;

      constructor(view: EditorView) {
        this.decorations = decorate(view);
        this.stop = onWebImagesChange(() =>
          view.dispatch({ effects: webImagesChanged.of(null) }),
        );
      }

      destroy() {
        this.stop();
      }

      update(update: ViewUpdate) {
        const changed =
          update.transactions.some((tr) =>
            tr.effects.some((effect) => effect.is(webImagesChanged)),
          ) ||
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
    ".cm-image": {
      display: "inline-block",
      maxWidth: "100%",
      verticalAlign: "top",
      cursor: "default",
    },
    ".cm-image:has(img)": { cursor: "pointer", position: "relative" },
    ".cm-image-tools": {
      position: "absolute",
      top: "8px",
      right: "8px",
      display: "flex",
      gap: "2px",
      padding: "2px",
      borderRadius: "6px",
      backgroundColor: "rgb(20 20 20 / 0.6)",
      backdropFilter: "blur(6px)",
      opacity: "0",
      transition: "opacity 120ms ease-out",
      pointerEvents: "none",
    },
    ".cm-image:hover .cm-image-tools": { opacity: "1", pointerEvents: "auto" },
    ".cm-image-tool": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "26px",
      height: "24px",
      borderRadius: "4px",
      color: "rgb(255 255 255 / 0.85)",
      cursor: "pointer",
    },
    ".cm-image-tool:hover": {
      color: "#fff",
      backgroundColor: "rgb(255 255 255 / 0.15)",
    },
    // In reading mode there is no Markdown to edit.
    ".cm-content[contenteditable=false] .cm-image-tool-source": {
      display: "none",
    },
    ".cm-image img": {
      display: "block",
      maxWidth: "100%",
      borderRadius: "6px",
    },
    // An image being edited: its line keeps its size, the image blurred
    // behind the Markdown.
    ".cm-line.cm-image-edited": {
      position: "relative",
      isolation: "isolate",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      width: "min(100%, var(--cm-image-width))",
      aspectRatio: "var(--cm-image-ratio)",
      padding: "8px 24px",
      overflow: "hidden",
      borderRadius: "6px",
      textAlign: "center",
      color: "#fff",
      textShadow: "0 1px 3px rgb(0 0 0 / 0.6)",
    },
    ".cm-line.cm-image-edited::before": {
      content: '""',
      position: "absolute",
      inset: "0",
      zIndex: "-1",
      backgroundImage: "var(--cm-image)",
      backgroundSize: "100% 100%",
      // Past the edges: a blur fades them out otherwise.
      transform: "scale(1.15)",
      filter: "blur(14px) brightness(0.5)",
    },
    // A dark glow under the Markdown, over the blurred image: the text
    // reads on an image of any colors, its edges still show.
    ".cm-line.cm-image-edited::after": {
      content: '""',
      position: "absolute",
      inset: "0",
      zIndex: "-1",
      background:
        "radial-gradient(ellipse 70% 45% at center, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.15) 100%)",
    },
    ".cm-line.cm-image-edited > *": { minWidth: "0" },
    // The address of an image is one long word. Without this the line
    // would break before it, at the "(", and leave "![]" alone on a line.
    ".cm-image-source": { wordBreak: "break-all" },
    ".cm-image-web": {
      display: "inline-flex",
      gap: "6px",
      padding: "1px 6px",
      border: "1px dashed var(--cb-line-strong)",
      borderRadius: "4px",
      fontSize: "13px",
      color: "var(--cb-faint)",
    },
    ".cm-image-web-show": {
      color: "var(--cb-link)",
      cursor: "pointer",
    },
    ".cm-image-web-show:hover": { textDecoration: "underline" },
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
          if (view.state.readOnly) return false;
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
          if (host === null || view.state.readOnly) return true;

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
                ? t("images.unreadable")
                : t("images.onlyImages"),
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

/** A web image may now be loaded, or no longer: draw them again. */
const webImagesChanged = StateEffect.define<null>();

function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  if (state.facet(imageHost) === null) return Decoration.none;
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
        if (name !== "Image") return;
        const url = node.getChild("URL");
        if (url === null) return;
        const target = state.sliceDoc(url.from, url.to);
        const web = isWebImage(target);
        if (!web && !isLocal(target)) return;
        // What stands between "![" and "]".
        const alt = /^!\[(.*?)\]/s.exec(state.sliceDoc(node.from, node.to));
        const widget = web
          ? new WebImageWidget(target, alt?.[1] ?? "", webImageAllowed(target))
          : new ImageWidget(target, alt?.[1] ?? "");
        if (editing(node.from, node.to)) {
          const line = state.doc.lineAt(node.from);
          const alone =
            node.to <= line.to &&
            state.sliceDoc(line.from, line.to).trim() ===
              state.sliceDoc(node.from, node.to);
          const seen = alone ? seenImage(view, target) : undefined;
          if (seen !== undefined) {
            // Being edited, alone on its line: the line takes the place
            // and the size of the image, blurred behind the Markdown, so
            // nothing below moves.
            ranges.push(
              editedImageLine(seen).range(line.from),
              imageSource.range(node.from, node.to),
            );
            return;
          }
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

/** An image that was shown: where it loads from, and its real size. */
interface SeenImage {
  url: string;
  width: number;
  height: number;
}

/**
 * The images each editor has shown, by their address in the note: an
 * image of the vault loads from a URL of its editor's host.
 */
const seen = new WeakMap<ImageHost, Map<string, SeenImage>>();

function seenImages(view: EditorView): Map<string, SeenImage> | null {
  const host = view.state.facet(imageHost);
  if (host === null) return null;
  let images = seen.get(host);
  if (images === undefined) {
    images = new Map();
    seen.set(host, images);
  }
  return images;
}

function seenImage(view: EditorView, target: string): SeenImage | undefined {
  return seenImages(view)?.get(target);
}

/** Remembers a loaded image, for the line that stands in for it. */
function rememberImage(
  view: EditorView,
  target: string,
  image: HTMLImageElement,
) {
  if (image.naturalWidth === 0 || image.naturalHeight === 0) return;
  seenImages(view)?.set(target, {
    url: image.src,
    width: image.naturalWidth,
    height: image.naturalHeight,
  });
}

/**
 * The line of an image being edited: as wide and as high as the image is
 * drawn (never wider than the note, never bigger than it is), the image
 * blurred and darkened behind its Markdown, which is centered on it.
 */
function editedImageLine(image: SeenImage): Decoration {
  // A URL in CSS: quotes and backslashes would end it.
  const url = image.url.replace(/["\\\n]/g, (c) => encodeURIComponent(c));
  return Decoration.line({
    class: "cm-image-edited",
    attributes: {
      style:
        `--cm-image: url("${url}"); ` +
        `--cm-image-width: ${image.width}px; ` +
        `--cm-image-ratio: ${image.width} / ${image.height}`,
    },
  });
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

  /** Shows the image on its own, where it can be zoomed. */
  show(view: EditorView, image: HTMLImageElement): void {
    view.state
      .facet(imageHost)
      ?.open({ url: image.src, target: this.target, alt: this.alt });
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("span");
    box.className = "cm-image";
    // A click on the image shows it on its own. A click on a missing
    // image selects its place, which shows its Markdown; so does a click
    // beside any image.
    box.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const image = box.querySelector("img");
      if (image !== null && view.state.facet(imageHost) !== null) {
        this.show(view, image);
        return;
      }
      view.dispatch({ selection: { anchor: view.posAtDOM(box) } });
      view.focus();
    });

    const missing = () => {
      box.classList.add("cm-image-missing");
      box.textContent = t("images.notFound", { name: this.alt || this.target });
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
      image.addEventListener("load", () => {
        rememberImage(view, this.target, image);
        view.requestMeasure();
      });
      image.addEventListener("error", missing);
      image.src = url;
      box.append(
        image,
        imageTools(view, box, () => this.show(view, image)),
      );
    }, missing);
    return box;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * An image from the web. Until it may be loaded, a line stands in for it
 * with the site it comes from and "Show", which loads it.
 */
class WebImageWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly alt: string,
    private readonly allowed: boolean,
  ) {
    super();
  }

  eq(other: WebImageWidget): boolean {
    return (
      other.target === this.target &&
      other.alt === this.alt &&
      other.allowed === this.allowed
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("span");
    const address = webImageAddress(this.target);
    if (!this.allowed) {
      box.className = "cm-image-web";
      const label = document.createElement("span");
      label.textContent = t("images.web", { site: siteOf(address) });
      const show = document.createElement("span");
      show.className = "cm-image-web-show";
      show.textContent = t("images.webShow");
      box.append(label, show);
      box.title = address;
      box.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if ((event.target as Element).closest(".cm-image-web-show")) {
          allowWebImage(address);
          return;
        }
        // Beside "Show": the Markdown of the image, as for a missing one.
        if (view.state.readOnly) return;
        view.dispatch({ selection: { anchor: view.posAtDOM(box) } });
        view.focus();
      });
      return box;
    }

    box.className = "cm-image";
    box.style.cursor = "pointer";
    const image = document.createElement("img");
    image.alt = this.alt;
    image.draggable = false;
    // The site is not told which page asked for the image.
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => {
      rememberImage(view, this.target, image);
      view.requestMeasure();
    });
    image.addEventListener("error", () => {
      box.className = "cm-image-missing";
      box.style.cursor = "";
      box.textContent = t("images.notFound", { name: this.alt || address });
    });
    image.src = address;
    const open = () =>
      view.state
        .facet(imageHost)
        ?.open({ url: address, target: this.target, alt: this.alt });
    box.append(image, imageTools(view, box, open));
    box.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (box.contains(image)) {
        open();
        return;
      }
      if (view.state.readOnly) return;
      view.dispatch({ selection: { anchor: view.posAtDOM(box) } });
      view.focus();
    });
    return box;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * The buttons over a shown image, in its top right corner while the
 * pointer is over it, as in Obsidian: one shows the image on its own,
 * where it can be zoomed, the other its Markdown to edit (not in reading
 * mode). A click on the image shows it too, and the keys reach the
 * Markdown: the buttons are a shortcut, not the only way.
 */
function imageTools(
  view: EditorView,
  box: HTMLElement,
  open: () => void,
): HTMLElement {
  const tools = document.createElement("span");
  tools.className = "cm-image-tools";
  const button = (
    kind: string,
    label: string,
    icon: string,
    run: () => void,
  ) => {
    const element = document.createElement("span");
    element.className = `cm-image-tool cm-image-tool-${kind}`;
    element.title = label;
    element.innerHTML = icon;
    element.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      run();
    });
    tools.append(element);
  };
  button("open", t("images.open"), ZOOM_ICON, open);
  button("source", t("images.source"), CODE_ICON, () => {
    if (view.state.readOnly) return;
    view.dispatch({ selection: { anchor: view.posAtDOM(box) } });
    view.focus();
  });
  return tools;
}

const ICON_ATTRIBUTES =
  'viewBox="0 0 16 16" width="16" height="16" fill="none" ' +
  'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"';
const ZOOM_ICON = `<svg ${ICON_ATTRIBUTES}><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14M7 5v4M5 7h4"/></svg>`;
const CODE_ICON = `<svg ${ICON_ATTRIBUTES}><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3 7 13"/></svg>`;

/** The site of an address, for the line that stands in for its image. */
function siteOf(address: string): string {
  try {
    return new URL(address).host;
  } catch {
    return address;
  }
}

/** Some systems give a dropped file no type: its name decides then. */
function isImage(name: string, type = ""): boolean {
  return type.startsWith("image/") || imageTypeOf(name) !== null;
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
    } else if (/^(\/|[A-Za-z]:[\\/])/.test(line) && isImage(line)) {
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
    host.refuse(t("images.onlyImages"));
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
