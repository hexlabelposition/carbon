import type { MessageKey } from "../i18n/i18n";
import { oneOf, preference } from "./preference";

/** What Tab puts in: a tab, or so many spaces. */
export type Indent = "tab" | "2" | "4";

/** The mode notes are shown in when the app starts. */
export type StartMode = "remember" | "live" | "source" | "reading";

export const INDENTS: readonly { value: Indent; label: MessageKey }[] = [
  { value: "tab", label: "settings.indent.tab" },
  { value: "2", label: "settings.indent.spaces2" },
  { value: "4", label: "settings.indent.spaces4" },
];

export const START_MODES: readonly { value: StartMode; label: MessageKey }[] = [
  { value: "remember", label: "settings.startMode.remember" },
  { value: "live", label: "settings.startMode.live" },
  { value: "source", label: "settings.startMode.source" },
  { value: "reading", label: "settings.startMode.reading" },
];

/** The text of one level of indent. */
export function indentText(indent: Indent): string {
  return indent === "tab" ? "\t" : " ".repeat(Number(indent));
}

/** Two spaces until another is chosen: what CodeMirror does by itself. */
export const indentPreference = preference<Indent>(
  "carbon.editor.indent",
  "2",
  oneOf(INDENTS.map((indent) => indent.value)),
);

/**
 * The mode notes are in when the app starts: the one they were in when
 * it was closed, or always the same one. The modes are one switch for
 * every note (`useSourceMode`, `useReadingMode`), so this is when the
 * choice applies.
 */
export const startModePreference = preference<StartMode>(
  "carbon.editor.startMode",
  "remember",
  oneOf(START_MODES.map((mode) => mode.value)),
);

/**
 * Whether a note opened in the active pane takes the focus: its scroll,
 * not the text, so the keys scroll it and no cursor shows until a click.
 */
export const focusOnOpenPreference = preference<boolean>(
  "carbon.editor.focusOnOpen",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);
