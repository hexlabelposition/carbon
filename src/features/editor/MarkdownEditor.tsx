import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState, Transaction } from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { editorTheme, markdownHighlight } from "./editor-theme";
import { livePreview } from "./live-preview";

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
}

/** A CodeMirror 6 editor for one Markdown text. */
export function MarkdownEditor({
  text,
  revision,
  label,
  onChange,
  onSave,
}: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  // The latest values, so new ones do not rebuild the editor.
  const latest = useRef({ text, onChange, onSave });
  useEffect(() => {
    latest.current = { text, onChange, onSave };
  }, [text, onChange, onSave]);

  useEffect(() => {
    if (host.current === null) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latest.current.text,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          // GitHub Flavored Markdown: tables, task lists, strikethrough.
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(markdownHighlight),
          livePreview,
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
