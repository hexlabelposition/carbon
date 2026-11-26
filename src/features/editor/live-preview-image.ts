import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import {
  EditorSelection,
  Facet,
  Prec,
  StateEffect,
  StateField,
  type SelectionRange,
  type ChangeDesc,
  type EditorState,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type Rect,
  type ViewUpdate,
  keymap,
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
  imageName,
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

/**
 * The shape of an image that is not there, as it is drawn and edited: a
 * wide box as wide as the note (`editedImageLine` stretches it).
 */
const MISSING_IMAGE: SeenImage = { url: "", width: 560, height: 315 };

const revealImage = StateEffect.define<number>();

/**
 * Where the image starts whose Markdown the user asked to see, with its
 * button. Only that one shows its Markdown: a cursor put beside an image
 * by a click or the keys leaves it drawn. It is drawn again once the
 * selection leaves its line.
 */
const revealedImage = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(revealImage)) return effect.value;
    }
    if (value === null) return null;
    // Kept while the selection reaches into its line: one made from the
    // Markdown out to the lines around it, as Ctrl+Shift+Left at the
    // start of the line does, keeps the Markdown in sight.
    const at = tr.changes.mapPos(value);
    const line = tr.state.doc.lineAt(at);
    const touches = tr.state.selection.ranges.some(
      (range) => range.from <= line.to && range.to >= line.from,
    );
    return touches ? at : null;
  },
});

/** The image host of an editor. Without one, images stay text. */
export const imageHost = Facet.define<ImageHost, ImageHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/**
 * Images in the editor: `![alt](file.png)` that points at a file of the
 * vault is shown as the image. Its Markdown shows when its button asks
 * for it (`revealedImage`), over the image blurred in its place.
 *
 * Images from the web are loaded only when the settings say so, or once
 * the user clicks "Show" on the line that stands in for one: opening a
 * note tells nobody that it was opened (`web-images.ts`).
 */
