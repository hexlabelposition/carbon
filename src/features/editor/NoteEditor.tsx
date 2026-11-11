import type { NotePath, Vault } from "@carbon/core";
import { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { useNoteText } from "./use-note-text";

interface NoteEditorProps {
  vault: Vault;
  path: NotePath;
}

/**
 * The editor of one note. Mount it with `key={path}`, so each note gets an
 * editor of its own.
 */
export function NoteEditor({ vault, path }: NoteEditorProps) {
  const note = useNoteText(vault, path);
  // Remove with C-117: autosave replaces the warning below.
  const [edited, setEdited] = useState(false);

  if (note.status === "loading") return null;
  if (note.status === "error") {
    return (
      <p
        role="alert"
        className="flex h-full items-center justify-center px-8 text-center text-danger"
      >
        Could not open {path}: {note.message}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {edited && (
        <p
          role="status"
          className="shrink-0 border-b border-line bg-panel px-3 py-1 text-small text-muted"
        >
          Changes are not saved yet: saving comes with autosave.
        </p>
      )}
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          initialText={note.text}
          label={path}
          onChange={() => setEdited(true)}
        />
      </div>
    </div>
  );
}
