import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { blockId, hashtag, wikiLink } from "@carbon/core";
import {
  Compartment,
  EditorState,
  Transaction,
  type Extension,
} from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  editorTheme,
  markdownHighlight,
  sourceHighlight,
} from "./editor-theme";
import { scrollParentOf } from "./glide";
import { shortcutLetter } from "../workspace/shortcut-letter";
import { EditorContextMenu } from "./EditorContextMenu";
import { heldSelection } from "./held-selection";
import { markdownInput } from "./markdown-input";
import { noteTextStats, textStats, type NoteStats } from "./note-stats";
import { findReplace, openReplace } from "./find-replace";
import { layoutIndependentKeys } from "./layout-keys";
import { isMac, keys, useCommands } from "../commands/commands";
import { openSearchPanel } from "@codemirror/search";
import { livePreview } from "./live-preview";
import { listGuides } from "./list-guides";
import { listHangingIndent } from "./list-hanging-indent";
import { listContinueKeymap } from "./list-continue";
import { listGuidesPreference } from "../settings/note-style";
import { codeLanguage } from "./code-languages";
import {
  imageHost,
  imageInput,
  imagePreview,
  type ImageHost,
} from "./live-preview-image";
import { linkCompletion, linkHost, type LinkHost } from "./link-completion";
import {
  indentPreference,
  indentText,
  type Indent,
} from "../settings/editor-options";
import { tagHost, type TagHost } from "./tag-completion";
import { followOnClick, followOnModClick } from "./link-follow";
import {
  openWebLinkOnClick,
  useOpenWebLink,
  webLinkOpener,
  webLinkStyle,
} from "./web-link";
import { linkPreview } from "./link-preview";
import { formatPlaceholder } from "./formatting";
import { t as translate, useT } from "../i18n/i18n";
import { missingLinks } from "./missing-links";
import { tablePreview } from "./live-preview-table";
import { embedPreview } from "./live-preview-embed";
import { addProperty, frontmatterPreview } from "./live-preview-frontmatter";
import {
  outlineHost,
  outlineOf,
  outlineTracker,
  revealHeading,
  type OutlineLink,
} from "./outline";

interface MarkdownEditorProps {
  /**
   * The text to show. The editor owns the text while the user types; it
   * takes `text` again only when `revision` changes, which is how a note
   * that changed on disk is shown. To edit another note, mount a new
   * editor (give it another `key`).
   */
  text: string;
  revision: number;
  /** What is being edited, for screen readers. */
  label: string;
  /** Called with the whole text after every edit the user makes. */
  onChange?: (text: string) => void;
  /** Called when the user asks to save: Ctrl+S, or Cmd+S on a Mac. */
  onSave?: () => void;
  /** Shows the images of the note and saves pasted and dropped ones. */
  images?: ImageHost;
  /** Shows the raw Markdown: no live preview, every mark visible. */
  sourceMode?: boolean;
  /** Shows the note to read: no cursor, no typing; tasks can be ticked. */
  readOnly?: boolean;
  /**
   * Receives the headings of the note and lets them be gone to. Given
   * later, or given again, it is told the headings at once: an editor in
   * a pane that becomes active takes the outline over.
   */
  outline?: OutlineLink;
  /** Suggests notes to link to after "[[", and follows links. */
  links?: LinkHost;
  /** Suggests tags while one is typed; without it, none are. */
  tags?: TagHost;
  /**
   * Told how long the note is and what is selected: at once, then as the
   * selection changes, and a moment after the text changes.
   */
  onStats?: (stats: NoteStats) => void;
  /**
   * A place to go to: the cursor moves to offset `at` and the editor
   * scrolls it into view. A new `id` goes there again.
   */
  reveal?: { at: number; id: number } | null;
  /**
   * The editor the user works in: it offers its commands, such as "Find
   * in note", in the command palette.
   */
  active?: boolean;
  /** Told of the CodeMirror view once it is made, and `null` as it goes. */
  onView?: (view: EditorView | null) => void;
}

/** How long typing must stop before the whole note is counted again. */
const STATS_DELAY_MS = 200;

/** Everything live preview adds; source mode leaves it out. */
const livePreviewExtensions: Extension = [
  livePreview,
  frontmatterPreview,
  tablePreview,
  imagePreview,
  embedPreview,
  followOnClick,
  webLinkStyle,
];
const noPreview: Extension = [syntaxHighlighting(sourceHighlight)];

