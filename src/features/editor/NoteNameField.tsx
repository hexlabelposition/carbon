import { useRef } from "react";
import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { useNameField } from "./use-name-field";
import type { NoteTitle } from "./use-note-title";

/**
 * The name of the note in the bar above it, after back and forward: its
 * folder, faint, then its name, which renames the note when edited, as
 * the title above the text does. It looks like plain text, edited or
 * not. With `readOnly` it cannot be edited.
 */
export function NoteNameField({
  path,
  title,
  readOnly = false,
  showFolder = true,
}: {
  path: string;
  title: NoteTitle;
  readOnly?: boolean;
  /** The folder before the name, faint; hidden from the menu of the bar. */
  showFolder?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const field = useNameField(title, ref);
  const slash = path.lastIndexOf("/");
  const folder = slash < 0 ? "" : path.slice(0, slash + 1);

  return (
    <div className="flex min-w-0 flex-1 items-center px-2">
      {showFolder && folder !== "" && (
        <Tooltip label={path}>
          {/* Shrinks first: the name stays in sight. */}
          <span className="min-w-0 shrink-[100] truncate text-faint">
            {folder}
          </span>
        </Tooltip>
      )}
      {/* As wide as the name: an unseen copy takes the width in the same
          cell of a grid, and the field fills it. Narrower than the room
          left, the rest of the bar stays free to drag the window. */}
      <div className="grid min-w-0">
        <span
          aria-hidden="true"
          className={`invisible [grid-area:1/1] whitespace-pre ${FIELD_TEXT}`}
        >
          {field.text}{" "}
        </span>
        <input
          ref={ref}
          aria-label={t("editor.noteName")}
          readOnly={readOnly}
          // Not a stop of the Tab key while it cannot be edited.
          tabIndex={readOnly ? -1 : undefined}
          spellCheck={false}
          value={field.text}
          onChange={(event) => field.edit(event.target.value)}
          onKeyDown={field.onKeyDown}
          onBlur={field.onBlur}
          className={`w-full min-w-0 [grid-area:1/1] bg-transparent text-muted outline-none ${FIELD_TEXT} ${
            readOnly ? "cursor-default" : ""
          }`}
        />
      </div>
    </div>
  );
}

/** The padding and type of the field and of its unseen copy, alike. */
const FIELD_TEXT = "p-0";
