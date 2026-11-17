import type { IndexStore } from "../index/index-store";
import type { NoteGraph, NotePath } from "../types";

/** What `Graph` needs from the vault. */
export interface GraphContext {
  /** The index once it is open; rejects if there is none. */
  index(): Promise<IndexStore>;
}

/** Which notes a graph shows besides the notes of the vault. */
export interface GraphOptions {
  /**
   * Also the notes that links point to but that do not exist, marked
   * `missing`. Off by default.
   */
  missing?: boolean;
}

/** Which notes the graph of the vault shows. */
export interface GlobalGraphOptions extends GraphOptions {
  /**
   * Only the notes with this tag or one nested in it: `area` keeps
   * `#area/topic` too. Case and a "#" in front are ignored.
   */
  tag?: string;
}

/** How many links away from its note a local graph reaches by default. */
export const LOCAL_GRAPH_DEPTH = 1;

/**
 * The graph of notes and the links between them, answered from the
 * index (ARCHITECTURE.md, section 6): the nodes and edges that the graph
 * view lays out and draws. During the startup scan it may miss notes the
 * scan has not reached yet.
 */
export class Graph {
  constructor(private readonly context: GraphContext) {}

  /**
   * Every note of the vault and the links between them, or those of the
   * notes with a tag.
   */
  async global(options: GlobalGraphOptions = {}): Promise<NoteGraph> {
    const tag = options.tag?.trim() ?? "";
    return (await this.context.index()).graph(
      options.missing ?? false,
      tag === "" ? null : tag,
    );
  }

  /**
   * The notes at most `depth` links away from the note at `path`,
   * whichever way a link goes, and the links between them: `0` is the
   * note alone, `1` adds the notes it links to and those that link to
   * it. Empty if the note is not indexed. Rejects if `depth` is not a
   * whole number of 0 or more.
   */
  async local(
    path: NotePath,
    depth = LOCAL_GRAPH_DEPTH,
    options: GraphOptions = {},
  ): Promise<NoteGraph> {
    if (!Number.isInteger(depth) || depth < 0) {
      throw new Error(`Not a depth of a local graph: ${depth}`);
    }
    return (await this.context.index()).localGraph(
      path,
      depth,
      options.missing ?? false,
    );
  }
}
