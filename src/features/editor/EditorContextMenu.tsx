import { ContextMenu } from "@base-ui/react/context-menu";
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { keys } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";
import {
  inlineTitlePreference,
  NOTE_WIDTHS,
  noteWidthPreference,
  type NoteWidth,
} from "../settings/note-style";
import { MenuItemBody } from "../ui/MenuItemBody";
import { useClipboard } from "./clipboard";
import { codeAt, type CodeAt } from "./code-at";
import { scrollParentOf } from "./glide";
import { holdSelection } from "./held-selection";
import { pasteIntoListItem } from "./list-paste";
import { useOpenWebLink, webLinkAt, type WebLink } from "./web-link";

interface EditorContextMenuProps {
  /** The editor the menu acts on, once it is made. */
  view: () => EditorView | null;
  /** Read only: nothing can be cut or pasted. */
  readOnly: boolean;
  /** The editor, which the right button opens the menu over. */
  children: ReactNode;
}

const item =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise data-disabled:text-faint";
const separator = "mx-1 my-1 h-px bg-line";
const popup =
  "min-w-56 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none";

/** A check mark, at the right of a chosen item. */
function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/**
 * The menu of the right button in a note: undo and redo, cut, copy,
 * paste and select all, as the one of a text field in other apps. On
 * inline code or a code block it also copies that code alone, without
 * its backticks or fences, and in a block the line clicked (`codeAt`).
 * On a web link or an email address it opens it in the browser or the
 * mail app, or copies it (`webLinkAt`). At the end, the look of notes:
 * the width of their content and the inline title, as in the settings. It
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
  const [code, setCode] = useState<CodeAt | null>(null);
  /** The web link or email address it was opened on, if it was. */
  const [webLink, setWebLink] = useState<WebLink | null>(null);
  const openWebLink = useOpenWebLink();
  const width = noteWidthPreference.use();
  const inlineTitle = inlineTitlePreference.use();
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
    setCode(at === null ? null : codeAt(editor.state, at));
    setWebLink(at === null ? null : webLinkAt(editor.state, at));
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

  function copyText(text: string) {
    clipboard
      .writeText(text)
      .catch((reason: unknown) =>
        log.error("Could not copy to the clipboard", reason),
      );
  }

  function paste() {
    const editor = view();
    if (editor === null) return;
    void clipboard.readText().then((text) => {
      if (text === "") return;
      // As the keys paste it: no second marker in a list item.
      const pasted = pasteIntoListItem(text, editor.state);
      editor.dispatch(editor.state.replaceSelection(pasted), {
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
            className={popup}
          >
            {/* First: they are there only on a link or on code, so they
                are seen at once. */}
            {webLink !== null && (
              <>
                {openWebLink !== null && (
                  <ContextMenu.Item
                    className={item}
                    onClick={() =>
                      openWebLink(webLink.url).catch((reason: unknown) =>
                        log.error("Could not open a link", reason),
                      )
                    }
                  >
                    <MenuItemBody icon={webLink.email ? "email" : "openLink"}>
                      {t(
                        webLink.email ? "editor.writeEmail" : "editor.openLink",
                      )}
                    </MenuItemBody>
                  </ContextMenu.Item>
                )}
                <ContextMenu.Item
                  className={item}
                  onClick={() =>
                    copyText(
                      webLink.email
                        ? webLink.url.replace(/^mailto:/i, "")
                        : webLink.url,
                    )
                  }
                >
                  <MenuItemBody icon={webLink.email ? "copy" : "link"}>
                    {t(webLink.email ? "editor.copyEmail" : "editor.copyLink")}
                  </MenuItemBody>
                </ContextMenu.Item>
                <ContextMenu.Separator className={separator} />
              </>
            )}
            {code !== null && (
              <>
                <ContextMenu.Item
                  className={item}
                  onClick={() => copyText(code.text)}
                >
                  {/* "All" sets it apart from the line, in a block. */}
                  <MenuItemBody icon="code">
                    {t(code.block ? "editor.copyAllCode" : "editor.copyCode")}
                  </MenuItemBody>
                </ContextMenu.Item>
                {code.line !== null && (
                  <ContextMenu.Item
                    className={item}
                    onClick={() => copyText(code.line!)}
                  >
                    <MenuItemBody icon="codeLine">
                      {t("editor.copyCodeLine")}
                    </MenuItemBody>
                  </ContextMenu.Item>
                )}
                <ContextMenu.Separator className={separator} />
              </>
            )}
            <ContextMenu.Item
              className={item}
              disabled={readOnly || !steps.undo}
              onClick={() => run(undo)}
            >
              <MenuItemBody icon="undo" keys={keys("Mod+Z")}>
                {t("editor.undo")}
              </MenuItemBody>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={item}
              disabled={readOnly || !steps.redo}
              onClick={() => run(redo)}
            >
              <MenuItemBody icon="redo" keys={keys("Mod+Shift+Z")}>
                {t("editor.redo")}
              </MenuItemBody>
            </ContextMenu.Item>
            <ContextMenu.Separator className={separator} />
            <ContextMenu.Item
              className={item}
              disabled={readOnly || !selected}
              onClick={() => copy(true)}
            >
              <MenuItemBody icon="cut" keys={keys("Mod+X")}>
                {t("editor.cut")}
              </MenuItemBody>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={item}
              disabled={!selected}
              onClick={() => copy(false)}
            >
              <MenuItemBody icon="copy" keys={keys("Mod+C")}>
                {t("editor.copy")}
              </MenuItemBody>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={item}
              disabled={readOnly}
              onClick={paste}
            >
              <MenuItemBody icon="paste" keys={keys("Mod+V")}>
                {t("editor.paste")}
              </MenuItemBody>
            </ContextMenu.Item>
            <ContextMenu.Separator className={separator} />
            <ContextMenu.Item className={item} onClick={selectAll}>
              <MenuItemBody icon="selectAll" keys={keys("Mod+A")}>
                {t("editor.selectAll")}
              </MenuItemBody>
            </ContextMenu.Item>
            <ContextMenu.Separator className={separator} />
            <ContextMenu.SubmenuRoot>
              <ContextMenu.SubmenuTrigger
                className={`${item} data-popup-open:bg-raise`}
              >
                <MenuItemBody icon="noteWidth">
                  {t("settings.width")}
                </MenuItemBody>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </ContextMenu.SubmenuTrigger>
              <ContextMenu.Portal>
                <ContextMenu.Positioner
                  sideOffset={-4}
                  collisionPadding={8}
                  className="z-50 outline-none"
                >
                  <ContextMenu.Popup className={`${popup} min-w-40`}>
                    <ContextMenu.RadioGroup
                      value={width}
                      onValueChange={(value: NoteWidth) =>
                        noteWidthPreference.set(value)
                      }
                    >
                      {NOTE_WIDTHS.map(({ value, label }) => (
                        <ContextMenu.RadioItem
                          key={value}
                          value={value}
                          className={item}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {t(label)}
                          </span>
                          {/* As wide whether checked or not: they line up. */}
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            <ContextMenu.RadioItemIndicator>
                              <Check />
                            </ContextMenu.RadioItemIndicator>
                          </span>
                        </ContextMenu.RadioItem>
                      ))}
                    </ContextMenu.RadioGroup>
                  </ContextMenu.Popup>
                </ContextMenu.Positioner>
              </ContextMenu.Portal>
            </ContextMenu.SubmenuRoot>
            <ContextMenu.CheckboxItem
              className={item}
              checked={inlineTitle}
              onCheckedChange={inlineTitlePreference.set}
            >
              <MenuItemBody icon="inlineTitle">
                {t("settings.inlineTitle")}
              </MenuItemBody>
              <span className="flex size-4 shrink-0 items-center justify-center">
                <ContextMenu.CheckboxItemIndicator>
                  <Check />
                </ContextMenu.CheckboxItemIndicator>
              </span>
            </ContextMenu.CheckboxItem>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
