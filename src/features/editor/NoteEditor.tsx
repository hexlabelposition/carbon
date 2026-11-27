import type { NotePath, SaveState, Vault } from "@carbon/core";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import { ConflictDialog } from "./ConflictDialog";
import { MarkdownEditor } from "./MarkdownEditor";
import { NoteNameField } from "./NoteNameField";
import { NoteTitleField } from "./NoteTitleField";
import type { OutlineLink } from "./outline";
import { useNoteDocument } from "./use-note-document";
import { ImageViewer } from "./ImageViewer";
import { useNoteImages } from "./use-note-images";
import { useWheelTextSize } from "./use-wheel-text-size";
import { useNoteLinks } from "./use-note-links";
import { useNoteTags } from "./use-note-tags";
import { useNoteTitle } from "./use-note-title";
import { Tooltip } from "../ui/Tooltip";
import { ScrollArea } from "../ui/ScrollArea";
import { NoteStatsBar } from "./NoteStatsBar";
import { hiddenStatsPreference } from "./stats-parts";
import type { NoteStats } from "./note-stats";
import { focusOnOpenPreference } from "../settings/editor-options";
import {
  formatBarPreference,
  inlineTitlePreference,
  noteBordersPreference,
  noteWidthPreference,
} from "../settings/note-style";
import type { EditorView } from "@codemirror/view";
import { FormatBar, FormatBarIcon } from "./FormatBar";
import { NoteModeMenu } from "./NoteModeMenu";
import type { NoteMode } from "./use-note-mode";
import { useFormatNote } from "./use-format-note";

interface NoteEditorProps {
  vault: Vault;
  path: NotePath;
  /** Back and forward, at the start of the bar above the note. */
  history?: ReactNode;
  /** Live preview, the raw Markdown, or to read: only tasks can be ticked. */
  mode: NoteMode;
  onModeChange: (mode: NoteMode) => void;
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
  mode,
  onModeChange,
  outline,
  active = false,
}: NoteEditorProps) {
  const t = useT();
  const readingMode = mode === "reading";
  const [note, actions] = useNoteDocument(vault, path);
  const images = useNoteImages(
    vault,
    path,
    note.status === "ready" ? note.text : null,
  );
  const links = useNoteLinks(vault, path);
  const tags = useNoteTags(vault, path);
  const title = useNoteTitle(vault, path);
  const { reveal } = useWorkspace();
  const wheelTextSize = useWheelTextSize();
  /** The user closed the conflict question without answering it. */
  const [postponed, setPostponed] = useState(false);
  /** For the bar below the note: once the editor has counted. */
  const [stats, setStats] = useState<NoteStats | null>(null);
  /**
   * Whether the note takes the focus once it is shown, read as it opens:
   * only the note of the active pane, as the settings choose.
   */
  const [focusAtOpen] = useState(() => active && focusOnOpenPreference.get());
  const inlineTitle = inlineTitlePreference.use();
  const showBorders = noteBordersPreference.use();
  const width = noteWidthPreference.use();
  // At full width the column has no sides of its own: no lines.
  const borders = showBorders && width !== "full";
  const formatBar = formatBarPreference.use();
  /** The CodeMirror view, for the formatting bar. */
  const editorView = useRef<EditorView | null>(null);
  const formatNote = useFormatNote(
    useCallback(() => editorView.current, []),
    active,
    readingMode,
  );
  const scroll = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  const ready = note.status === "ready" && images.ready;
  // The scroll takes the focus, not the text: no cursor is put anywhere
  // until a click, and the keys scroll the note.
  useLayoutEffect(() => {
    if (!ready || shown.current) return;
    shown.current = true;
    if (focusAtOpen) scroll.current?.focus({ preventScroll: true });
  }, [ready, focusAtOpen]);

  // Shown once its images in sight have their size (`useNoteImages`).
  if (note.status === "loading" || (note.status === "ready" && !images.ready)) {
    return null;
  }
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
        <NoteNameField path={path} title={title} readOnly={readingMode} />
        {/* Nothing is formatted while reading: the buttons wait for
            editing. */}
        <Tooltip label={t("editor.formatNote")} shortcut={formatNote.shortcut}>
          <button
            type="button"
            aria-label={t("editor.formatNote")}
            disabled={readingMode}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-100 hover:bg-selected hover:text-fg disabled:pointer-events-none disabled:opacity-40"
            onClick={formatNote.run}
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* A wand, with sparks by its tip. */}
              <path d="M2.5 13.5l7.25-7.25M8.5 5l2.5 2.5M11.5 1.75v2M10.5 2.75h2M13.75 5.5v2M12.75 6.5h2M5 2v1.5M4.25 2.75h1.5" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip label={t("format.bar")}>
          <button
            type="button"
            aria-label={t("format.bar")}
            aria-pressed={formatBar}
            disabled={readingMode}
            className={
              "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-100 hover:bg-selected hover:text-fg disabled:pointer-events-none disabled:opacity-40 " +
              (formatBar && !readingMode ? "text-fg" : "text-muted")
            }
            onClick={() => formatBarPreference.set(!formatBar)}
          >
            <FormatBarIcon className="size-5" />
          </button>
        </Tooltip>
        <NoteModeMenu mode={mode} onChange={onModeChange} />
      </header>
      {images.error !== null && (
        <EditorAlert message={images.error} onDismiss={images.dismissError} />
      )}
      {links.error !== null && (
        <EditorAlert message={links.error} onDismiss={links.dismissError} />
      )}
      {/* The title above the text tells it itself, when it is shown. */}
      {title.error !== null && !inlineTitle && (
        <EditorAlert
          message={t("editor.renameFailed", { reason: title.error })}
          onDismiss={title.dismissError}
        />
      )}
      {/* One scroll for the name and the text: the name scrolls away.
          No CSS glide: on a long jump the editor measures the lines it
          passes and sets `scrollTop` again to keep its place, and each of
          those would start a CSS glide anew, so the scroll stopped short.
          The outline glides by itself instead (`glideTo`). */}
      {/* The formatting bar floats over the bottom of the text. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ScrollArea
          ref={scroll}
          rootClassName="flex-1"
          // The name and the editor fill the height: a click below the text
          // still puts the cursor in it. Grown by the text, never held to
          // the height of the view: the scrollbar watches its size, and
          // would not see the text grow with a larger text size.
          contentClassName="relative flex shrink-0 grow flex-col"
          // To read, the scroll takes the focus on a click, so Page Up and
          // Page Down, the arrows and Space scroll it: the text cannot. The
          // editor keeps a click from focusing it, so it is focused here.
          // To edit, it can be focused too, by a note that opens; a click
          // on the text still puts the cursor in the editor.
          tabIndex={-1}
          onMouseDown={(event) => {
            if (readingMode) event.currentTarget.focus({ preventScroll: true });
          }}
          className="flex flex-1 flex-col"
        >
          {/* Lines down both sides of the column of the note, as wide as
              its text and the whole height, the name above it too. */}
          {borders && (
            <div
              aria-hidden="true"
              className="cb-note-column pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-(--cb-note-width) -translate-x-1/2 border-x border-line"
            />
          )}
          {inlineTitle ? (
            <NoteTitleField title={title} readOnly={readingMode} />
          ) : (
            // Without the title, the text keeps some room below the bar.
            <div aria-hidden="true" className="h-8 shrink-0" />
          )}
          <MarkdownEditor
            text={note.text}
            revision={note.revision}
            label={path}
            onChange={actions.edited}
            onSave={actions.saveNow}
            images={images.host}
            sourceMode={mode === "source"}
            readOnly={readingMode}
            outline={outline}
            active={active}
            links={links.host}
            tags={tags}
            reveal={reveal?.path === path ? reveal : null}
            onStats={setStats}
            onView={(view) => {
              editorView.current = view;
            }}
          />
        </ScrollArea>
        {formatBar && !readingMode && (
          <FormatBar view={() => editorView.current} />
        )}
      </div>
      <NoteStatsBar
        stats={stats}
        status={
          <SaveIndicator
            save={note.save}
            onRetry={actions.saveNow}
            onResolve={() => setPostponed(false)}
          />
        }
      />
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

