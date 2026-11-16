import { useLayoutEffect } from "react";
import type { MessageKey } from "../i18n/i18n";
import { oneOf, preference } from "./preference";

/** Sizes of the note text, in pixels; 15 is the default. */
export const NOTE_SIZES: readonly number[] = [13, 14, 15, 16, 17, 18, 20];

export type NoteWidth = "narrow" | "normal" | "wide" | "full";
export type NoteFont = "inter" | "system" | "serif" | "mono";

/** The widths of the content of a note, with the keys of their names. */
export const NOTE_WIDTHS: readonly { value: NoteWidth; label: MessageKey }[] = [
  { value: "narrow", label: "settings.width.narrow" },
  { value: "normal", label: "settings.width.normal" },
  { value: "wide", label: "settings.width.wide" },
  { value: "full", label: "settings.width.full" },
];

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
  15,
  (stored) =>
    NOTE_SIZES.includes(Number(stored)) ? Number(stored) : undefined,
);

export const noteWidthPreference = preference<NoteWidth>(
  "carbon.note.width",
  "normal",
  oneOf(NOTE_WIDTHS.map((width) => width.value)),
);

export const noteFontPreference = preference<NoteFont>(
  "carbon.note.font",
  "inter",
  oneOf(NOTE_FONTS.map((font) => font.value)),
);

/**
 * Applies the note settings as CSS variables on the root element, which
 * the editor and the note name read: `--cb-note-size`, `--cb-note-width`
 * and `--cb-note-font`. Their defaults are in index.css.
 */
export function useNoteStyle(): void {
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  const font = noteFontPreference.use();

  // Before the paint, so a note never shows in the default style first.
  useLayoutEffect(() => {
    const { style } = document.documentElement;
    style.setProperty("--cb-note-size", `${size}px`);
    style.setProperty("--cb-note-width", WIDTH[width]);
    style.setProperty("--cb-note-font", FONT[font]);
  }, [size, width, font]);
}
