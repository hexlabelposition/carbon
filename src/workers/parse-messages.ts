import type { NoteFile, ParsedFile } from "@carbon/core";

/** A batch sent to the parse worker. */
export interface ParseRequest {
  id: number;
  files: readonly NoteFile[];
}

/** The answer to the request with the same `id`. */
export type ParseReply =
  { id: number; parsed: ParsedFile[] } | { id: number; error: string };
