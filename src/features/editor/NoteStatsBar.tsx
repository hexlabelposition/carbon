import { ContextMenu } from "@base-ui/react/context-menu";
import type { ReactNode } from "react";
import { useT, type MessageKey } from "../i18n/i18n";
import type { MenuIcon } from "../ui/menu-icons";
import { Tooltip } from "../ui/Tooltip";
import { readingMinutes, type NoteStats } from "./note-stats";
import { BarPartsMenu } from "./BarPartsMenu";
import {
  hiddenStatsPreference,
  STATS_PARTS,
  type StatsPart,
} from "./bar-parts";

const PARTS: Record<StatsPart, { label: MessageKey; icon: MenuIcon }> = {
  save: { label: "stats.showSave", icon: "saveStatus" },
  words: { label: "stats.showWords", icon: "wordCount" },
  characters: { label: "stats.showCharacters", icon: "characterCount" },
  minutes: { label: "stats.showMinutes", icon: "readingTime" },
};

/**
 * The thin bar below a note: `status` at its start, whether the edits are
 * saved; at its end how many words and characters the note has and how
 * long it takes to read, or while text is selected, how much of it that
 * is. The tooltip adds the characters without spaces and the lines. The
 * counts come once the editor has counted (`stats` is `null` until then).
 * The right button opens a menu that shows or hides each part
 * (`hiddenStatsPreference`); `status` hides itself.
 */
export function NoteStatsBar({
  stats,
  status,
}: {
  stats: NoteStats | null;
  status: ReactNode;
}) {
  const t = useT();
  const hidden = hiddenStatsPreference.use();
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={
          // "About the note": whether it is saved, and its counts.
          <footer
            aria-label={t("stats.label")}
            className="flex h-7 shrink-0 items-center gap-4 border-t border-line px-3 text-small text-faint select-none"
          />
        }
      >
        {status}
        {stats !== null && <Counts stats={stats} hidden={hidden} />}
      </ContextMenu.Trigger>
      <BarPartsMenu
        parts={STATS_PARTS}
        items={PARTS}
        hidden={hiddenStatsPreference}
      />
    </ContextMenu.Root>
  );
}

function Counts({
  stats,
  hidden,
}: {
  stats: NoteStats;
  hidden: readonly StatsPart[];
}) {
  const t = useT();
  const { text, selection } = stats;
  const shown = selection ?? text;
  const minutes = readingMinutes(text.words);
  const parts: string[] = [];
  if (!hidden.includes("words")) {
    parts.push(t("stats.words", { count: shown.words }));
  }
  if (!hidden.includes("characters")) {
    parts.push(t("stats.characters", { count: shown.characters }));
  }
  if (!hidden.includes("minutes") && selection === null && minutes > 0) {
    parts.push(t("stats.minutes", { count: minutes }));
  }
  if (parts.length === 0) return null;
  const details = [
    t("stats.noSpaces", { count: shown.charactersNoSpaces }),
    t("stats.lines", { count: shown.lines }),
  ].join(" · ");
  return (
    <Tooltip label={details} side="top">
      {/* A thin line before each part, the first too, not dots. The
            selected amount and the note have the same parts, but the time
            to read is the whole note's, so it is left out while text is
            selected. At the end of the bar, with the status shown or not. */}
      <span className="ml-auto flex items-center tabular-nums">
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