/** A CodeMirror 6 editor for one Markdown text. */
export function MarkdownEditor({
  text,
  revision,
  label,
  onChange,
  onSave,
  images,
  sourceMode = false,
  readOnly = false,
  outline,
  links,
  tags,
  reveal = null,
  active = false,
  onStats,
  onView,
}: MarkdownEditorProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  /** Holds the live preview, so it can be turned off and on in place. */
  const preview = useRef(new Compartment());
  /** Holds whether the note can be edited, switched in place too. */
  const editing = useRef(new Compartment());
  /** Holds the indent the settings choose. */
  const options = useRef(new Compartment());
  const indent = indentPreference.use();
  /** Holds the lines along nested lists, while the settings show them. */
  const guides = useRef(new Compartment());
  const showGuides = listGuidesPreference.use();
  /** How web links and email addresses open, from the app. */
  const openWebLink = useOpenWebLink();
  // The latest values, so new ones do not rebuild the editor.
  const latest = useRef({
    text,
    onChange,
    onSave,
    images,
    sourceMode,
    readOnly,
    outline,
    links,
    tags,
    onStats,
    openWebLink,
  });
  useEffect(() => {
    latest.current = {
      text,
      onChange,
      onSave,
      images,
      sourceMode,
      readOnly,
      outline,
      links,
      tags,
      onStats,
      openWebLink,
    };
  }, [
    text,
    onChange,
    onSave,
    images,
    sourceMode,
    readOnly,
    outline,
    links,
    tags,
    onStats,
    openWebLink,
  ]);

  // The latest `onView`, so a new one does not rebuild the editor.
  const latestView = useRef(onView);
  useEffect(() => {
    latestView.current = onView;
  }, [onView]);

  // Before the first paint, so a note never shows as an empty area first.
  useLayoutEffect(() => {
    if (host.current === null) return;
    // The whole text is counted a moment after typing stops, not on every
    // key: a long note would slow typing down. A selection is counted at
    // once, it is short.
    let counted = noteTextStats(latest.current.text);
    let counting: ReturnType<typeof setTimeout> | undefined;
    const report = (state: EditorState) => {
      const { from, to, empty } = state.selection.main;
      latest.current.onStats?.({
        text: counted,
        selection: empty ? null : textStats(state.sliceDoc(from, to)),
      });
    };
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latest.current.text,
        extensions: [
          history(),
          // The cursor is drawn by the editor: the caret of WebKitGTK lagged
          // behind a change next to a widget, such as Tab in a list, and the
          // old one stayed on screen for a while. The selection stays the
          // one of the page (`editorTheme`).
          drawSelection(),
          EditorView.lineWrapping,
          // GitHub Flavored Markdown: tables, task lists, strikethrough.
          // The language of a code block is loaded when one first uses it,
          // found by its name or by the file the fence names.
          // Wiki links, tags and block ids come from the core: one grammar for the
          // editor and the index (ADR-012).
          markdown({
            base: markdownLanguage,
            codeLanguages: codeLanguage,
            extensions: [wikiLink, hashtag, blockId],
            // Its Enter adds a blank line in a loose list: ours does not.
            addKeymap: false,
          }),
          listContinueKeymap,
          syntaxHighlighting(markdownHighlight),
          preview.current.of(
            latest.current.sourceMode ? noPreview : livePreviewExtensions,
          ),
          editing.current.of(editable(!latest.current.readOnly)),
          options.current.of(editorOptions(indentPreference.get())),
          guides.current.of(listGuidesPreference.get() ? listGuides : []),
          listHangingIndent,
          imageInput,
          imageHost.of({
            load: (target) =>
              latest.current.images?.load(target) ?? Promise.resolve(null),
            save: (file) =>
              latest.current.images?.save(file) ??
              Promise.reject(new Error("Images cannot be saved here")),
            importFile: (path) =>
              latest.current.images?.importFile(path) ??
              Promise.reject(new Error("Images cannot be saved here")),
            refuse: (reason) => latest.current.images?.refuse(reason),
            open: (image) => latest.current.images?.open(image),
            get sizes() {
              return latest.current.images?.sizes;
            },
          }),
          linkCompletion,
          // The word the formatting bar puts on an empty line to type over.
          formatPlaceholder.of(translate("format.placeholder")),
          markdownInput,
          followOnModClick,
          openWebLinkOnClick,
          webLinkOpener.of((url) =>
            latest.current.openWebLink === null
              ? Promise.reject(new Error("Links cannot be opened here"))
              : latest.current.openWebLink(url),
          ),
          linkPreview,
          missingLinks,
          linkHost.of({
            notes: () => latest.current.links?.notes() ?? Promise.resolve([]),
            aliases: () =>
              latest.current.links?.aliases() ?? Promise.resolve([]),
            get current() {
              return latest.current.links?.current ?? "";
            },
            headings: (target) =>
              latest.current.links?.headings(target) ?? Promise.resolve([]),
            blocks: (target) =>
              latest.current.links?.blocks(target) ?? Promise.resolve([]),
            blockId: (target, from) =>
              latest.current.links?.blockId(target, from) ??
              Promise.resolve(null),
            missing: (targets) =>
              latest.current.links?.missing(targets) ??
              Promise.resolve(new Set()),
            onIndexChange: (listener) =>
              latest.current.links?.onIndexChange(listener) ?? (() => {}),
            preview: (link) =>
              latest.current.links?.preview(link) ??
              Promise.reject(new Error("No preview here")),
            follow: (link, options) =>
              latest.current.links?.follow(link, options),
          }),
          tagHost.of({
            suggestions: (written) =>
              latest.current.tags?.suggestions(written) ?? Promise.resolve([]),
          }),
          outlineTracker,
          outlineHost.of({
            headings: (list) => latest.current.outline?.headings(list),
            current: (index) => latest.current.outline?.current(index),
          }),
          findReplace,
          layoutIndependentKeys,
          editorTheme,
          heldSelection,
          // Tab indents, as a notes editor should. It never moves the focus
          // out: the app turns that off (useTabFocusGuard).
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                latest.current.onSave?.();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            // Text that came from disk is not an edit to save.
            const fromDisk = update.transactions.some((transaction) =>
              transaction.annotation(Transaction.remote),
            );
            if (update.docChanged && !fromDisk) {
              latest.current.onChange?.(update.state.doc.toString());
            }
            if (update.docChanged) {
              clearTimeout(counting);
              counting = setTimeout(() => {
                counted = noteTextStats(view.state.doc.toString());
                report(view.state);
              }, STATS_DELAY_MS);
            }
            if (update.selectionSet) report(update.state);
          }),
        ],
      }),
    });
    editor.current = view;
    report(view.state);
    latestView.current?.(view);
    return () => {
      clearTimeout(counting);
      editor.current = null;
      latestView.current?.(null);
      view.destroy();
    };
  }, [label]);

  useCommands(
    useMemo(() => {
      if (!active) return [];
      return [
        {
          id: "editor.find",
          title: t("find.label"),
          shortcut: keys("Mod+F"),
          run: () => {
            if (editor.current !== null) openSearchPanel(editor.current);
          },
        },
        {
          id: "editor.addProperty",
          title: t("editor.addProperty"),
          run: () => {
            const view = editor.current;
            // The block that takes it is drawn only in live preview.
            if (view === null || latest.current.sourceMode) return;
            if (latest.current.readOnly) return;
            addProperty(view);
          },
        },
        {
          id: "editor.replace",
          title: t("editor.replaceInNote"),
          shortcut: keys("Mod+H"),
          run: () => {
            if (editor.current !== null) openReplace(editor.current);
          },
        },
      ];
    }, [t, active]),
  );

  // After the editor is made: the outline it is given hears of the note.
  useEffect(() => {
    const view = editor.current;
    if (view === null || outline === undefined) return;
    const { headings, current } = outlineOf(view.state);
    outline.headings(headings);
    outline.current(current);
    return outline.connect((index) => revealHeading(view, index));
  }, [outline, label]);

  useEffect(() => {
    const view = editor.current;
    if (view === null) return;
    const extensions = sourceMode ? noPreview : livePreviewExtensions;
    if (preview.current.get(view.state) === extensions) return;
    // Lines change height when the marks show or hide: the line at the
    // top of the view stays where it is.
    keepingPlace(view, () =>
      view.dispatch({ effects: preview.current.reconfigure(extensions) }),
    );
  }, [sourceMode]);

  useEffect(() => {
    editor.current?.dispatch({
      effects: options.current.reconfigure(editorOptions(indent)),
    });
  }, [indent]);

  useEffect(() => {
    editor.current?.dispatch({
      effects: guides.current.reconfigure(showGuides ? listGuides : []),
    });
  }, [showGuides]);

  useEffect(() => {
    const view = editor.current;
    if (view === null) return;
    view.dispatch({
      effects: editing.current.reconfigure(editable(!readOnly)),
    });
    // Out of the editor: the cursor and the Markdown under it go away.
    if (readOnly && view.hasFocus) view.contentDOM.blur();
  }, [readOnly]);

  // The note around the editor holds the focus, as when it was just
  // opened or is read: the keymap of the editor does not see the keys
  // there, so find and replace are opened from here.
  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      const view = editor.current;
      if (view === null || event.defaultPrevented) return;
      // Ctrl, or Cmd on a Mac, alone: as the keymap of the editor.
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey) return;
      // Only around the editor: in the text, its keymap does it.
      const target = event.target;
      if (!(target instanceof Node) || !target.contains(view.dom)) return;
      const letter = shortcutLetter(event);
      if (letter === "f") openSearchPanel(view);
      else if (letter === "h" && !latest.current.readOnly) openReplace(view);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  // After the editor is made, so a note opened at a place goes there.
  useEffect(() => {
    const view = editor.current;
    if (view === null || reveal === null) return;
    // The offset may come from an older version of the text.
    const at = Math.min(reveal.at, view.state.doc.length);
    // Focused first, as for a heading of the outline (`revealHeading`):
    // the cursor is placed by the text with the Markdown under it shown.
    view.focus();
    view.dispatch({
      selection: { anchor: at },
      effects: EditorView.scrollIntoView(at, { y: "center" }),
    });
  }, [reveal]);

  // A new revision: show `text` in place of what the editor holds.
  useEffect(() => {
    const view = editor.current;
    if (view === null) return;
    const change = difference(view.state.doc.toString(), text);
    if (change === null) return;
    view.dispatch({
      changes: change,
      annotations: [
        Transaction.remote.of(true),
        // Undo must not bring back a version that is no longer on disk.
        Transaction.addToHistory.of(false),
      ],
    });
  }, [text, revision]);

  // Fills the space below the note name, and grows with a longer text.
  return (
    <EditorContextMenu view={() => editor.current} readOnly={readOnly}>
      <div ref={host} className="flex flex-1 flex-col" />
    </EditorContextMenu>
  );
}

