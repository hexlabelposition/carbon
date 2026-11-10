import type {
  Backlink,
  IndexStore,
  NotePath,
  ParsedNote,
  SearchHit,
} from "../../src/index";

/**
 * An in-memory `IndexStore`. Deliberately naive: links match by exact path
 * (with or without `.md`) and search is a case-insensitive substring match.
 * Real link resolution and ranking belong to the core and the real store.
 */
export class MemoryIndexStore implements IndexStore {
  private readonly notes = new Map<NotePath, ParsedNote>();

  async replaceNote(note: ParsedNote): Promise<void> {
    this.notes.set(note.path, note);
  }

  async removeNote(path: NotePath): Promise<void> {
    this.notes.delete(path);
  }

  async backlinks(path: NotePath): Promise<Backlink[]> {
    const withoutExtension = path.replace(/\.md$/, "");
    const result: Backlink[] = [];
    for (const note of this.notes.values()) {
      for (const link of note.links) {
        if (link.target !== path && link.target !== withoutExtension) continue;
        result.push({
          source: note.path,
          sourceTitle: note.title,
          snippet: "",
          start: link.start,
          end: link.end,
        });
      }
    }
    return result;
  }

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const needle = query.toLowerCase();
    if (needle === "") return [];
    const hits: SearchHit[] = [];
    for (const note of this.notes.values()) {
      const inTitle = note.title.toLowerCase().includes(needle);
      const at = note.plainText.toLowerCase().indexOf(needle);
      if (!inTitle && at === -1) continue;
      hits.push({
        path: note.path,
        title: note.title,
        snippet:
          at === -1 ? "" : note.plainText.slice(Math.max(0, at - 40), at + 80),
        // A title match outranks a body match.
        score: (inTitle ? 2 : 0) + (at === -1 ? 0 : 1),
      });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Test helper: paths of all stored notes. */
  paths(): NotePath[] {
    return [...this.notes.keys()];
  }
}
