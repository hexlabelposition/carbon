import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";

/*
 * The controls of settings, shared by the settings dialog and the panels
 * that set something, such as the one of the graph: built on Base UI, in
 * the look of the app (ADR-024).
 */

/** A choice of a few values, in a list that opens from a button. */
export function SettingSelect<T extends string | number>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Select.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <Select.Trigger
        aria-label={label}
        className="flex h-7 min-w-36 items-center justify-between gap-3 rounded-md border border-line-strong bg-panel pr-1.5 pl-2.5 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong data-popup-open:bg-raise"
      >
        <Select.Value />
        <Select.Icon className="text-faint">
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
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        {/* Above the dialog the list opens from. */}
        <Select.Positioner className="z-60 outline-none" sideOffset={4}>
          <Select.Popup className="min-w-(--anchor-width) rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none">
            <Select.List className="max-h-(--available-height) overflow-y-auto">
              {items.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  className="grid cursor-default grid-cols-[14px_1fr] items-center gap-2 rounded-sm py-1 pr-3 pl-2 outline-none select-none data-highlighted:bg-raise"
                >
                  <Select.ItemIndicator className="col-start-1">
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
                  </Select.ItemIndicator>
                  <Select.ItemText className="col-start-2">
                    {item.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/** A setting that is on or off. */
export function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={onChange}
      className="relative flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong p-0.5 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-line-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg data-checked:bg-solid motion-reduce:transition-none"
    >
      <Switch.Thumb className="block size-4 rounded-full bg-bg shadow-sm transition-transform duration-150 data-checked:translate-x-4 motion-reduce:transition-none" />
    </Switch.Root>
  );
}