export const imagePreview = [
  revealedImage,
  // The arrow keys pass over a drawn image, as over one tall line.
  Prec.high(
    keymap.of([
      { key: "ArrowDown", run: (view) => passImages(view, true, true) },
      { key: "ArrowUp", run: (view) => passImages(view, false, true) },
      { key: "ArrowRight", run: (view) => passImages(view, true, false) },
      { key: "ArrowLeft", run: (view) => passImages(view, false, false) },
    ]),
  ),
  // A click beside a drawn image puts the cursor on the line above or
  // below it, the nearer one, not beside the image.
  EditorView.domEventHandlers({
    mousedown(event, view) {
      // In reading mode a click selects text as usual.
      if (view.state.readOnly) return false;
      if (event.button !== 0 || event.detail !== 1) return false;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
      }
      if ((event.target as Element).closest?.(".cm-image") != null) {
        return false;
      }
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      const { doc } = view.state;
      const line = doc.lineAt(pos);
      if (!drawnImageLine(view.state, line.from, line.to)) return false;
      const block = view.lineBlockAt(line.from);
      const middle = view.documentTop + block.top + block.height / 2;
      const above = event.clientY < middle;
      let anchor: number;
      if (above && line.number > 1) anchor = doc.line(line.number - 1).to;
      else if (!above && line.number < doc.lines) {
        anchor = doc.line(line.number + 1).from;
      } else if (line.number > 1) anchor = doc.line(line.number - 1).to;
      else if (line.number < doc.lines) anchor = doc.line(line.number + 1).from;
      else return false;
      event.preventDefault();
      view.dispatch({ selection: { anchor }, scrollIntoView: true });
      view.focus();
      return true;
    },
  }),
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private readonly stop: () => void;
      private readonly edit: ImageEdit;

      constructor(view: EditorView) {
        this.edit = new ImageEdit(view);
        this.decorations = decorate(view, this.edit);
        this.stop = onWebImagesChange(() =>
          view.dispatch({ effects: imagesChanged.of(null) }),
        );
      }

      destroy() {
        this.stop();
        this.edit.destroy();
      }

      update(update: ViewUpdate) {
        if (update.docChanged) this.edit.map(update.changes);
        const changed =
          update.transactions.some((tr) =>
            tr.effects.some((effect) => effect.is(imagesChanged)),
          ) ||
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          holdingChanged(update) ||
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (changed) this.decorations = decorate(update.view, this.edit);
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
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "26px",
      height: "24px",
      borderRadius: "4px",
      color: "rgb(255 255 255 / 0.85)",
      cursor: "pointer",
    },
    // The tooltip of the app (`Tooltip`), drawn in CSS: the editor's own
    // DOM has no React in it. Under the button, held to the right edge.
    ".cm-image-tool::after": {
      content: "attr(data-tooltip)",
      position: "absolute",
      top: "calc(100% + 6px)",
      right: "-2px",
      padding: "4px 8px",
      border: "1px solid var(--cb-line)",
      borderRadius: "6px",
      backgroundColor: "var(--cb-panel)",
      color: "var(--cb-fg)",
      boxShadow: "var(--cb-shadow-dialog)",
      fontFamily: "var(--cb-ui-font)",
      fontSize: "12px",
      lineHeight: "1.4",
      whiteSpace: "nowrap",
      textShadow: "none",
      pointerEvents: "none",
      opacity: "0",
      transform: "scale(0.95)",
      transformOrigin: "top right",
      transition: "opacity 100ms ease-out, transform 100ms ease-out",
    },
    ".cm-image-tool:hover::after": {
      opacity: "1",
      transform: "none",
      transitionDelay: "400ms",
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
    // The address being typed shows no image: the size stays, the image
    // goes, as a missing image is drawn.
    ".cm-line.cm-image-edited-missing": {
      outline: "1px dashed var(--cb-line-strong)",
      outlineOffset: "-1px",
    },
    ".cm-line.cm-image-edited-missing::before, .cm-line.cm-image-edited-missing::after":
      { display: "none" },
    ".cm-line.cm-image-edited.cm-image-edited-missing *": {
      color: "var(--cb-faint) !important",
      textShadow: "none",
    },
    ".cm-line.cm-image-edited > *": { minWidth: "0" },
    // White on the darkened image in either theme: the highlighting gives
    // the marks and the address the colors of the theme, dark when light.
    ".cm-line.cm-image-edited *": { color: "#fff !important" },
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
    // An image that is not there takes a size of its own, as one that is
    // would: the note keeps its shape while an address is fixed.
    // What an image box says is a picture, not text of the note: a
    // selection across it does not take it.
    ".cm-image, .cm-image-web": { userSelect: "none" },
    ".cm-image.cm-image-missing": {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      boxSizing: "border-box",
      position: "relative",
      width: "100%",
      aspectRatio: `${MISSING_IMAGE.width} / ${MISSING_IMAGE.height}`,
      padding: "16px 24px",
      border: "1px dashed var(--cb-line-strong)",
      borderRadius: "6px",
      fontFamily: "var(--cb-ui-font)",
      fontSize: "13px",
      lineHeight: "1.4",
      textAlign: "center",
      overflowWrap: "anywhere",
      color: "var(--cb-faint)",
      cursor: "text",
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

/** Draws `box` as an image that is not there, saying why. */
function drawMissing(view: EditorView, box: HTMLElement, text: string): void {
  // The button for the Markdown, as on a shown image; nothing to open.
  box.className = "cm-image cm-image-missing";
  box.style.cursor = "";
  const icon = document.createElement("span");
  icon.innerHTML = MISSING_ICON;
  const label = document.createElement("span");
  label.textContent = text;
  box.replaceChildren(icon, label, imageTools(view, box, null));
  view.requestMeasure();
}

/**
 * Where the cursor is drawn beside an image: as high as a line of text,
 * at the bottom of the image, before or after it. The editor draws it as
 * high as the image otherwise.
 */
function cursorBeside(dom: HTMLElement, pos: number): Rect {
  const rect = dom.getBoundingClientRect();
  const height = parseFloat(getComputedStyle(dom).lineHeight) || 24;
  const x = pos === 0 ? rect.left : rect.right;
  return {
    left: x,
    right: x,
    top: Math.max(rect.top, rect.bottom - height),
    bottom: rect.bottom,
  };
}

/**
 * Whether the line from `from` to `to` is an image alone, drawn: one live
 * preview shows as an image, not its Markdown (`revealedImage`).
 */
function drawnImageLine(state: EditorState, from: number, to: number): boolean {
  const text = state.sliceDoc(from, to).trim();
  if (text === "") return false;
  let found = false;
  syntaxTree(state).iterate({
    from,
    to,
    enter({ name, node }) {
      if (found) return false;
      if (name !== "Image") return;
      if (state.sliceDoc(node.from, node.to) !== text) return false;
      const url = node.getChild("URL");
      const target = url === null ? "" : state.sliceDoc(url.from, url.to);
      const drawn =
        url === null
          ? /\]\(\s*\)$/.test(text)
          : isWebImage(target) || isLocal(target);
      found = drawn && !revealed(state, node.from);
      return false;
    },
  });
  return found;
}

/**
 * Moves the cursor as the arrow key would, and on past the lines of drawn
 * images it lands on: up and down to the line beyond, keeping the column,
 * left and right to the end of the line before or the start of the one
 * after. `false`, for the usual move, when no image is in the way, or
 * when the image is the first or the last line and there is nowhere to go.
 */
function passImages(
  view: EditorView,
  forward: boolean,
  vertical: boolean,
): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const { selection, doc } = state;
  if (selection.ranges.length !== 1 || !selection.main.empty) return false;
  const start = selection.main;
  const imageAt = (number: number) => {
    const line = doc.line(number);
    return drawnImageLine(state, line.from, line.to);
  };
  const moved = vertical
    ? view.moveVertically(start, forward)
    : view.moveByChar(start, forward);
  let number = doc.lineAt(moved.head).number;
  if (!imageAt(number)) return false;
  // A few images one under another are passed together.
  while (imageAt(number)) {
    number += forward ? 1 : -1;
    if (number < 1 || number > doc.lines) return false;
  }
  const line = doc.line(number);
  let range: SelectionRange;
  if (!vertical) {
    range = EditorSelection.cursor(forward ? line.from : line.to);
  } else {
    // In the column the cursor keeps while it goes up and down, on the
    // nearest row of the line: its first going down, its last going up.
    const content = view.contentDOM.getBoundingClientRect();
    const goal =
      start.goalColumn ??
      (view.coordsAtPos(start.head)?.left ?? content.left) - content.left;
    const block = view.lineBlockAt(line.from);
    const y = view.documentTop + (forward ? block.top + 2 : block.bottom - 2);
    const at = view.posAtCoords({ x: content.left + goal, y }, false);
    range = EditorSelection.cursor(
      Math.min(Math.max(at, line.from), line.to),
      0,
      undefined,
      goal,
    );
  }
  view.dispatch({
    selection: range,
    scrollIntoView: true,
    userEvent: "select",
  });
  return true;
}

