import type { Backlink, ParsedNote, SearchHit } from "../types";

/**
 * The index cache. Methods are narrow and domain-shaped, not raw SQL, so the
 * storage engine stays an implementation detail (ADR-009).
 * Note paths are relative to the vault root.
 */
export interface IndexStore {
  /** Inserts the note or replaces every row that belongs to it. */
  replaceNote(note: ParsedNote): Promise<void>;
  removeNote(path: string): Promise<void>;
  backlinks(path: string): Promise<Backlink[]>;
  search(query: string, limit: number): Promise<SearchHit[]>;
}
