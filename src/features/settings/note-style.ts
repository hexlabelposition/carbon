import { useLayoutEffect } from "react";
import type { MessageKey } from "../i18n/i18n";
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

/** The most the content of a note takes, its side padding included. */
const WIDTH: Record<NoteWidth, string> = {
  narrow: "640px",
  normal: "784px",
  wide: "1024px",
  full: "none",
};

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
 * Whether nested lists show lines from an item down along the items
 * under it (`listGuides`). On until turned off.
 */
export const listGuidesPreference = preference<boolean>(
  "carbon.note.listGuides",
  true,
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

export const noteFontPreference = preference<NoteFont>(
  "carbon.note.font",
  "inter",
  oneOf(NOTE_FONTS.map((font) => font.value)),
);

/**
 * Applies the note settings as CSS variables on the root element, which
 * the editor and the note name read: `--cb-note-size`, `--cb-note-width`,
 * `--cb-note-font` and `--cb-note-line-height`. Their defaults are in
 * index.css.
 */
export function useNoteStyle(): void {
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  const font = noteFontPreference.use();
  const lineHeight = lineHeightPreference.use();

  // Before the paint, so a note never shows in the default style first.
  useLayoutEffect(() => {
    const { style } = document.documentElement;
    style.setProperty("--cb-note-size", `${size}px`);
    style.setProperty("--cb-note-width", WIDTH[width]);
    style.setProperty("--cb-note-font", FONT[font]);
    style.setProperty("--cb-note-line-height", LINE_HEIGHT[lineHeight]);
  }, [size, width, font, lineHeight]);
}