/** Shows the Markdown of the image drawn in `box`, to edit. */
function revealSource(view: EditorView, box: HTMLElement): void {
  if (view.state.readOnly) return;
  const at = view.posAtDOM(box);
  // The cursor goes after the Markdown, at the end of the address, where
  // it is edited.
  let end = at;
  for (
    let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(at, 1);
    node !== null;
    node = node.parent
  ) {
    if (node.name === "Image") {
      end = node.to;
      break;
    }
  }
  view.dispatch({ selection: { anchor: end }, effects: revealImage.of(at) });
  view.focus();
}

/** Whether the image at `from` shows its Markdown (`revealedImage`). */
function revealed(state: EditorState, from: number): boolean {
  const at = state.field(revealedImage, false) ?? null;
  return (
    at !== null && state.doc.lineAt(at).from === state.doc.lineAt(from).from
  );
}

/**
 * An image may now be shown that could not, or the other way round: a web
 * image was allowed, or the address being edited was looked up. Draw
 * them again.
 */
const imagesChanged = StateEffect.define<null>();

/** How long typing in an image address must stop before it is looked up. */
const LOOKUP_DELAY_MS = 300;

/**
 * The image line being edited, so it keeps its size while its address is
 * typed: the last image it showed, where that line is now, and what the
 * addresses typed since turned out to be. A new address is looked up a
 * moment after typing stops; once found, the line takes its size.
 */