/**
 * Tells whether the edits are on disk, at the start of the bar below the
 * note (`NoteStatsBar`). Never by color alone. That they are, or are
 * being saved, can be hidden from the menu of the bar.
 */
function SaveIndicator({ save, onRetry, onResolve }: SaveIndicatorProps) {
  const t = useT();
  // Hidden from the menu of the bar: only that all is well. A save that
  // failed and a conflict are told all the same.
  const showSaved = !hiddenStatsPreference.use().includes("save");
  if (save.status === "saved" || save.status === "unsaved") {
    if (!showSaved) return null;
    const saved = save.status === "saved";
    const label = t(saved ? "save.saved" : "save.unsaved");
    // A mark and a word, the mark told apart by its shape: a dot while
    // there are edits to save, a tick drawn in once they are on disk.
    return (
      <span role="status" className="flex shrink-0 items-center gap-1.5">
        {/* As wide for both, so the word does not move. */}
        <span className="flex size-3.5 items-center justify-center">
          {saved ? (
            <svg
              key="saved"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
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
              className="cb-save-dot size-1.5 rounded-full bg-muted"
            />
          )}
        </span>
        {label}
      </span>
    );
  }
  if (save.status === "conflict") {
    return (
      <span role="alert" className="flex min-w-0 items-center gap-2">
        <span className="truncate text-danger">{t("save.conflict")}</span>
        <button type="button" className={indicatorButton} onClick={onResolve}>
          {t("save.resolve")}
        </button>
      </span>
    );
  }
  return (
    <span role="alert" className="flex min-w-0 items-center gap-2">
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
