import type { Vault } from "@carbon/core";
import { useEffect, useId, useState } from "react";
import { useT } from "../i18n/i18n";
import type { GraphFilters } from "./use-graph-data";

/** How long typing in the tag field pauses before the graph follows, ms. */
const TAG_DELAY_MS = 300;

/**
 * The filters over the graph of the vault (C-506): a tag, with the tags
 * of the vault to pick from, notes without links, and the notes that
 * links miss.
 */
export function GraphFilterBar({
  vault,
  filters,
  onChange,
}: {
  vault: Vault;
  filters: GraphFilters;
  onChange(patch: Partial<GraphFilters>): void;
}) {
  const t = useT();
  const listId = useId();
  const [tag, setTag] = useState(filters.tag);
  const [tags, setTags] = useState<readonly string[]>([]);

  useEffect(() => {
    let current = true;
    vault.tags.all().then(
      (all) => {
        if (current) setTags(all.map((count) => count.tag));
      },
      // Without the list the field still takes a tag typed in.
      () => {},
    );
    return () => {
      current = false;
    };
  }, [vault]);

  useEffect(() => {
    if (tag === filters.tag) return;
    const timer = setTimeout(() => onChange({ tag }), TAG_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tag, filters.tag, onChange]);

  const check =
    "flex items-center gap-1.5 whitespace-nowrap text-muted hover:text-fg";
  return (
    <div
      role="group"
      aria-label={t("graph.filters")}
      className="absolute top-2 right-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded-md border border-line bg-panel px-2 py-1 text-small"
    >
      <input
        type="search"
        list={listId}
        value={tag}
        placeholder={t("graph.tagFilter")}
        aria-label={t("graph.tagFilter")}
        spellCheck={false}
        className="h-6 w-40 rounded border border-line bg-bg px-1.5 text-fg outline-none placeholder:text-faint focus:border-line-strong"
        onChange={(event) => setTag(event.target.value.replace(/^#/, ""))}
        onKeyDown={(event) => {
          // Escape empties the field; the graph closes only once it is empty.
          if (event.key === "Escape" && tag !== "") {
            event.stopPropagation();
            setTag("");
          }
        }}
      />
      <datalist id={listId}>
        {tags.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <label className={check}>
        <input
          type="checkbox"
          checked={filters.orphans}
          onChange={(event) => onChange({ orphans: event.target.checked })}
        />
        {t("graph.orphans")}
      </label>
      <label className={check}>
        <input
          type="checkbox"
          checked={filters.missing}
          onChange={(event) => onChange({ missing: event.target.checked })}
        />
        {t("graph.missing")}
      </label>
    </div>
  );
}