class ImageEdit {
  /** The start of the line, and the image it showed last. */
  line: { from: number; image: SeenImage } | null = null;
  /** Addresses looked up that show no image. */
  private readonly missing = new Set<string>();
  private wanted: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor(private readonly view: EditorView) {}

  map(changes: ChangeDesc): void {
    if (this.line !== null) {
      this.line = { ...this.line, from: changes.mapPos(this.line.from) };
    }
  }

  isMissing(target: string): boolean {
    return this.missing.has(target);
  }

  /** Looks `target` up a moment from now, unless another comes first. */
  lookUp(target: string): void {
    if (this.wanted === target) return;
    this.wanted = target;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(target), LOOKUP_DELAY_MS);
  }

  private async load(target: string): Promise<void> {
    const view = this.view;
    const host = view.state.facet(imageHost);
    let url: string | null = null;
    if (isWebImage(target)) {
      // A web image is fetched only when the user allows it.
      if (webImageAllowed(target)) url = webImageAddress(target);
    } else if (host !== null) {
      url = await host.load(target).catch(() => null);
    }
    const found =
      url === null
        ? null
        : await new Promise<HTMLImageElement | null>((resolve) => {
            const image = new Image();
            image.referrerPolicy = "no-referrer";
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = url;
          });
    if (this.destroyed || this.wanted !== target) return;
    this.wanted = null;
    if (found === null) this.missing.add(target);
    else rememberImage(view, target, found);
    view.dispatch({ effects: imagesChanged.of(null) });
  }

  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
  }
}

