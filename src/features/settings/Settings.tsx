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
import {
  LANGUAGE_SETTINGS,
  languagePreference,
  useLanguage,
  useT,
  type LanguageSetting,
  type MessageKey,
} from "../i18n/i18n";
import { THEMES, themePreference, type Theme } from "../theme/use-theme";
import { shortcutLetter } from "../workspace/shortcut-letter";
import { ZOOM_LEVELS, zoomPreference } from "../zoom/use-zoom";
import {
  availableFonts,
  MONO_FONTS,
  monoFontPreference,
  UI_FONTS,
  uiFontPreference,
  useFonts,
  type FontChoice,
} from "./fonts";
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

const THEME_LABELS: Record<Theme, MessageKey> = {
  system: "settings.theme.system",
  light: "settings.theme.light",
  dark: "settings.theme.dark",
};

const LANGUAGE_LABELS: Record<LanguageSetting, MessageKey> = {
  system: "settings.language.system",
  en: "settings.language.en",
  ru: "settings.language.ru",
};

/**
 * The settings of the app: applies the note settings and the language,
 * offers "Open settings" (Ctrl+, or Cmd+, on a Mac) and shows the dialog
 * while it is open. Mount it once, inside the commands provider.
 */
export function Settings() {
  useNoteStyle();
  useFonts();
  const t = useT();
  const language = useLanguage();
  const open = useSyncExternalStore(subscribe, () => isOpen);

  // The language of the page: hyphenation and spelling follow it.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useCommands(
    useMemo(
      () => [
        {
          id: "settings.open",
          title: t("settings.open"),
          shortcut: keys("Mod+,"),
          run: openSettings,
        },
      ],
      [t],
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
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // The window buttons stay out of the backdrop: pressing one
        // minimizes or closes the window, it does not close the settings.
        if (
          details.reason === "outside-press" &&
          details.event.target instanceof Element &&
          details.event.target.closest("[data-window-controls]") !== null
        ) {
          return;
        }
        setOpen(next);
      }}
    >
      <Dialog.Portal>
        {/* Below the top row: the tabs and the window buttons stay sharp,
            and the buttons can still be pressed. */}
        <Dialog.Backdrop className="fixed inset-x-0 top-12 bottom-0 z-50 bg-backdrop/40 backdrop-blur-xs" />
        {/* Centered by its margins, not moved back by half its size: a
            move of half an odd size lands between pixels, and the text in
            it is drawn blurred. */}
        <Dialog.Popup className="fixed inset-0 z-50 m-auto flex h-fit w-[440px] max-w-[calc(100vw-32px)] flex-col gap-5 rounded-lg border border-line bg-bg p-5 text-ui text-fg shadow-dialog outline-none">
          <header className="flex items-center justify-between">
            <Dialog.Title className="text-h3 font-semibold">
              {t("settings.title")}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t("common.close")}
              title={t("common.closeEscape")}
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
          <FontSettings />
          <NoteSettings />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AppearanceSettings() {
  const t = useT();
  const theme = themePreference.use();
  const zoom = zoomPreference.use();
  const language = languagePreference.use();
  return (
    <Section title={t("settings.appearance")}>
      <Row label={t("settings.language")}>
        <SettingSelect
          label={t("settings.language")}
          value={language}
          items={LANGUAGE_SETTINGS.map((value) => ({
            value,
            label: t(LANGUAGE_LABELS[value]),
          }))}
          onChange={languagePreference.set}
        />
      </Row>
      <Row label={t("settings.theme")}>
        <ToggleGroup
          aria-label={t("settings.theme")}
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
              {t(THEME_LABELS[value])}
            </Toggle>
          ))}
        </ToggleGroup>
      </Row>
      <Row label={t("settings.zoom")}>
        <SettingSelect
          label={t("settings.zoom")}
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
  const t = useT();
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  return (
    <Section title={t("settings.notes")}>
      <Row label={t("settings.fontSize")}>
        <SettingSelect
          label={t("settings.fontSize")}
          value={size}
          items={NOTE_SIZES.map((pixels) => ({
            value: pixels,
            label: t("settings.pixels", { count: pixels }),
          }))}
          onChange={noteSizePreference.set}
        />
      </Row>
      <Row label={t("settings.width")}>
        <SettingSelect
          label={t("settings.width")}
          value={width}
          items={NOTE_WIDTHS.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={noteWidthPreference.set}
        />
      </Row>
    </Section>
  );
}

/**
 * The three fonts: of the interface, of the note text, and the monospace
 * one, for code and for note text set to monospace.
 */
function FontSettings() {
  const t = useT();
  const ui = uiFontPreference.use();
  const text = noteFontPreference.use();
  const mono = monoFontPreference.use();
  /** The installed choices, and the one chosen even if it is gone since. */
  const choices = (fonts: readonly FontChoice[], chosen: string) => {
    const available = availableFonts(fonts);
    return [
      ...available,
      ...fonts.filter((f) => f.value === chosen && !available.includes(f)),
    ].map((f) => ({
      value: f.value,
      label: f.name ?? t("settings.font.system"),
    }));
  };
  return (
    <Section title={t("settings.fonts")}>
      <Row label={t("settings.font.ui")}>
        <SettingSelect
          label={t("settings.font.ui")}
          value={ui}
          items={choices(UI_FONTS, ui)}
          onChange={uiFontPreference.set}
        />
      </Row>
      <Row label={t("settings.font.text")}>
        <SettingSelect
          label={t("settings.font.text")}
          value={text}
          items={NOTE_FONTS.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={noteFontPreference.set}
        />
      </Row>
      <Row label={t("settings.font.mono")}>
        <SettingSelect
          label={t("settings.font.mono")}
          value={mono}
          items={choices(MONO_FONTS, mono)}
          onChange={monoFontPreference.set}
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