/**
 * The one replacement that turns `from` into `to`, or `null` if they are
 * equal. Only the part that differs is replaced, so the cursor and the
 * scroll position stay where they are when the change is elsewhere.
 */
function difference(
  from: string,
  to: string,
): { from: number; to: number; insert: string } | null {
  if (from === to) return null;
  const shortest = Math.min(from.length, to.length);
  let start = 0;
  while (start < shortest && from[start] === to[start]) start++;
  let end = 0;
  while (
    end < shortest - start &&
    from[from.length - 1 - end] === to[to.length - 1 - end]
  ) {
    end++;
  }
  return {
    from: start,
    to: from.length - end,
    insert: to.slice(start, to.length - end),
  };
}

/**
 * Whether the user can change the note. Not editable, the text takes no
 * focus, so live preview never shows the Markdown under a cursor.
 */
/** What Tab puts in for one level (`indentWithTab` follows it). */
function editorOptions(indent: Indent) {
  const text = indentText(indent);
  return [
    indentUnit.of(text),
    // A tab is as wide as a level of spaces would be.
    EditorState.tabSize.of(indent === "tab" ? 4 : text.length),
  ];
}

function editable(on: boolean) {
  return [EditorView.editable.of(on), EditorState.readOnly.of(!on)];
}

/**
 * Runs `change`, then scrolls so that the line at the top of the view is
 * where it was before, for a change that makes lines taller or shorter.
 * At once, not gliding, whatever the scroll is set to.
 */
function keepingPlace(view: EditorView, change: () => void): void {
  const scroller = scrollParentOf(view.dom);
  if (scroller === null) {
    change();
    return;
  }
  const viewTop = scroller.getBoundingClientRect().top;
  // The line at the top of the view, and how far its top is from there.
  const at = view.lineBlockAtHeight(viewTop - view.documentTop).from;
  const offsetOf = () => view.documentTop + view.lineBlockAt(at).top - viewTop;
  const before = offsetOf();
  change();
  view.requestMeasure({
    read: offsetOf,
    write(after) {
      if (Math.abs(after - before) < 1) return;
      scroller.scrollTo({
        top: scroller.scrollTop + after - before,
        behavior: "instant",
      });
    },
  });
}
