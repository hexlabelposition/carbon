import { useLayoutEffect, useRef } from "react";
import type { MessageKey } from "../i18n/i18n";
import { cssFamily, familyOf, fontValue } from "./fonts";
import { oneOf, preference } from "./preference";

/** Sizes of the note text, in pixels. */
export const NOTE_SIZES: readonly number[] = [13, 14, 15, 16, 17, 18, 20];

/** The size of the note text until another is chosen, in pixels. */
export const NOTE_SIZE_DEFAULT = 14;

export type NoteWidth = "narrow" | "normal" | "wide" | "full";
export type LineHeight = "compact" | "normal" | "relaxed";
export type NoteFont = "inter" | "system" | "serif" | "mono";

/** The widths of the content of a note, with the keys of their names. */
export const NOTE_WIDTHS: readonly { value: NoteWidth; label: MessageKey }[] = [
  { value: "narrow", label: "settings.width.narrow" },
  { value: "normal", label: "settings.width.normal" },
  { value: "wide", label: "settings.width.wide" },
  { value: "full", label: "settings.width.full" },
];

/** The spacing of the lines of the note text, with the keys of their names. */
export const LINE_HEIGHTS: readonly { value: LineHeight; label: MessageKey }[] =
  [
    { value: "compact", label: "settings.lineHeight.compact" },
    { value: "normal", label: "settings.lineHeight.normal" },
    { value: "relaxed", label: "settings.lineHeight.relaxed" },
  ];

const LINE_HEIGHT: Record<LineHeight, string> = {
  compact: "1.45",
  normal: "1.65",
  relaxed: "1.85",
};

/** The fonts of the note text, with the keys of their names. */
export const NOTE_FONTS: readonly { value: NoteFont; label: MessageKey }[] = [
  { value: "inter", label: "settings.font.inter" },
  { value: "system", label: "settings.font.system" },
  { value: "serif", label: "settings.font.serif" },
  { value: "mono", label: "settings.font.mono" },
];

/**
 * The most the content of a note takes, its side padding included. Full
 * width as a share, not `none`, so a change of width can glide to it.
 */
const WIDTH: Record<NoteWidth, string> = {
  narrow: "640px",
  normal: "784px",
  wide: "1024px",
  full: "100%",
};

/**
 * How long the note glides to a new width, in milliseconds: as the side
 * panels slide (`--cb-slide-open-duration`), with some time to spare.
 */
const RESIZE_MS = 250 + 50;

const FONT: Record<NoteFont, string> = {
  inter: "var(--font-sans)",
  system: "system-ui, sans-serif",
  serif: 'ui-serif, "Noto Serif", "DejaVu Serif", Georgia, serif',
  // The monospace font chosen in the settings (fonts.ts).
  mono: "var(--cb-mono-font)",
};

export const noteSizePreference = preference<number>(
  "carbon.note.size",
  NOTE_SIZE_DEFAULT,
  (stored) =>
    NOTE_SIZES.includes(Number(stored)) ? Number(stored) : undefined,
);

/** Puts the note text back to its default size. */
export function resetNoteSize(): void {
  noteSizePreference.set(NOTE_SIZE_DEFAULT);
}

/**
 * Whether Ctrl and the mouse wheel over a note change its text size, and
 * Ctrl and a press of the wheel put it back.
 */
