import type { NoteFile, NoteParser, ParsedFile } from "../platform";
import { contentHash } from "../util/hash";
import { parseNote } from "./parse-note";

/**
 * Parses and hashes note files where it is called. The worker of the app
 * runs this; the core uses it directly when the platform has no parser.
 */
export function parseFiles(files: readonly NoteFile[]): ParsedFile[] {
  return files.map(({ path, text }) => ({
    note: parseNote(path, text),
    hash: contentHash(text),
  }));
}

/** A `NoteParser` on the calling thread. */
export const inlineParser: NoteParser = {
  // A promise that rejects, never a synchronous throw (CONTRIBUTING.md).
  parse: async (files) => parseFiles(files),
};
