import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { editorTheme, markdownHighlight } from "./editor-theme";
import { livePreview } from "./live-preview";
import { imageHost, imagePreview, type ImageHost } from "./live-preview-image";
import { tablePreview } from "./live-preview-table";

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
}

/** A CodeMirror 6 editor for one Markdown text. */
export function MarkdownEditor({
  text,
  revision,
  label,
  onChange,
  onSave,
  images,
}: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  // The latest values, so new ones do not rebuild the editor.
  const latest = useRef({ text, onChange, onSave, images });
  useEffect(() => {
    latest.current = { text, onChange, onSave, images };
  }, [text, onChange, onSave, images]);

  useEffect(() => {
    if (host.current === null) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latest.current.text,
        extensions: [
          history(),
          EditorView.lineWrapping,
          // GitHub Flavored Markdown: tables, task lists, strikethrough.
          // The language of a code block is loaded when one first uses it.
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(markdownHighlight),
          livePreview,
          tablePreview,
          imagePreview,
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
          }),
          editorTheme,
          // Tab indents, as a notes editor should. Escape, then Tab, moves
          // the focus out of the editor instead.
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
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, [label]);

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

  return <div ref={host} className="h-full" />;
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