export const wheelTextSizePreference = preference<boolean>(
  "carbon.note.wheelSize",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether the name of the note is shown as a title above its text, where
 * it can be edited to rename the note. Hidden until turned on: the bar
 * above the note shows it, and the file tree renames.
 */
export const inlineTitlePreference = preference<boolean>(
  "carbon.note.inlineTitle",
  false,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether lines run down both sides of the column of the note, the whole
 * height of the note (`NoteEditor`). On until turned off, from the menu
 * of the right button in a note.
 */
export const noteBordersPreference = preference<boolean>(
  "carbon.note.borders",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether numbers stand at the left of the text, one for each line as it
 * is shown, a wrapped one counted as many (`lineNumbers`). Off until
 * turned on.
 */
export const lineNumbersPreference = preference<boolean>(
  "carbon.note.lineNumbers",
  false,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether Ctrl+S tidies up the layout of the note before it saves it
 * (`formatNote`), as "Format note" of the palette does. On until turned
 * off. Only Ctrl+S: the saves made on their own while typing leave the
 * text alone.
 */
export const formatOnSavePreference = preference<boolean>(
  "carbon.note.formatOnSave",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether nested lists show lines from an item down along the items
 * under it (`listGuides`). On until turned off.
 */
export const listGuidesPreference = preference<boolean>(
  "carbon.note.listGuides",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether a new note starts with its name as a heading, "# Name". On
 * until turned off: the inline title, which shows the name too, is off
 * at first.
 */
export const nameHeadingPreference = preference<boolean>(
  "carbon.note.nameHeading",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/** The text a new note starts with (`vault.notes.setNewNoteText`). */
export function newNoteText(path: string): string {
  if (!nameHeadingPreference.get()) return "";
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  return `# ${name}\n\n`;
}

/**
 * Whether images from the web are loaded in notes. Off until turned on:
 * loading one tells its server that the note was opened, so each is
 * shown only when asked for (`web-images.ts`).
 */
export const webImagesPreference = preference<boolean>(
  "carbon.note.webImages",
  false,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * Whether the formatting bar floats at the bottom of the note, with
 * buttons for bold, lists and the like (`FormatBar`). Off until the
 * button above the note turns it on.
 */
export const formatBarPreference = preference<boolean>(
  "carbon.editor.formatBar",
  false,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

export const noteWidthPreference = preference<NoteWidth>(
  "carbon.note.width",
  "normal",
  oneOf(NOTE_WIDTHS.map((width) => width.value)),
);

export const lineHeightPreference = preference<LineHeight>(
  "carbon.note.lineHeight",
  "normal",
  oneOf(LINE_HEIGHTS.map((height) => height.value)),
);

/** One of `NOTE_FONTS`, or a family of the system (`familyValue`). */
export const noteFontPreference = preference<string>(
  "carbon.note.font",
  "inter",
  fontValue(NOTE_FONTS.map((font) => font.value)),
);

/** The CSS font list of the note text, for a value of `noteFontPreference`. */
function noteFont(value: string): string {
  const family = familyOf(value);
  if (family !== null) return `${cssFamily(family)}, ${FONT.inter}`;
  return FONT[value as NoteFont] ?? FONT.inter;
}

/**
 * Applies the note settings as CSS variables on the root element, which
 * the editor and the note name read: `--cb-note-size`, `--cb-note-width`,
 * `--cb-note-font` and `--cb-note-line-height`. Their defaults are in
 * index.css. A new width glides: `data-note-resizing` on the root while
 * it does (`index.css`), never at start, when the width is first set.
 */
export function useNoteStyle(): void {
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  const font = noteFontPreference.use();
  const lineHeight = lineHeightPreference.use();
  const shownWidth = useRef<NoteWidth | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = shownWidth.current;
    shownWidth.current = width;
    if (before === null || before === width) return;
    root.dataset.noteResizing = "";
    const timer = setTimeout(() => delete root.dataset.noteResizing, RESIZE_MS);
    return () => {
      clearTimeout(timer);
      delete root.dataset.noteResizing;
    };
  }, [width]);

  // Before the paint, so a note never shows in the default style first.
  useLayoutEffect(() => {
    const { style } = document.documentElement;
    style.setProperty("--cb-note-size", `${size}px`);
    style.setProperty("--cb-note-width", WIDTH[width]);
    style.setProperty("--cb-note-font", noteFont(font));
    style.setProperty("--cb-note-line-height", LINE_HEIGHT[lineHeight]);
  }, [size, width, font, lineHeight]);
}
