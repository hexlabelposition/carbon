import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { readingMinutes, type NoteStats } from "./note-stats";

/**
 * The thin bar below a note: how many words and characters it has and how
 * long it takes to read; while text is selected, how much of it that is.
 * The tooltip adds the characters without spaces and the lines.
 */
export function NoteStatsBar({ stats }: { stats: NoteStats }) {
  const t = useT();
  const { text, selection } = stats;
  const shown = selection ?? text;
  const minutes = readingMinutes(text.words);
  const parts = [
    t("stats.words", { count: shown.words }),
    t("stats.characters", { count: shown.characters }),
  ];
  if (selection === null && minutes > 0) {
    parts.push(t("stats.minutes", { count: minutes }));
  }
  const details = [
    t("stats.noSpaces", { count: shown.charactersNoSpaces }),
    t("stats.lines", { count: shown.lines }),
  ].join(" · ");
  return (
    <footer
      aria-label={t("stats.label")}
      className="flex h-7 shrink-0 items-center justify-end gap-2 border-t border-line px-3 text-small text-faint select-none"
    >
      <Tooltip label={details} side="top">
        {/* A thin line before each part, the first too, not dots. The
            selected amount and the note have the same parts, but the time
            to read is the whole note's, so it is left out while text is
            selected. */}
        <span className="flex items-center tabular-nums">
          {parts.map((part, index) => (
            <span key={index} className="border-l border-line px-2 last:pr-0">
              {index === 0 && selection !== null && (
                <span className="text-muted">{t("stats.selected")} </span>
              )}
              {part}
            </span>
          ))}
        </span>
      </Tooltip>
    </footer>
  );
}
