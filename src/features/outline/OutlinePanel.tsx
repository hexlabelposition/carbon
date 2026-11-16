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
      <p className="px-3 py-2 text-small text-faint">{t("outline.empty")}</p>
    );
  }
  const top = Math.min(...headings.map((heading) => heading.level));

  return (
    <nav aria-label={t("shell.outline")}>
      <ul className="py-1">
        {headings.map((heading, index) => (
          // Headings can repeat; their order is what tells them apart.
          <li key={index}>
            <Tooltip label={heading.text}>
              <button
                type="button"
                aria-current={index === current ? "location" : undefined}
                className={`block w-full truncate py-0.5 pr-3 text-left hover:bg-raise hover:text-fg ${
                  index === current ? "bg-selected text-fg" : "text-muted"
                }`}
                style={{ paddingLeft: `${12 + (heading.level - top) * 12}px` }}
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
