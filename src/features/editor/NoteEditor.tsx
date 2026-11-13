import type { NotePath, SaveState, Vault } from "@carbon/core";
import { useState } from "react";
import { useWorkspace } from "../workspace/workspace";
import { ConflictDialog } from "./ConflictDialog";
import { MarkdownEditor } from "./MarkdownEditor";
import type { OutlineLink } from "./outline";
import { useNoteDocument } from "./use-note-document";
import { useNoteImages } from "./use-note-images";
import { useNoteLinks } from "./use-note-links";
import { SOURCE_MODE_SHORTCUT } from "./use-source-mode";

interface NoteEditorProps {
  vault: Vault;
  path: NotePath;
  /** Shows the raw Markdown in place of live preview. */
  sourceMode: boolean;
  onToggleSourceMode: () => void;
  /** Where the headings of the note go. */
  outline?: OutlineLink;
}

/**
 * The editor of one note, with its name and save state above it. Mount it
 * with `key={path}`, so each note gets an editor of its own.
 */
export function NoteEditor({
  vault,
  path,
  sourceMode,
  onToggleSourceMode,
  outline,
}: NoteEditorProps) {
  const [note, actions] = useNoteDocument(vault, path);
  const images = useNoteImages(vault, path);
  const links = useNoteLinks(vault, path);
  const { reveal } = useWorkspace();
  /** The user closed the conflict question without answering it. */
  const [postponed, setPostponed] = useState(false);

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

  const name = path.replace(/\.md$/i, "");
  /** Answers the conflict question; a new conflict asks again. */
  const answer = (resolve: () => void) => () => {
    setPostponed(false);
    resolve();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate text-muted" title={path}>
          {name}
        </span>
        <SaveIndicator
          save={note.save}
          onRetry={actions.saveNow}
          onResolve={() => setPostponed(false)}
        />
        <button
          type="button"
          aria-pressed={sourceMode}
          title={`Show raw Markdown (${SOURCE_MODE_SHORTCUT})`}
          className={`h-6 shrink-0 rounded-sm px-1.5 text-small hover:bg-raise hover:text-fg ${
            sourceMode ? "bg-selected text-fg" : "text-muted"
          }`}
          onClick={onToggleSourceMode}
        >
          Source
        </button>
      </header>
      {images.error !== null && (
        <EditorAlert message={images.error} onDismiss={images.dismissError} />
      )}
      {links.error !== null && (
        <EditorAlert message={links.error} onDismiss={links.dismissError} />
      )}
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          text={note.text}
          revision={note.revision}
          label={path}
          onChange={actions.edited}
          onSave={actions.saveNow}
          images={images.host}
          sourceMode={sourceMode}
          outline={outline}
          links={links.host}
          reveal={reveal?.path === path ? reveal : null}
        />
      </div>
      {note.save.status === "conflict" && !postponed && (
        <ConflictDialog
          name={name}
          deletedOnDisk={note.deletedOnDisk}
          onKeepMine={answer(actions.keepMine)}
          onUseDisk={answer(actions.useDisk)}
          onLater={() => setPostponed(true)}
        />
      )}
    </div>
  );
}

/** A problem with the note that the user can read and close. */
function EditorAlert({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2 text-small"
    >
      <p className="min-w-0 flex-1 text-danger">{message}</p>
      <button type="button" className={indicatorButton} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

interface SaveIndicatorProps {
  save: SaveState;
  onRetry: () => void;
  /** Opens the conflict question again. */
  onResolve: () => void;
}

const indicatorButton =
  "shrink-0 rounded-sm border border-line-strong px-1.5 hover:bg-raise";

/** Tells whether the edits are on disk. Never by color alone. */
function SaveIndicator({ save, onRetry, onResolve }: SaveIndicatorProps) {
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
    return (
      <span role="alert" className="flex min-w-0 items-center gap-2 text-small">
        <span className="truncate text-danger">
          Not saved: the note was changed on disk
        </span>
        <button type="button" className={indicatorButton} onClick={onResolve}>
          Resolve
        </button>
      </span>
    );
  }
  return (
    <span role="alert" className="flex min-w-0 items-center gap-2 text-small">
      <span className="truncate text-danger" title={save.message}>
        Not saved: {save.message}
      </span>
      <button type="button" className={indicatorButton} onClick={onRetry}>
        Retry
      </button>
    </span>
  );
}
