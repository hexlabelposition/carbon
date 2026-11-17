import type { NotePath, SaveState, Vault } from "@carbon/core";
import { useState, type ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import { ConflictDialog } from "./ConflictDialog";
import { MarkdownEditor } from "./MarkdownEditor";
import { NoteTitleField } from "./NoteTitleField";
import type { OutlineLink } from "./outline";
import { useNoteDocument } from "./use-note-document";
import { ImageViewer } from "./ImageViewer";
import { useNoteImages } from "./use-note-images";
import { useWheelTextSize } from "./use-wheel-text-size";
import { useNoteLinks } from "./use-note-links";
import { useNoteTags } from "./use-note-tags";
import { useNoteTitle } from "./use-note-title";
import { SOURCE_MODE_SHORTCUT } from "./use-source-mode";
import { Tooltip } from "../ui/Tooltip";
import { ScrollArea } from "../ui/ScrollArea";
import { NoteStatsBar } from "./NoteStatsBar";
import type { NoteStats } from "./note-stats";

interface NoteEditorProps {
  vault: Vault;
  path: NotePath;
  /** Back and forward, at the start of the bar above the note. */
  history?: ReactNode;
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
 * The editor of one note, with back and forward, its name and save state
 * above it. Mount it
 * with `key={path}`, so each note gets an editor of its own.
 */
export function NoteEditor({
  vault,
  path,
  history,
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
  const tags = useNoteTags(vault, path);
  const title = useNoteTitle(vault, path);
  const { reveal } = useWorkspace();
  const wheelTextSize = useWheelTextSize();
  /** The user closed the conflict question without answering it. */
  const [postponed, setPostponed] = useState(false);
  /** For the bar below the note: once the editor has counted. */
  const [stats, setStats] = useState<NoteStats | null>(null);

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
    // Ctrl and the wheel anywhere over the note change its text size.
    <div ref={wheelTextSize} className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-1.5">
        {history}
        <Tooltip label={path}>
          <span className="min-w-0 flex-1 truncate px-2 text-muted">
            {name}
          </span>
        </Tooltip>
        <SaveIndicator
          save={note.save}
          onRetry={actions.saveNow}
          onResolve={() => setPostponed(false)}
        />
        <ModeButton
          label={t("editor.source")}
          hint={t("editor.sourceHint")}
          shortcut={SOURCE_MODE_SHORTCUT}
          pressed={sourceMode}
          onToggle={onToggleSourceMode}
        >
          <path d="M5 4.5 1.5 8 5 11.5M11 4.5 14.5 8 11 11.5M9.25 2.75l-2.5 10.5" />
        </ModeButton>
        <ModeButton
          label={t("editor.read")}
          hint={t("editor.readHint")}
          pressed={readingMode}
          onToggle={onToggleReadingMode}
        >
          <path d="M8 4.25C6.5 3.1 4.5 2.75 1.75 2.75v9.75c2.75 0 4.75.35 6.25 1.5 1.5-1.15 3.5-1.5 6.25-1.5V2.75C11.5 2.75 9.5 3.1 8 4.25zM8 4.25V14" />
        </ModeButton>
      </header>
      {images.error !== null && (
        <EditorAlert message={images.error} onDismiss={images.dismissError} />
      )}
      {links.error !== null && (
        <EditorAlert message={links.error} onDismiss={links.dismissError} />
      )}
      {/* One scroll for the name and the text: the name scrolls away.
          No CSS glide: on a long jump the editor measures the lines it
          passes and sets `scrollTop` again to keep its place, and each of
          those would start a CSS glide anew, so the scroll stopped short.
          The outline glides by itself instead (`glideTo`). */}
      <ScrollArea
        rootClassName="flex-1"
        // The name and the editor fill the height: a click below the text
        // still puts the cursor in it.
        contentClassName="flex min-h-full flex-1 flex-col"
        // To read, the scroll takes the focus on a click, so Page Up and
        // Page Down, the arrows and Space scroll it: the text cannot. The
        // editor keeps a click from focusing it, so it is focused here.
        tabIndex={readingMode ? -1 : undefined}
        onMouseDown={(event) => {
          if (readingMode) event.currentTarget.focus({ preventScroll: true });
        }}
        className="flex flex-1 flex-col"
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
          tags={tags}
          reveal={reveal?.path === path ? reveal : null}
          onStats={setStats}
        />
      </ScrollArea>
      {stats !== null && <NoteStatsBar stats={stats} />}
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

/**
 * A mode of the note that is on or off, as an icon in a square, lit while
 * on, as the buttons of the toolbar: source (code brackets) and reading
 * (an open book). The name is for screen readers, the hint in the tooltip.
 */
function ModeButton({
  label,
  hint,
  shortcut,
  pressed,
  onToggle,
  children,
}: {
  label: string;
  hint: string;
  shortcut?: string;
  pressed: boolean;
  onToggle: () => void;
  /** The shapes of the icon, drawn on 16 by 16. */
  children: ReactNode;
}) {
  return (
    <Tooltip label={hint} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-100 hover:bg-selected hover:text-fg ${
          pressed ? "bg-selected text-fg" : "text-muted"
        }`}
        onClick={onToggle}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </svg>
      </button>
    </Tooltip>
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
  if (save.status === "saved" || save.status === "unsaved") {
    const saved = save.status === "saved";
    const label = t(saved ? "save.saved" : "save.unsaved");
    // A mark in place of a word, told apart by its shape: a dot while
    // there are edits to save, a tick drawn in once they are on disk.
    // The word is in the tooltip and for screen readers.
    return (
      <Tooltip label={label}>
        <span
          role="status"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-faint transition-colors duration-100 hover:bg-selected hover:text-muted"
        >
          <span className="sr-only">{label}</span>
          {saved ? (
            <svg
              key="saved"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M3.5 8.5l3 3 6-7"
                pathLength={1}
                className="cb-save-tick"
              />
            </svg>
          ) : (
            <span
              key="unsaved"
              aria-hidden="true"
              className="cb-save-dot size-2 rounded-full bg-muted"
            />
          )}
        </span>
      </Tooltip>
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
      <Tooltip label={save.message}>
        <span className="truncate text-danger">
          {t("save.failed", { reason: save.message })}
        </span>
      </Tooltip>
      <button type="button" className={indicatorButton} onClick={onRetry}>
        {t("save.retry")}
      </button>
    </span>
  );
}
