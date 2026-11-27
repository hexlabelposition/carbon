import { Combobox } from "@base-ui/react/combobox";
import { useT } from "../i18n/i18n";
import { cssFamily, familyOf, familyValue, type SystemFont } from "./fonts";

/** A font in the list: its setting, its name, and the CSS to show it in. */
interface FontItem {
  value: string;
  label: string;
  /** The font list its name is drawn in; none for the named choices. */
  preview?: string;
}

interface FontGroup {
  value: string;
  items: FontItem[];
}

/**
 * The choice of a font: the named ones, as the font that comes with the
 * app and the one of the system, then every font family installed, each
 * name drawn in its font. Typing narrows the list down. `system` is
 * `null` while the fonts are being listed. With `monospace`, the
 * monospace families come first and the others after them.
 */
export function FontPicker({
  label,
  value,
  named,
  system,
  monospace = false,
  onChange,
}: {
  label: string;
  value: string;
  /** The named choices, those that come with the app first. */
  named: readonly { value: string; label: string }[];
  system: readonly SystemFont[] | null;
  monospace?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useT();
  /** A named choice stands for its family: not offered twice. */
  const namedLabels = new Set(named.map((font) => font.label));
  const families = (system ?? [])
    .filter((font) => !namedLabels.has(font.family))
    .map((font): FontItem & { monospace: boolean } => ({
      value: familyValue(font.family),
      label: font.family,
      preview: cssFamily(font.family),
      monospace: font.monospace,
    }));
  const groups: FontGroup[] = [
    { value: t("settings.font.named"), items: [...named] },
    ...(monospace
      ? [
          {
            value: t("settings.font.monospaceFamilies"),
            items: families.filter((font) => font.monospace),
          },
          {
            value: t("settings.font.otherFamilies"),
            items: families.filter((font) => !font.monospace),
          },
        ]
      : [{ value: t("settings.font.systemFamilies"), items: families }]),
  ].filter((group) => group.items.length > 0);
  // The one chosen, even while the fonts are listed or if it is gone.
  const chosen: FontItem = groups
    .flatMap((group) => group.items)
    .find((font) => font.value === value) ?? {
    value,
    label: familyOf(value) ?? value,
  };

  return (
    <Combobox.Root
      items={groups}
      value={chosen}
      isItemEqualToValue={(item: FontItem, other: FontItem) =>
        item.value === other.value
      }
      onValueChange={(next: FontItem | null) => {
        if (next !== null) onChange(next.value);
      }}
    >
      <Combobox.Trigger
        aria-label={label}
        className="flex h-7 max-w-56 min-w-36 items-center justify-between gap-3 rounded-md border border-line-strong bg-panel pr-1.5 pl-2.5 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong data-popup-open:bg-raise"
      >
        <span
          className="min-w-0 truncate"
          style={{ fontFamily: chosen.preview }}
        >
          <Combobox.Value />
        </span>
        <Combobox.Icon className="shrink-0 text-faint">
          <svg
            viewBox="0 0 10 10"
            width="12"
            height="12"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <path d="M2.5 4l2.5-2.5 2.5 2.5M2.5 6l2.5 2.5 2.5-2.5" />
          </svg>
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        {/* Above the dialog the list opens from. */}
        <Combobox.Positioner
          className="z-60 outline-none"
          sideOffset={4}
          align="end"
        >
          <Combobox.Popup className="flex max-h-[min(24rem,var(--available-height))] w-72 flex-col rounded-md border border-line bg-bg text-ui text-fg shadow-dialog outline-none">
            <div className="shrink-0 border-b border-line p-1">
              <Combobox.Input
                placeholder={t("settings.font.search")}
                className="h-7 w-full rounded-sm bg-transparent px-2 outline-none placeholder:text-faint"
              />
            </div>
            <Combobox.Empty className="px-3 py-2 text-small text-faint empty:hidden">
              {t("settings.font.notFound")}
            </Combobox.Empty>
            <Combobox.List className="min-h-0 flex-1 overflow-y-auto p-1 empty:hidden">
              {(group: FontGroup) => (
                <Combobox.Group
                  key={group.value}
                  items={group.items}
                  className="not-first:mt-1"
                >
                  <Combobox.GroupLabel className="px-2 py-1 text-small text-faint">
                    {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(font: FontItem) => (
                      <Combobox.Item
                        key={font.value}
                        value={font}
                        // A long list of fonts: one out of sight is not laid
                        // out, so its font is not loaded until it scrolls in.
                        className="grid h-7 cursor-default grid-cols-[14px_1fr] items-center gap-2 rounded-sm pr-3 pl-2 outline-none select-none [contain-intrinsic-size:auto_1.75rem] [content-visibility:auto] data-highlighted:bg-raise"
                      >
                        <Combobox.ItemIndicator className="col-start-1">
                          <svg
                            viewBox="0 0 12 12"
                            width="14"
                            height="14"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6.3l2.4 2.4 4.6-5" />
                          </svg>
                        </Combobox.ItemIndicator>
                        <span
                          className="col-start-2 truncate"
                          style={{ fontFamily: font.preview }}
                        >
                          {font.label}
                        </span>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
            {system === null && (
              <p className="shrink-0 border-t border-line px-3 py-2 text-small text-faint">
                {t("settings.font.loading")}
              </p>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
