/** A note path relative to the vault root, `/` separated: `projects/Carbon.md`. */
export type NotePath = string;

export interface Heading {
  level: number;
  text: string;
  /** Offset of the heading in the note text. */
  pos: number;
}

export interface Link {
  /**
   * `wiki` for `[[Note]]`, whose target is found by path, file name or
   * alias; `markdown` for `[text](Note.md)`, whose target is a path
   * relative to the note.
   */
  kind: "wiki" | "markdown";
  /** The target as written: `Note` in `[[Note#Heading|alias]]`. */
  target: string;
  alias: string | null;
  fragment: string | null;
  /** Offsets of the whole link in the note text. */
  start: number;
  end: number;
}

/** A link as the index has it: with the note it points to. */
export interface OutgoingLink extends Link {
  /** The note the link resolves to, or `null` while there is none. */
  resolved: NotePath | null;
}

/** What the parser extracts from one note and the index stores. */
export interface ParsedNote {
  path: NotePath;
  title: string;
  headings: Heading[];
  links: Link[];
  tags: string[];
  aliases: string[];
  /** Frontmatter properties other than `tags` and `aliases`. */
  properties: Record<string, unknown>;
  /** Body without Markdown syntax, for full-text search. */
  plainText: string;
}

export interface Backlink {
  /** The note that contains the link. */
  source: NotePath;
  sourceTitle: string;
  /** Text around the link, for display. */
  snippet: string;
  start: number;
  end: number;
}

export interface SearchHit {
  path: NotePath;
  title: string;
  snippet: string;
  /** Higher is better. */
  score: number;
}
