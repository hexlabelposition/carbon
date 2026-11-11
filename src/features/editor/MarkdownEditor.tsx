import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { editorTheme, markdownHighlight } from "./editor-theme";

interface MarkdownEditorProps {
  /**
   * The text to start with. The editor owns the text from then on; to show
   * another note, mount a new editor (give it another `key`).
   */
  initialText: string;
  /** What is being edited, for screen readers. */
  label: string;
  /** Called with the whole text after every edit. */
  onChange?: (text: string) => void;
  /** Called when the user asks to save: Ctrl+S, or Cmd+S on a Mac. */
  onSave?: () => void;
}

/** A CodeMirror 6 editor for one Markdown text. */
export function MarkdownEditor({
  initialText,
  label,
  onChange,
  onSave,
}: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  // The latest callbacks, so new ones do not rebuild the editor.
  const changed = useRef(onChange);
  const save = useRef(onSave);
  useEffect(() => {
    changed.current = onChange;
    save.current = onSave;
  }, [onChange, onSave]);

  useEffect(() => {
    if (host.current === null) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          // GitHub Flavored Markdown: tables, task lists, strikethrough.
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(markdownHighlight),
          editorTheme,
          // Tab indents, as a notes editor should. Escape, then Tab, moves
          // the focus out of the editor instead.
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                save.current?.();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              changed.current?.(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    return () => view.destroy();
  }, [initialText, label]);

  return <div ref={host} className="h-full" />;
}
