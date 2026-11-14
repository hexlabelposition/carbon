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
  /**
   * The paragraph, heading or table row around the link, as plain text on
   * one line, cut short far from the link: what a backlink shows.
   */
  snippet: string;
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
  /** Text around the link, for display: `Link.snippet`. */
  snippet: string;
  /** Offsets of the link in the source note. */
  start: number;
  end: number;
}

/** A note that links point to, but that does not exist. */
export interface UnresolvedTarget {
  /**
   * Where the note would be found by these links, spelled as the first of
   * them spells it: where to create it.
   */
  path: NotePath;
  /** Every link to it, by the path of its note, then in written order. */
  links: Backlink[];
}

/** A part of a text, by offsets in it. */
export interface TextRange {
  start: number;
  end: number;
}

/** A note found by full-text search. */
export interface SearchHit {
  path: NotePath;
  /** `ParsedNote.title`. */
  title: string;
  /** Where the words searched for are in `title`, in order. */
  titleMatches: TextRange[];
  /**
   * The part of the body with the words searched for, as plain text on
   * one line, cut short with "…". The start of the body if only the
   * title has them.
   */
  snippet: string;
  /** Where the words searched for are in `snippet`, in order. */
  snippetMatches: TextRange[];
  /** How well the note matches; higher is better. */
  score: number;
}
