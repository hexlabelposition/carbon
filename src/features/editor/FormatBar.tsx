import type { EditorView } from "@codemirror/view";
import { Fragment, type ReactNode } from "react";
import { useT, type MessageKey } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import {
  clearFormatting,
  cycleHeading,
  insertLink,
  toggleBold,
  toggleBulletList,
  toggleCodeBlock,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toggleQuote,
  toggleStrikethrough,
  toggleTaskList,
  type FormatCommand,
} from "./formatting";

interface FormatButton {
  label: MessageKey;
  command: FormatCommand;
  /** The shapes of its icon, drawn on 16 by 16. */
  icon: ReactNode;
}

/** The buttons, in groups: inline marks, blocks, and clearing them. */
const GROUPS: FormatButton[][] = [
  [
    {
      label: "format.bold",
      command: toggleBold,
      icon: (
        <path
          strokeWidth="1.6"
          d="M4.75 2.75h4a2.6 2.6 0 0 1 0 5.25h-4zM4.75 8h4.75a2.63 2.63 0 0 1 0 5.25H4.75z"
        />
      ),
    },
    {
      label: "format.italic",
      command: toggleItalic,
      icon: <path d="M10.5 2.75H6.75M9.25 13.25H5.5M9.25 2.75 6.75 13.25" />,
    },
    {
      label: "format.strikethrough",
      command: toggleStrikethrough,
      icon: (
        <path d="M2.75 8h10.5M11 4.75c-.4-1.2-1.55-2-3-2-1.75 0-3 .95-3 2.3 0 .8.4 1.4 1.2 1.85M5 11.1c.35 1.3 1.55 2.15 3.1 2.15 1.9 0 3.15-1 3.15-2.45 0-.5-.15-.95-.45-1.3" />
      ),
    },
    {
      label: "format.code",
      command: toggleInlineCode,
      icon: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />,
    },
    {
      label: "format.link",
      command: insertLink,
      icon: (
        <path d="M6.9 9.1a2.6 2.6 0 0 0 3.7 0l2.1-2.1A2.6 2.6 0 0 0 9 3.3l-.8.8M9.1 6.9a2.6 2.6 0 0 0-3.7 0L3.3 9A2.6 2.6 0 0 0 7 12.7l.8-.8" />
      ),
    },
  ],
  [
    {
      label: "format.heading",
      command: cycleHeading,
      icon: <path d="M3.5 3v10M11.5 3v10M3.5 8h8" />,
    },
    {
      label: "format.bulletList",
      command: toggleBulletList,
      icon: (
        <>
          <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
          <circle cx="3" cy="4" r=".5" fill="currentColor" />
          <circle cx="3" cy="8" r=".5" fill="currentColor" />
          <circle cx="3" cy="12" r=".5" fill="currentColor" />
        </>
      ),
    },
    {
      label: "format.orderedList",
      command: toggleOrderedList,
      icon: (
        <path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.25 3.25l1-.5V6M2.25 9.4c.15-.4.5-.65.95-.65.55 0 .95.35.95.85 0 .85-1.9 1.3-1.9 2.4h1.9" />
      ),
    },
    {
      label: "format.taskList",
      command: toggleTaskList,
      icon: (
        <path d="M2.25 2.75h3.5v3.5h-3.5zM2.25 9.75h3.5v3.5h-3.5zM3.1 4.55l.65.65 1.2-1.3M8 4.5h5.5M8 11.5h5.5" />
      ),
    },
    {
      label: "format.quote",
      command: toggleQuote,
      icon: <path d="M3 3.25v9.5M6.5 5h7M6.5 8h7M6.5 11h4.5" />,
    },
    {
      label: "format.codeBlock",
      command: toggleCodeBlock,
      icon: (
        <path d="M2.75 2.75h10.5v10.5H2.75zM6.75 6.25 5 8l1.75 1.75M9.25 6.25 11 8l-1.75 1.75" />
      ),
    },
  ],
  [
    {
      label: "format.clear",
      command: clearFormatting,
      // A T with a stroke through it.
      icon: (
        <path d="M3 4.25V2.75h9.5v1.5M7.75 2.75 6.5 8.25M5 13.25h3.5M6 13.25l.6-2.6M10 10l4 4M14 10l-4 4" />
      ),
    },
  ],
];

/**
 * The formatting bar, floating over the bottom of a note: bold, italic and the other marks, a
 * link, headings, lists, quotes and code blocks, on the selection or at
 * the cursor. A press keeps the focus in the text, so the cursor stays
 * where it was and typing goes on.
 */
export function FormatBar({ view }: { view: () => EditorView | null }) {
  const t = useT();
  function run(command: FormatCommand) {
    const editor = view();
    if (editor === null) return;
    const spec = command(editor.state);
    if (spec !== null) editor.dispatch(spec);
    editor.focus();
  }

  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-bg p-1 shadow-dialog">
      {GROUPS.map((group, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px shrink-0 bg-line"
            />
          )}
          {group.map((button) => (
            <Tooltip key={button.label} label={t(button.label)} side="top">
              <button
                type="button"
                aria-label={t(button.label)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-100 outline-none hover:bg-selected hover:text-fg"
                // The text keeps the focus and its selection.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(button.command)}
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
                  {button.icon}
                </svg>
              </button>
            </Tooltip>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

/** The icon of the button that shows and hides the bar: a letter T. */
export function FormatBarIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4V2.75h10V4M8 2.75v10.5M6 13.25h4" />
    </svg>
  );
}
