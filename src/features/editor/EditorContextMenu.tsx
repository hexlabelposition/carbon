import { ContextMenu } from "@base-ui/react/context-menu";
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { keys } from "../commands/commands";
import { Shortcut } from "../commands/Shortcut";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";
import { useClipboard } from "./clipboard";
import { codeAt } from "./code-at";
import { scrollParentOf } from "./glide";
import { holdSelection } from "./held-selection";

interface EditorContextMenuProps {
  /** The editor the menu acts on, once it is made. */
  view: () => EditorView | null;
  /** Read only: nothing can be cut or pasted. */
  readOnly: boolean;
  /** The editor, which the right button opens the menu over. */
  children: ReactNode;
}

const item =
  "flex h-7 cursor-default items-center justify-between gap-6 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise data-disabled:text-faint";
const separator = "mx-1 my-1 h-px bg-line";

/**
 * The menu of the right button in a note: undo and redo, cut, copy,
 * paste and select all, as the one of a text field in other apps. On
 * inline code or a code block it also copies that code alone, without
 * its backticks or fences (`codeAt`). It
 * takes the place of the menu of the WebView, which the app shuts
 * (`useContextMenuGuard`).
 */
export function EditorContextMenu({
  view,
  readOnly,
  children,
}: EditorContextMenuProps) {
  const t = useT();
  const clipboard = useClipboard();
  /** Whether text was selected when the menu opened. */
  const [selected, setSelected] = useState(false);
  /** The code the menu was opened on, if it was. */
  const [code, setCode] = useState<string | null>(null);
  /** Whether there were edits to undo and to redo then. */
  const [steps, setSteps] = useState({ undo: false, redo: false });
  /** Whether the text had the focus when the menu was asked for. */
  const focused = useRef(false);

  function onContextMenuCapture(event: MouseEvent<HTMLDivElement>) {
    const editor = view();
    const target = event.target as HTMLElement;
    // A field of the editor, as the one of find, is not the text: no
    // menu there, nor the one of the WebView.
    if (editor === null || target.closest("input, textarea") !== null) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    focused.current = editor.hasFocus;
    // As in a text field: a press outside the selection moves the cursor
    // there, so "Paste" puts the text where the menu was opened.
    const at = editor.posAtCoords({ x: event.clientX, y: event.clientY });
    const { ranges } = editor.state.selection;
    const inside = ranges.some(
      (r) => !r.empty && r.from <= (at ?? -1) && (at ?? -1) <= r.to,
    );
    if (at !== null && !inside && !readOnly) {
      editor.dispatch({ selection: EditorSelection.cursor(at) });
    }
    setSelected(editor.state.selection.ranges.some((r) => !r.empty));
    setCode(at === null ? null : (codeAt(editor.state, at)?.text ?? null));
    setSteps({
      undo: undoDepth(editor.state) > 0,
      redo: redoDepth(editor.state) > 0,
    });
  }

  /** The selected text, the ranges on lines of their own. */
  function selectedText(editor: EditorView): string {
    const { state } = editor;
    return state.selection.ranges
      .filter((r) => !r.empty)
      .map((r) => state.sliceDoc(r.from, r.to))
      .join(state.lineBreak);
  }

  function copy(cut: boolean) {
    const editor = view();
    if (editor === null) return;
    const text = selectedText(editor);
    if (text === "") return;
    clipboard.writeText(text).then(
      () => {
        if (!cut) return;
        editor.dispatch(editor.state.replaceSelection(""), {
          userEvent: "delete.cut",
          scrollIntoView: true,
        });
      },
      (reason: unknown) => log.error("Could not copy to the clipboard", reason),
    );
  }

  function copyCode() {
    if (code === null) return;
    clipboard
      .writeText(code)
      .catch((reason: unknown) =>
        log.error("Could not copy to the clipboard", reason),
      );
  }

  function paste() {
    const editor = view();
    if (editor === null) return;
    void clipboard.readText().then((text) => {
      if (text === "") return;
      editor.dispatch(editor.state.replaceSelection(text), {
        userEvent: "input.paste",
        scrollIntoView: true,
      });
    });
  }

  /** Runs an editor command, as undo or redo. */
  function run(command: (target: EditorView) => boolean) {
    const editor = view();
    if (editor !== null) command(editor);
  }

  function selectAll() {
    const editor = view();
    if (editor === null) return;
    editor.dispatch({
      selection: EditorSelection.range(0, editor.state.doc.length),
    });
  }

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        // The menu takes the focus: the text stays as it was while it had
        // it, the selection and the Markdown under the cursor in sight.
        // Let go when the text has the focus back (`heldSelection`): let
        // go before, live preview would hide the Markdown for a moment.
        const editor = view();
        if (editor === null || !open) return;
        holdSelection(editor, focused.current && !readOnly);
      }}
      onOpenChangeComplete={(open) => {
        // The focus went elsewhere, as to what was clicked to close it.
        // In a later task: base-ui gives the focus back after this, in a
        // microtask, and the text would be let go before it has it.
        const editor = view();
        if (editor === null || open) return;
        setTimeout(() => {
          if (!editor.hasFocus) holdSelection(editor, false);
        }, 0);
      }}
    >
      <ContextMenu.Trigger
        className="flex flex-1 flex-col"
        onContextMenuCapture={onContextMenuCapture}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50 outline-none">
          <ContextMenu.Popup
            // Back to the text, where the cursor is; to read, to the scroll
            // of the note, so the keys scroll it.
            finalFocus={() => {
              const editor = view();
              if (editor === null) return false;
              if (!readOnly) return editor.contentDOM;
              return scrollParentOf(editor.dom) ?? false;
            }}
            className="min-w-56 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none"
          >
            {/* First: it is there only on code, so it is seen at once. */}
            {code !== null && (
              <>
                <ContextMenu.Item className={item} onClick={copyCode}>
                  {t("editor.copyCode")}
                </ContextMenu.Item>
                <ContextMenu.Separator className={separator} />
              </>
            )}
            <ContextMenu.Item
              className={item}
              disabled={readOnly || !steps.undo}
              onClick={() => run(undo)}
            >
              {t("editor.undo")}
              <Shortcut text={keys("Mod+Z")} />
            </ContextMenu.Item>
            <ContextMenu.Item
              className={item}
              disabled={readOnly || !steps.redo}
              onClick={() => run(redo)}
            >
              {t("editor.redo")}
              <Shortcut text={keys("Mod+Shift+Z")} />
            </ContextMenu.Item>
            <ContextMenu.Separator className={separator} />
            <ContextMenu.Item
              className={item}
              disabled={readOnly || !selected}
              onClick={() => copy(true)}
            >
              {t("editor.cut")}
              <Shortcut text={keys("Mod+X")} />
            </ContextMenu.Item>
            <ContextMenu.Item
              className={item}
              disabled={!selected}
              onClick={() => copy(false)}
            >
              {t("editor.copy")}
              <Shortcut text={keys("Mod+C")} />
            </ContextMenu.Item>
            <ContextMenu.Item
              className={item}
              disabled={readOnly}
              onClick={paste}
            >
              {t("editor.paste")}
              <Shortcut text={keys("Mod+V")} />
            </ContextMenu.Item>
            <ContextMenu.Separator className={separator} />
            <ContextMenu.Item className={item} onClick={selectAll}>
              {t("editor.selectAll")}
              <Shortcut text={keys("Mod+A")} />
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
