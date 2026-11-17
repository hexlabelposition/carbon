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
        <span className="tabular-nums">
          {selection !== null && (
            <span className="text-muted">{t("stats.selected")} </span>
          )}
          {parts.join(" · ")}
          {selection === null && minutes > 0 && (
            <> · {t("stats.minutes", { count: minutes })}</>
          )}
        </span>
      </Tooltip>
    </footer>
  );
}