function decorate(view: EditorView, edit: ImageEdit): DecorationSet {
  const { state } = view;
  if (state.facet(imageHost) === null) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  const editing = (from: number, to: number) =>
    keepsFocus(view) &&
    state.selection.ranges.some(
      (range) => range.from <= to && range.to >= from,
    );
  let editedLine = false;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        if (name !== "Image") return;
        const url = node.getChild("URL");
        // "![alt]()" has no address yet; "![alt][ref]" is left as text.
        const written = state.sliceDoc(node.from, node.to);
        if (url === null && !/\]\(\s*\)$/.test(written)) return;
        const target = url === null ? "" : state.sliceDoc(url.from, url.to);
        const web = isWebImage(target);
        if (!web && !isLocal(target)) return;
        // What stands between "![" and "]".
        const alt = /^!\[(.*?)\]/s.exec(state.sliceDoc(node.from, node.to));
        const widget = web
          ? new WebImageWidget(target, alt?.[1] ?? "", webImageAllowed(target))
          : new ImageWidget(target, alt?.[1] ?? "");
        if (editing(node.from, node.to) && revealed(state, node.from)) {
          const line = state.doc.lineAt(node.from);
          const alone =
            node.to <= line.to &&
            state.sliceDoc(line.from, line.to).trim() ===
              state.sliceDoc(node.from, node.to);
          const seen = alone ? seenImage(view, target) : undefined;
          // Being edited, alone on its line: the line takes the place and
          // the size of the image, blurred behind the Markdown, so nothing
          // below moves. While another address is typed, it keeps the
          // last image it showed, or its size with no image once the
          // address shows none.
          const last = edit.line?.from === line.from ? edit.line.image : null;
          // A web image not allowed yet stays a line with "Show": it has
          // no size to keep.
          const hidden = web && !webImageAllowed(target);
          if (alone && (seen !== undefined || last !== null || !hidden)) {
            editedLine = true;
            if (seen !== undefined) {
              edit.line = { from: line.from, image: seen };
            } else if (target !== "" && !edit.isMissing(target)) {
              edit.lookUp(target);
            }
            // Not found, or not looked up yet with no image before it: the
            // size of the last image, or of a missing one, with no image.
            const missing =
              seen === undefined &&
              (last === null || target === "" || edit.isMissing(target));
            ranges.push(
              editedImageLine(seen ?? last ?? MISSING_IMAGE, missing).range(
                line.from,
              ),
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
  // No image line is edited any more: the next one starts afresh.
  if (!editedLine) edit.line = null;
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
function editedImageLine(image: SeenImage, missing: boolean): Decoration {
  // A URL in CSS: quotes and backslashes would end it.
  const url = image.url.replace(/["\\\n]/g, (c) => encodeURIComponent(c));
  return Decoration.line({
    class: missing
      ? "cm-image-edited cm-image-edited-missing"
      : "cm-image-edited",
    attributes: {
      style:
        `--cm-image: url("${url}"); ` +
        // A missing image is as wide as the note, as it is drawn.
        `--cm-image-width: ${image === MISSING_IMAGE ? "100%" : `${image.width}px`}; ` +
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
    // A click on the image shows it on its own; on a missing one it does
    // nothing, its button shows the Markdown.
    box.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const image = box.querySelector("img");
      if (image !== null && view.state.facet(imageHost) !== null) {
        this.show(view, image);
      }
    });

    const missing = () =>
      drawMissing(
        view,
        box,
        this.target === ""
          ? t("images.noAddress")
          : t("images.notFound", { name: this.alt || this.target }),
      );
    if (this.target === "") {
      missing();
      return box;
    }
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

  coordsAt(dom: HTMLElement, pos: number): Rect {
    return cursorBeside(dom, pos);
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
        // Beside "Show": the Markdown of the image. The line has no
        // buttons, so the line itself is the one.
        revealSource(view, box);
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
    image.addEventListener("error", () =>
      drawMissing(
        view,
        box,
        t("images.notFound", { name: this.alt || imageName(this.target) }),
      ),
    );
    image.src = address;
    const open = () =>
      view.state
        .facet(imageHost)
        ?.open({ url: address, target: this.target, alt: this.alt });
    box.append(image, imageTools(view, box, open));
    box.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (box.contains(image)) open();
    });
    return box;
  }

  coordsAt(dom: HTMLElement, pos: number): Rect {
    return cursorBeside(dom, pos);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * The buttons over a shown image, in its top right corner while the
 * pointer is over it, as in Obsidian: one shows the image on its own,
 * where it can be zoomed, the other its Markdown to edit (not in reading
 * mode). A click on the image shows it too. The Markdown shows only by
 * the button (`revealedImage`): a click beside the image or the arrow
 * keys put the cursor by it and leave it drawn. Without `open`, for an
 * image that is not there, only the Markdown one.
 */
function imageTools(
  view: EditorView,
  box: HTMLElement,
  open: (() => void) | null,
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
    // Not `title`: WebKitGTK draws it as a big system tooltip, not as the
    // tooltips of the app.
    element.dataset.tooltip = label;
    element.innerHTML = icon;
    element.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      run();
    });
    tools.append(element);
  };
  if (open !== null) button("open", t("images.open"), ZOOM_ICON, open);
  button("source", t("images.source"), CODE_ICON, () =>
    revealSource(view, box),
  );
  return tools;
}

const ICON_ATTRIBUTES =
  'viewBox="0 0 16 16" width="16" height="16" fill="none" ' +
  'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"';
const MISSING_ICON = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/><path d="M3 3l18 18"/></svg>`;
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
