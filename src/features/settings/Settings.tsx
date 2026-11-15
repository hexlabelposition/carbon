import { Dialog } from "@base-ui/react/dialog";
import { Select } from "@base-ui/react/select";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { keys, useCommands } from "../commands/commands";
import { THEMES, themePreference, type Theme } from "../theme/use-theme";
import { shortcutLetter } from "../workspace/shortcut-letter";
import { ZOOM_LEVELS, zoomPreference } from "../zoom/use-zoom";
import {
  NOTE_FONTS,
  NOTE_SIZES,
  NOTE_WIDTHS,
  noteFontPreference,
  noteSizePreference,
  noteWidthPreference,
  useNoteStyle,
} from "./note-style";

// Whether the settings dialog is open: anything may open it.
const listeners = new Set<() => void>();
let isOpen = false;
function setOpen(open: boolean) {
  isOpen = open;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Opens the settings dialog. */
export function openSettings(): void {
  setOpen(true);
}

const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/**
 * The settings of the app: applies the note settings, offers "Open
 * settings" (Ctrl+, or Cmd+, on a Mac) and shows the dialog while it is
 * open. Mount it once, inside the commands provider.
 */
export function Settings() {
  useNoteStyle();
  const open = useSyncExternalStore(subscribe, () => isOpen);

  useCommands(
    useMemo(
      () => [
        {
          id: "settings.open",
          title: "Open settings",
          shortcut: keys("Mod+,"),
          run: openSettings,
        },
      ],
      [],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      if (!command || event.shiftKey || event.altKey) return;
      if (event.code !== "Comma" && shortcutLetter(event) !== ",") return;
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-backdrop/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-lg border border-line bg-bg p-5 text-ui text-fg shadow-dialog outline-none">
          <header className="flex items-center justify-between">
            <Dialog.Title className="text-h3 font-semibold">
              Settings
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              title="Close (Escape)"
              className="flex size-7 items-center justify-center rounded-md text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
            >
              <svg
                viewBox="0 0 10 10"
                width="10"
                height="10"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
              </svg>
            </Dialog.Close>
          </header>
          <AppearanceSettings />
          <NoteSettings />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AppearanceSettings() {
  const theme = themePreference.use();
  const zoom = zoomPreference.use();
  return (
    <Section title="Appearance">
      <Row label="Theme">
        <ToggleGroup
          aria-label="Theme"
          value={[theme]}
          // Pressing the theme that is on would turn it off: keep it.
          onValueChange={([next]: Theme[]) => {
            if (next !== undefined) themePreference.set(next);
          }}
          className="inline-flex rounded-md border border-line-strong bg-panel p-0.5"
        >
          {THEMES.map((value) => (
            <Toggle
              key={value}
              value={value}
              className="h-6 rounded-sm px-3 text-muted outline-none hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong data-pressed:bg-solid data-pressed:font-medium data-pressed:text-on-solid"
            >
              {THEME_LABELS[value]}
            </Toggle>
          ))}
        </ToggleGroup>
      </Row>
      <Row label="Interface zoom">
        <SettingSelect
          label="Interface zoom"
          value={zoom}
          items={ZOOM_LEVELS.map((level) => ({
            value: level,
            label: `${Math.round(level * 100)}%`,
          }))}
          onChange={zoomPreference.set}
        />
      </Row>
    </Section>
  );
}

function NoteSettings() {
  const font = noteFontPreference.use();
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  return (
    <Section title="Notes">
      <Row label="Font">
        <SettingSelect
          label="Font"
          value={font}
          items={NOTE_FONTS}
          onChange={noteFontPreference.set}
        />
      </Row>
      <Row label="Font size">
        <SettingSelect
          label="Font size"
          value={size}
          items={NOTE_SIZES.map((pixels) => ({
            value: pixels,
            label: `${pixels} px`,
          }))}
          onChange={noteSizePreference.set}
        />
      </Row>
      <Row label="Content width">
        <SettingSelect
          label="Content width"
          value={width}
          items={NOTE_WIDTHS}
          onChange={noteWidthPreference.set}
        />
      </Row>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="mb-1 text-label font-semibold tracking-[0.06em] text-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <span>{label}</span>
      {children}
    </div>
  );
}

/** A choice of a few values, in a list that opens from a button. */
function SettingSelect<T extends string | number>({
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
            width="10"
            height="10"
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
                  className="grid cursor-default grid-cols-[12px_1fr] items-center gap-2 rounded-sm py-1 pr-3 pl-2 outline-none select-none data-highlighted:bg-raise"
                >
                  <Select.ItemIndicator className="col-start-1">
                    <svg
                      viewBox="0 0 12 12"
                      width="12"
                      height="12"
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
