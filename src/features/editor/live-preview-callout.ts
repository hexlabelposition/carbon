import { WidgetType } from "@codemirror/view";

/**
 * Callouts, as Obsidian writes them: a quote whose first line starts with
 * "[!type]", optionally followed by "+" or "-" and a title.
 *
 *     > [!warning] Before you start
 *     > The body of the callout.
 *
 * The note stays a plain quote on disk; only live preview draws it as a
 * colored box. Folding ("+" and "-") is not supported yet: the box is
 * always open.
 */
export interface CalloutHeader {
  /** The type in lower case, as "warning". */
  type: string;
  /** Where "[!" starts, from the start of the text given. */
  markerFrom: number;
  /** Where the title starts: after "[!type]", the "+" or "-" and spaces. */
  titleFrom: number;
  /** The title, empty if there is none. */
  title: string;
}

const HEADER = /^(\s*>\s?)\[!([A-Za-z][\w-]*)\][+-]?(\s*)(.*)$/;

/**
 * The callout header at the start of `text`, which begins at the ">" of
 * the quote, or null if the quote is not a callout.
 */
export function parseCalloutHeader(text: string): CalloutHeader | null {
  const match = HEADER.exec(text);
  if (match === null) return null;
  const [whole, quote, type, , title] = match;
  return {
    type: type.toLowerCase(),
    markerFrom: quote.length,
    titleFrom: whole.length - title.length,
    title: title.trimEnd(),
  };
}

/** The colors of the callouts, as `--cb-callout-*` tokens. */
export const CALLOUT_COLORS = [
  "blue",
  "teal",
  "green",
  "orange",
  "red",
  "purple",
  "gray",
] as const;

export type CalloutColor = (typeof CALLOUT_COLORS)[number];

/**
 * The icons of the callouts: 16 by 16 outlines, drawn like the other
 * icons of the app. The paths go inside an `<svg>` that sets the stroke.
 */
const ICONS = {
  pencil: '<path d="M10.5 2.5l3 3L6 13H3v-3z"/><path d="M9 4l3 3"/>',
  clipboard:
    '<rect x="3.5" y="3" width="9" height="11" rx="1.5"/>' +
    '<path d="M6 2h4v2.5H6z"/><path d="M6 8h4M6 10.75h4"/>',
  info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.5V11M8 5h.01"/>',
  circleCheck:
    '<circle cx="8" cy="8" r="6"/><path d="M5.5 8.2l1.8 1.8 3.2-3.5"/>',
  flame:
    '<path d="M8 14c2.5 0 4.5-1.8 4.5-4.4 0-2.6-2-4.1-2.6-6.6-1.4 1-2.2 ' +
    "2.4-2.2 3.8-1-.4-1.6-1.2-1.8-2.1C4.6 6 3.5 7.6 3.5 9.6 3.5 12.2 5.5 " +
    '14 8 14z"/>',
  check: '<path d="M3 8.5l3.2 3.2L13 4.8"/>',
  question:
    '<circle cx="8" cy="8" r="6"/>' +
    '<path d="M6.2 6.3a1.9 1.9 0 0 1 3.7.6c0 1.3-1.9 1.6-1.9 2.8"/>' +
    '<path d="M8 11.5h.01"/>',
  warning: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 6.75v3M8 11.25h.01"/>',
  cross: '<path d="M4 4l8 8M12 4l-8 8"/>',
  zap: '<path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z"/>',
  bug:
    '<path d="M5 7a3 3 0 0 1 6 0v3.5a3 3 0 0 1-6 0z"/>' +
    '<path d="M5 8.5H2.5M11 8.5h2.5M5 11.5l-2 1.5M11 11.5l2 1.5' +
    'M5.5 5.25L4 3.75M10.5 5.25L12 3.75"/>',
  list:
    '<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/>' +
    '<path d="M2.75 4.5h.01M2.75 8h.01M2.75 11.5h.01"/>',
  quote:
    '<path d="M7 7.5H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H6a1 1 0 0 1 1 1v3' +
    'c0 2.2-1.2 3.5-3.2 4"/>' +
    '<path d="M13.5 7.5H10a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v3' +
    'c0 2.2-1.2 3.5-3.2 4"/>',
};

type CalloutIcon = keyof typeof ICONS;

/** The types Obsidian knows and their aliases, by color and icon. */
const TYPES: Record<string, { color: CalloutColor; icon: CalloutIcon }> = {};
const GROUPS: [CalloutColor, CalloutIcon, string[]][] = [
  ["blue", "pencil", ["note"]],
  ["blue", "info", ["info"]],
  ["blue", "circleCheck", ["todo"]],
  ["teal", "clipboard", ["abstract", "summary", "tldr"]],
  ["teal", "flame", ["tip", "hint", "important"]],
  ["green", "check", ["success", "check", "done"]],
  ["orange", "question", ["question", "help", "faq"]],
  ["orange", "warning", ["warning", "caution", "attention"]],
  ["red", "cross", ["failure", "fail", "missing"]],
  ["red", "zap", ["danger", "error"]],
  ["red", "bug", ["bug"]],
  ["purple", "list", ["example"]],
  ["gray", "quote", ["quote", "cite"]],
];
for (const [color, icon, types] of GROUPS) {
  for (const type of types) TYPES[type] = { color, icon };
}

/** A type of one's own is drawn as a note. */
const NOTE = TYPES.note;

/** The color of a callout type. */
export function calloutColor(type: string): CalloutColor {
  return (TYPES[type] ?? NOTE).color;
}

/** The title shown when a callout has none: its type, as "Warning". */
export function defaultCalloutTitle(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function iconElement(type: string): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "cm-callout-icon";
  icon.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.25" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    ICONS[(TYPES[type] ?? NOTE).icon] +
    "</svg>";
  return icon;
}

/**
 * Shown in place of "[!type]": the icon of the type and, when the callout
 * has no title of its own, the type as its title.
 */
export class CalloutHeaderWidget extends WidgetType {
  constructor(
    private readonly type: string,
    private readonly title: string | null,
  ) {
    super();
  }

  eq(other: CalloutHeaderWidget): boolean {
    return other.type === this.type && other.title === this.title;
  }

  toDOM(): HTMLElement {
    const header = document.createElement("span");
    header.className = "cm-callout-header";
    header.append(iconElement(this.type));
    if (this.title !== null) {
      const title = document.createElement("span");
      title.className = "cm-callout-title";
      title.textContent = this.title;
      header.append(title);
    }
    return header;
  }
}
