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

/** The frontmatter of a note as the index has it: `ParsedNote` fields. */
export type NoteMetadata = Pick<ParsedNote, "tags" | "aliases" | "properties">;

/** An alias of a note, from its frontmatter. */
export interface NoteAlias {
  path: NotePath;
  alias: string;
}

/** A tag and the number of notes that have it. */
export interface TagCount {
  tag: string;
  count: number;
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

/** A mention of a note, by its title, in another note without a link. */
export interface Mention {
  /** The note that mentions it. */
  source: NotePath;
  sourceTitle: string;
  /** Offsets of the mention in the source note. */
  start: number;
  end: number;
  /** The line around the mention, cut short far from it. */
  snippet: string;
  /** Where the mention is in `snippet`. */
  snippetMatch: TextRange;
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

/** A note in the graph of the vault, or a note that links miss. */
export interface GraphNode {
  path: NotePath;
  title: string;
  /**
   * True for a note that does not exist but that links point to: its
   * `path` is where they would find it (`UnresolvedTarget.path`).
   */
  missing: boolean;
  /**
   * The tags of the note as the index has them (`NoteMetadata.tags`), in
   * order; none for a missing note. The graph colors notes by them.
   */
  tags: string[];
}

/** The links from one note to another, as one edge of the graph. */
export interface GraphEdge {
  /** The note the links are written in. */
  source: NotePath;
  /** The note they point to. */
  target: NotePath;
  /** How many links of `source` point to `target`. */
  count: number;
}

/**
 * Notes and the links between them: the graph view draws it. Nodes are
 * ordered by path, edges by source, then target. A note that links to
 * itself has no edge to itself.
 */
export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
