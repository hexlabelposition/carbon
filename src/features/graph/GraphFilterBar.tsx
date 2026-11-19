import { Autocomplete } from "@base-ui/react/autocomplete";
import { Popover } from "@base-ui/react/popover";
import type { Vault } from "@carbon/core";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";
import { SettingSelect, SettingSwitch } from "../ui/controls";
import { Tooltip } from "../ui/Tooltip";
import type { ColorBy } from "./node-style";
import type { GraphFilters } from "./use-graph-data";

/** How long typing in the tag field pauses before the graph follows, ms. */
const TAG_DELAY_MS = 300;
/** Tags offered at most while one is typed. */
const TAG_SUGGESTIONS = 50;

/**
 * The settings of the graph of the vault, in a panel that a button at its
 * top right opens: the filters (C-506), a tag with the tags of the vault
 * to pick from, notes without links and the notes that links miss; and how
 * notes are drawn (C-507), sized by their links, colored by folder or tag.
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
  const [tag, setTag] = useState(filters.tag);
  const [tags, setTags] = useState<readonly string[]>([]);

  useEffect(() => {
    let current = true;
    vault.tags.all().then(
      (all) => {
        if (current) setTags(all.map((count) => count.tag));
      },
      // Without the list the field still takes a tag typed in.
      (reason: unknown) => log.warn("Could not list the tags", reason),
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

  return (
    <Popover.Root>
      <Tooltip label={t("graph.settings")}>
        <Popover.Trigger
          aria-label={t("graph.settings")}
          // As the icons of the toolbar: a rounded square that lights up on a
          // hover, no frame.
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-md text-muted outline-none transition-colors duration-100 hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong data-popup-open:bg-selected data-popup-open:text-fg"
        >
          {/* Three sliders, each a line with its knob across it. Drawn on
              the grid of the pixels it is shown at, 20 by 20, with nothing
              filled: each stroke starts on the edge of a pixel, so it is
              sharp on that side and the icon is not blurred. */}
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          >
            <path d="M3.75 5.75h12.5M3.75 10.25h12.5M3.75 14.75h12.5" />
            <path d="M7.25 3.75v4M12.75 8.25v4M9.25 12.75v4" />
          </svg>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-40 outline-none"
        >
          <Popover.Popup
            aria-label={t("graph.settings")}
            className="flex w-72 flex-col gap-3 rounded-lg border border-line bg-bg p-3 text-ui text-fg shadow-dialog outline-none select-none"
            // Escape closes the panel, not the graph under it as well.
            onKeyDown={(event) => {
              if (event.key === "Escape") event.stopPropagation();
            }}
          >
            <Group title={t("graph.filters")}>
              <TagField
                value={tag}
                tags={tags}
                label={t("graph.tagFilter")}
                onChange={setTag}
              />
              <Row label={t("graph.orphans")}>
                <SettingSwitch
                  label={t("graph.orphans")}
                  checked={filters.orphans}
                  onChange={(orphans) => onChange({ orphans })}
                />
              </Row>
              <Row label={t("graph.missing")}>
                <SettingSwitch
                  label={t("graph.missing")}
                  checked={filters.missing}
                  onChange={(missing) => onChange({ missing })}
                />
              </Row>
            </Group>
            <Group title={t("graph.display")}>
              <Row label={t("graph.sizeByLinks")}>
                <SettingSwitch
                  label={t("graph.sizeByLinks")}
                  checked={filters.sizeByLinks}
                  onChange={(sizeByLinks) => onChange({ sizeByLinks })}
                />
              </Row>
              <Row label={t("graph.colorBy")}>
                <SettingSelect<ColorBy>
                  label={t("graph.colorBy")}
                  value={filters.colorBy}
                  items={[
                    { value: "none", label: t("graph.colorNone") },
                    { value: "folder", label: t("graph.colorFolder") },
                    { value: "tag", label: t("graph.colorTag") },
                  ]}
                  onChange={(colorBy) => onChange({ colorBy })}
                />
              </Row>
            </Group>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The tag to show the notes of, with the tags of the vault offered. */
function TagField({
  value,
  tags,
  label,
  onChange,
}: {
  value: string;
  tags: readonly string[];
  label: string;
  onChange(value: string): void;
}) {
  return (
    <Autocomplete.Root
      items={tags as string[]}
      value={value}
      limit={TAG_SUGGESTIONS}
      onValueChange={(next) => onChange(next.replace(/^#/, ""))}
    >
      <Autocomplete.Input
        placeholder={label}
        aria-label={label}
        spellCheck={false}
        className="h-7 w-full rounded-md border border-line-strong bg-panel px-2 text-fg outline-none select-text placeholder:text-faint focus-visible:ring-1 focus-visible:ring-line-strong"
        onKeyDown={(event) => {
          // Escape empties the field; with it empty, the panel closes.
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
      />
      <Autocomplete.Portal>
        {/* Above the panel it opens from. */}
        <Autocomplete.Positioner className="z-60 outline-none" sideOffset={4}>
          <Autocomplete.Popup className="w-(--anchor-width) rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none">
            <Autocomplete.List className="max-h-[min(15rem,var(--available-height))] overflow-y-auto overscroll-contain">
              {(tag: string) => (
                <Autocomplete.Item
                  key={tag}
                  value={tag}
                  className="cursor-default truncate rounded-sm px-2 py-1 outline-none select-none data-highlighted:bg-raise"
                >
                  #{tag}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span>{label}</span>
      {children}
    </div>
  );
}
