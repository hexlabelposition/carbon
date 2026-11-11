import type { NotePath, SaveState, Vault } from "@carbon/core";
import { MarkdownEditor } from "./MarkdownEditor";
import { useNoteDocument } from "./use-note-document";

interface NoteEditorProps {
  vault: Vault;
  path: NotePath;
}

/**
 * The editor of one note, with its name and save state above it. Mount it
 * with `key={path}`, so each note gets an editor of its own.
 */
export function NoteEditor({ vault, path }: NoteEditorProps) {
  const [note, { edited, saveNow }] = useNoteDocument(vault, path);

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
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate text-muted" title={path}>
          {path.replace(/\.md$/i, "")}
        </span>
        <SaveIndicator save={note.save} onRetry={saveNow} />
      </header>
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          initialText={note.text}
          label={path}
          onChange={edited}
          onSave={saveNow}
        />
      </div>
    </div>
  );
}

interface SaveIndicatorProps {
  save: SaveState;
  onRetry: () => void;
}

/** Tells whether the edits are on disk. Never by color alone. */
function SaveIndicator({ save, onRetry }: SaveIndicatorProps) {
  if (save.status === "saved") {
    return (
      <span role="status" className="shrink-0 text-small text-faint">
        Saved
      </span>
    );
  }
  if (save.status === "unsaved") {
    return (
      <span
        role="status"
        className="flex shrink-0 items-center gap-1.5 text-small text-muted"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-fg" />
        Unsaved
      </span>
    );
  }
  if (save.status === "conflict") {
    // C-118 adds the dialog that resolves this.
    return (
      <span role="alert" className="min-w-0 truncate text-small text-danger">
        Not saved: the note was changed on disk
      </span>
    );
  }
  return (
    <span role="alert" className="flex min-w-0 items-center gap-2 text-small">
      <span className="truncate text-danger" title={save.message}>
        Not saved: {save.message}
      </span>
      <button
        type="button"
        className="shrink-0 rounded-sm border border-line-strong px-1.5 hover:bg-raise"
        onClick={onRetry}
      >
        Retry
      </button>
    </span>
  );
}
