import type { NotePath, ParsedNote } from "../types";

/** A note file as read from the vault. */
export interface NoteFile {
  path: NotePath;
  text: string;
}

/** What the index needs from one note file. */
export interface ParsedFile {
  note: ParsedNote;
  /** `contentHash` of the text. */
  hash: string;
}

/**
 * Parses and hashes note files, in batches. The app runs it in a Web
 * Worker, so a scan of a large vault never freezes typing (ARCHITECTURE.md,
 * section 8); the core cannot start a worker itself. The results are in
 * the order of `files`.
 */
export interface NoteParser {
  parse(files: readonly NoteFile[]): Promise<ParsedFile[]>;
}
