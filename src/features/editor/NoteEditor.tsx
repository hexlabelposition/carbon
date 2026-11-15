import type { NotePath, SaveState, Vault } from "@carbon/core";
import { useState } from "react";
import { useT } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import { ConflictDialog } from "./ConflictDialog";
import { MarkdownEditor } from "./MarkdownEditor";
import { NoteTitleField } from "./NoteTitleField";
import type { OutlineLink } from "./outline";
import { useNoteDocument } from "./use-note-document";
import { ImageViewer } from "./ImageViewer";
import { useNoteImages } from "./use-note-images";
import { useSmoothWheel } from "./use-smooth-wheel";
import { useNoteLinks } from "./use-note-links";
import { useNoteTitle } from "./use-note-title";
import { SOURCE_MODE_SHORTCUT } from "./use-source-mode";

interface NoteEditorProps {
  vault: Vault;
  path: NotePath;
  /** Shows the raw Markdown in place of live preview. */
  sourceMode: boolean;
  onToggleSourceMode: () => void;
  /** Shows the note to read: no typing, only tasks can be ticked. */
  readingMode: boolean;
  onToggleReadingMode: () => void;
  /** Where the headings of the note go. */
  outline?: OutlineLink;
  /** The editor the user works in: see `MarkdownEditor`. */
  active?: boolean;
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
  readingMode,
  onToggleReadingMode,
  outline,
  active = false,
}: NoteEditorProps) {
  const t = useT();
  const [note, actions] = useNoteDocument(vault, path);
  const images = useNoteImages(vault, path);
  const links = useNoteLinks(vault, path);
  const title = useNoteTitle(vault, path);
  const { reveal } = useWorkspace();
  const smoothWheel = useSmoothWheel();
  /** The user closed the conflict question without answering it. */
  const [postponed, setPostponed] = useState(false);

  if (note.status === "loading") return null;
  if (note.status === "error") {
    return (
      <p
        role="alert"
        className="flex h-full items-center justify-center px-8 text-center text-danger"
      >
        {t("start.couldNotOpen", { root: path, reason: note.message })}
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
          title={t("editor.sourceHint", { shortcut: SOURCE_MODE_SHORTCUT })}
          className={`h-6 shrink-0 rounded-sm px-1.5 text-small hover:bg-raise hover:text-fg ${
            sourceMode ? "bg-selected text-fg" : "text-muted"
          }`}
          onClick={onToggleSourceMode}
        >
          {t("editor.source")}
        </button>
        <button
          type="button"
          aria-pressed={readingMode}
          title={t("editor.readHint")}
          className={`h-6 shrink-0 rounded-sm px-1.5 text-small hover:bg-raise hover:text-fg ${
            readingMode ? "bg-selected text-fg" : "text-muted"
          }`}
          onClick={onToggleReadingMode}
        >
          {t("editor.read")}
        </button>
      </header>
      {images.error !== null && (
        <EditorAlert message={images.error} onDismiss={images.dismissError} />
      )}
      {links.error !== null && (
        <EditorAlert message={links.error} onDismiss={links.dismissError} />
      )}
      {/* One scroll for the name and the text: the name scrolls away.
          It glides: the editor scrolls by setting `scrollTop` here, for
          Page Up and Page Down and for jumps to a heading or a match, and
          so does the mouse wheel. */}
      <div
        ref={smoothWheel}
        // To read, the scroll takes the focus on a click, so Page Up and
        // Page Down, the arrows and Space scroll it: the text cannot. The
        // editor keeps a click from focusing it, so it is focused here.
        tabIndex={readingMode ? -1 : undefined}
        onMouseDown={(event) => {
          if (readingMode) event.currentTarget.focus({ preventScroll: true });
        }}
        className="flex min-h-0 flex-1 flex-col overflow-auto scroll-smooth outline-none"
      >
        <NoteTitleField title={title} readOnly={readingMode} />
        <MarkdownEditor
          text={note.text}
          revision={note.revision}
          label={path}
          onChange={actions.edited}
          onSave={actions.saveNow}
          images={images.host}
          sourceMode={sourceMode}
          readOnly={readingMode}
          outline={outline}
          active={active}
          links={links.host}
          reveal={reveal?.path === path ? reveal : null}
        />
      </div>
      {images.shown !== null && (
        <ImageViewer image={images.shown} onClose={images.closeShown} />
      )}
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
  const t = useT();
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2 text-small"
    >
      <p className="min-w-0 flex-1 text-danger">{message}</p>
      <button type="button" className={indicatorButton} onClick={onDismiss}>
        {t("common.dismiss")}
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
  const t = useT();
  if (save.status === "saved") {
    return (
      <span role="status" className="shrink-0 text-small text-faint">
        {t("save.saved")}
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
        {t("save.unsaved")}
      </span>
    );
  }
  if (save.status === "conflict") {
    return (
      <span role="alert" className="flex min-w-0 items-center gap-2 text-small">
        <span className="truncate text-danger">{t("save.conflict")}</span>
        <button type="button" className={indicatorButton} onClick={onResolve}>
          {t("save.resolve")}
        </button>
      </span>
    );
  }
  return (
    <span role="alert" className="flex min-w-0 items-center gap-2 text-small">
      <span className="truncate text-danger" title={save.message}>
        {t("save.failed", { reason: save.message })}
      </span>
      <button type="button" className={indicatorButton} onClick={onRetry}>
        {t("save.retry")}
      </button>
    </span>
  );
}
