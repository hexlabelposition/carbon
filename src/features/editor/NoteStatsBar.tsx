import type { ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { readingMinutes, type NoteStats } from "./note-stats";

/**
 * The thin bar below a note: `status` at its start, whether the edits are
 * saved; at its end how many words and characters the note has and how
 * long it takes to read, or while text is selected, how much of it that
 * is. The tooltip adds the characters without spaces and the lines. The
 * counts come once the editor has counted (`stats` is `null` until then).
 */
export function NoteStatsBar({
  stats,
  status,
}: {
  stats: NoteStats | null;
  status: ReactNode;
}) {
  const t = useT();
  return (
    // "About the note": whether it is saved, and its counts.
    <footer
      aria-label={t("stats.label")}
      className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-line px-3 text-small text-faint select-none"
    >
      {status}
      {stats !== null && <Counts stats={stats} />}
    </footer>
  );
}

function Counts({ stats }: { stats: NoteStats }) {
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
  );
}
