import type { Heading } from "../editor/outline";
import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";

interface OutlinePanelProps {
  headings: readonly Heading[];
  /** The heading the cursor is under: its index, -1 if none. */
  current: number;
  onReveal: (index: number) => void;
}

/**
 * The headings of the shown note as a list. A heading is indented by its
 * level, counted from the highest level in the note, so a note that starts
 * at "##" is not pushed to the right.
 */
export function OutlinePanel({
  headings,
  current,
  onReveal,
}: OutlinePanelProps) {
  const t = useT();
  if (headings.length === 0) {
    return (
      <p className="truncate px-3 py-2 text-small text-faint">
        {t("outline.empty")}
      </p>
    );
  }
  const top = Math.min(...headings.map((heading) => heading.level));

  return (
    <nav aria-label={t("shell.outline")}>
      {/* As the file tree: room around the rows, rows of the same height
          that touch, rounded, shifted in by the same step per level. */}
      <ul className="flex flex-col p-2">
        {headings.map((heading, index) => (
          // Headings can repeat; their order is what tells them apart.
          <li key={index}>
            <Tooltip label={heading.text}>
              <button
                type="button"
                aria-current={index === current ? "location" : undefined}
                className={`block h-[26px] w-full truncate rounded-md pr-2 text-left leading-[26px] outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong ${
                  index === current ? "bg-selected text-fg" : "text-muted"
                }`}
                style={{ paddingLeft: `${6 + (heading.level - top) * 14}px` }}
                // A click leaves the focus in the note: taken away and given
                // back, the "#" of the line hid and showed again, the text
                // moved under the cursor, and WebKitGTK left a second one
                // where it was. The keyboard still reaches the buttons.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onReveal(index)}
              >
                {heading.text || t("outline.emptyHeading")}
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </nav>
  );
}
