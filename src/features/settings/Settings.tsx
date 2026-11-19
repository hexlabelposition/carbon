import { Dialog } from "@base-ui/react/dialog";
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { isMac, keys, useCommands } from "../commands/commands";
import { Shortcut } from "../commands/Shortcut";
import {
  LANGUAGE_SETTINGS,
  languagePreference,
  useLanguage,
  useT,
  type LanguageSetting,
  type MessageKey,
} from "../i18n/i18n";
import { THEMES, themePreference, type Theme } from "../theme/use-theme";
import { DELETE_TO, deleteToPreference } from "../trash/delete-to";
import {
  INDENTS,
  indentPreference,
  START_MODES,
  startModePreference,
} from "./editor-options";
import { AppDialog } from "../dialogs/AppDialog";
import { openDialog, useDialog } from "../dialogs/open-dialog";
import { bindingOf, canBind } from "../shortcuts/keymap";
import {
  SHORTCUTS,
  isDefault,
  isReserved,
  matchesShortcut,
  resetAllBindings,
  setBinding,
  setRecordingShortcut,
  useAnyChanged,
  useConflicts,
  useBinding,
  useShortcutLabel,
  type ShortcutId,
} from "../shortcuts/shortcuts";
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
  NOTE_SIZE_DEFAULT,
  NOTE_SIZES,
  NOTE_WIDTHS,
  noteFontPreference,
  noteSizePreference,
  noteWidthPreference,
  lineHeightPreference,
  LINE_HEIGHTS,
  resetNoteSize,
  useNoteStyle,
  wheelTextSizePreference,
} from "./note-style";
import { Tooltip } from "../ui/Tooltip";
import { SettingSelect, SettingSwitch } from "../ui/controls";
import { log } from "../log/log";

/** Opens the settings dialog; another dialog open closes. */
export function openSettings(): void {
  openDialog("settings");
}

/**
 * Offers "Open settings" (Ctrl+, or Cmd+, on a Mac by default) while it
 * is mounted.
 * The shell mounts it only where the settings may open: not on the start
 * screen, where a vault is opened or made.
 */
export function SettingsOpener() {
  const t = useT();
  const shortcut = useShortcutLabel("settings.open");

  useCommands(
    useMemo(
      () => [
        {
          id: "settings.open",
          title: t("settings.open"),
          shortcut,
          run: openSettings,
        },
      ],
      [t, shortcut],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "settings.open")) return;
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
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

/** The groups of settings, listed at the left of the dialog. */
type SettingsGroup =
  "general" | "appearance" | "fonts" | "notes" | "editor" | "shortcuts";

const GROUPS: readonly { group: SettingsGroup; label: MessageKey }[] = [
  { group: "general", label: "settings.general" },
  { group: "appearance", label: "settings.appearance" },
  { group: "fonts", label: "settings.fonts" },
  { group: "notes", label: "settings.notes" },
  { group: "editor", label: "settings.editor" },
  { group: "shortcuts", label: "settings.shortcuts" },
];

/**
 * The settings of the app: applies the note settings and the language
 * and shows the dialog while it is open. Mount it once, inside the
 * commands provider. What opens it is `SettingsOpener`, mounted apart.
 * `openLogFolder` shows where the log file is (C-606).
 */
export function Settings({
  openLogFolder,
}: {
  openLogFolder?: () => Promise<void>;
}) {
  useNoteStyle();
  useFonts();
  const t = useT();
  const language = useLanguage();
  const [open, setOpen] = useDialog("settings");
  /** The group shown: the last one, while the app runs. */
  const [group, setGroup] = useState<SettingsGroup>("general");

  // The language of the page: hyphenation follows it.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useCommands(
    useMemo(
      () => [
        {
          id: "settings.resetNoteSize",
          title: t("settings.resetNoteSize"),
          run: resetNoteSize,
        },
      ],
      [t],
    ),
  );

  return (
    <AppDialog
      open={open}
      onClose={() => setOpen(false)}
      // Centered by its margins, not moved back by half its size: a move of
      // half an odd size lands between pixels, and the text in it is drawn
      // blurred.
      className="fixed inset-0 m-auto flex h-[min(440px,calc(100vh-96px))] w-[680px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
    >
      {/* The groups at the left, one shown at a time at the right. */}
      <nav className="flex w-44 shrink-0 flex-col gap-3 border-r border-line bg-panel p-2">
        <Dialog.Title className="px-2.5 pt-2.5 text-h3 font-semibold">
          {t("settings.title")}
        </Dialog.Title>
        <GroupTabs current={group} onShow={setGroup} />
        <div className="mt-auto flex flex-col items-start gap-0.5 px-2.5 pb-1 text-small">
          {openLogFolder !== undefined && (
            <button
              type="button"
              className="-mx-1 rounded-sm px-1 text-muted outline-none hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
              onClick={() => {
                openLogFolder().catch((reason: unknown) =>
                  log.error("Could not open the log folder", reason),
                );
              }}
            >
              {t("logs.open")}
            </button>
          )}
          <p className="text-faint">
            {t("settings.version", { version: __CARBON_VERSION__ })}
          </p>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-h3 font-semibold">
            {t(
              GROUPS.find((g) => g.group === group)?.label ??
                "settings.general",
            )}
          </h3>
          <Tooltip label={t("common.close")} shortcut="Esc">
            <Dialog.Close
              aria-label={t("common.close")}
              className="flex size-7 items-center justify-center rounded-md text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
            >
              <svg
                viewBox="0 0 10 10"
                width="12"
                height="12"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
              </svg>
            </Dialog.Close>
          </Tooltip>
        </header>
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`settings-tab-${group}`}
          className="min-h-0 flex-1 overflow-auto px-5 pb-5"
        >
          {group === "general" && <GeneralSettings />}
          {group === "appearance" && <AppearanceSettings />}
          {group === "fonts" && <FontSettings />}
          {group === "notes" && <NoteSettings />}
          {group === "editor" && <EditorSettings />}
          {group === "shortcuts" && <ShortcutSettings />}
        </div>
      </div>
    </AppDialog>
  );
}

/**
 * The groups as a column of tabs. Up and Down move between them, as the
 * arrows of other lists do.
 */
function GroupTabs({
  current,
  onShow,
}: {
  current: SettingsGroup;
  onShow: (group: SettingsGroup) => void;
}) {
  const t = useT();
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const at = GROUPS.findIndex((g) => g.group === current);
    const next = GROUPS[(at + step + GROUPS.length) % GROUPS.length].group;
    onShow(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  }
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={t("settings.title")}
      className="flex flex-col gap-0.5"
      onKeyDown={onKeyDown}
    >
      {GROUPS.map(({ group, label }) => {
        const selected = group === current;
        return (
          <button
            key={group}
            type="button"
            role="tab"
            id={`settings-tab-${group}`}
            aria-selected={selected}
            aria-controls="settings-panel"
            tabIndex={selected ? 0 : -1}
            className={`flex h-7 items-center rounded-md px-2.5 text-left outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong ${
              selected ? "bg-selected font-medium text-fg" : "text-muted"
            }`}
            onClick={() => onShow(group)}
          >
            {t(label)}
          </button>
        );
      })}
    </div>
  );
}

function GeneralSettings() {
  const t = useT();
  const language = languagePreference.use();
  const deleteTo = deleteToPreference.use();
  return (
    <Rows>
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
      <Row label={t("settings.deleteTo")}>
        <SettingSelect
          label={t("settings.deleteTo")}
          value={deleteTo}
          items={DELETE_TO.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={deleteToPreference.set}
        />
      </Row>
    </Rows>
  );
}

function AppearanceSettings() {
  const t = useT();
  const theme = themePreference.use();
  const zoom = zoomPreference.use();
  return (
    <Rows>
      <Row label={t("settings.theme")}>
        <SettingSelect
          label={t("settings.theme")}
          value={theme}
          items={THEMES.map((value) => ({
            value,
            label: t(THEME_LABELS[value]),
          }))}
          onChange={themePreference.set}
        />
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
    </Rows>
  );
}

function NoteSettings() {
  const t = useT();
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  const wheelSize = wheelTextSizePreference.use();
  const lineHeight = lineHeightPreference.use();
  return (
    <Rows>
      <Row label={t("settings.fontSize")}>
        <div className="flex items-center gap-1.5">
          <ResetButton
            label={t("settings.resetTo", {
              value: t("settings.pixels", { count: NOTE_SIZE_DEFAULT }),
            })}
            disabled={size === NOTE_SIZE_DEFAULT}
            onReset={resetNoteSize}
          />
          <SettingSelect
            label={t("settings.fontSize")}
            value={size}
            items={NOTE_SIZES.map((pixels) => ({
              value: pixels,
              label: t("settings.pixels", { count: pixels }),
            }))}
            onChange={noteSizePreference.set}
          />
        </div>
      </Row>
      <Row label={t("settings.lineHeight")}>
        <SettingSelect
          label={t("settings.lineHeight")}
          value={lineHeight}
          items={LINE_HEIGHTS.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={lineHeightPreference.set}
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
      <Row label={t("settings.wheelSize", { key: keys("Mod") })}>
        <SettingSwitch
          label={t("settings.wheelSize", { key: keys("Mod") })}
          checked={wheelSize}
          onChange={wheelTextSizePreference.set}
        />
      </Row>
    </Rows>
  );
}

/** How the editor behaves: the mode to start in, Tab. */
function EditorSettings() {
  const t = useT();
  const startMode = startModePreference.use();
  const indent = indentPreference.use();
  return (
    <Rows>
      <Row label={t("settings.startMode")}>
        <SettingSelect
          label={t("settings.startMode")}
          value={startMode}
          items={START_MODES.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={startModePreference.set}
        />
      </Row>
      <Row label={t("settings.indent")}>
        <SettingSelect
          label={t("settings.indent")}
          value={indent}
          items={INDENTS.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          onChange={indentPreference.set}
        />
      </Row>
    </Rows>
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
    <Rows>
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
    </Rows>
  );
}

/** The settings of a group, one row each. */
/**
 * The shortcuts the user can change: a click on the keys of one, then the
 * keys to give it. Keys another shortcut has too are marked red on both;
 * keys the app keeps for itself, or without Ctrl, Cmd or Alt, are not
 * taken.
 */
function ShortcutSettings() {
  const t = useT();
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const changed = useAnyChanged();
  const conflicts = useConflicts();

  // While keys are recorded no shortcut runs, not even Escape of the dialog.
  useEffect(() => {
    if (recording === null) return;
    setRecordingShortcut(true);
    function onKeyDown(event: KeyboardEvent) {
      if (recording === null) return;
      event.preventDefault();
      event.stopPropagation();
      const plain =
        !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
      if (plain && event.key === "Escape") {
        setRecording(null);
        return;
      }
      if (plain && (event.key === "Backspace" || event.key === "Delete")) {
        setBinding(recording, null);
        setNotice(null);
        setRecording(null);
        return;
      }
      const binding = bindingOf(event, isMac);
      // A modifier alone: the rest of the keys are still to come.
      if (binding === null) return;
      if (!canBind(binding)) {
        setNotice(t("settings.shortcuts.needModifier"));
        return;
      }
      if (isReserved(binding)) {
        setNotice(t("settings.shortcuts.reserved", { keys: keys(binding) }));
        return;
      }
      setBinding(recording, binding);
      setNotice(null);
      setRecording(null);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      setRecordingShortcut(false);
    };
  }, [recording, t]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-faint">{t("settings.shortcuts.hint")}</p>
      <Rows>
        {SHORTCUTS.map(({ id, label }) => (
          <ShortcutRow
            key={id}
            id={id}
            label={t(label)}
            recording={recording === id}
            conflict={conflicts.has(id)}
            onRecord={(on) => {
              setNotice(null);
              setRecording(on ? id : null);
            }}
          />
        ))}
      </Rows>
      <div className="flex min-h-7 items-center justify-between gap-4">
        <p
          role="status"
          className={`text-small ${
            notice === null && conflicts.size > 0 ? "text-danger" : "text-muted"
          }`}
        >
          {notice ??
            (conflicts.size > 0 ? t("settings.shortcuts.conflict") : null)}
        </p>
        <button
          type="button"
          disabled={!changed}
          className="h-7 shrink-0 rounded-md border border-line-strong bg-panel px-2.5 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong disabled:text-faint disabled:hover:bg-panel"
          onClick={() => {
            resetAllBindings();
            setNotice(null);
          }}
        >
          {t("settings.shortcuts.resetAll")}
        </button>
      </div>
    </div>
  );
}

/** One shortcut: its keys, to click and record anew, and a reset. */
function ShortcutRow({
  id,
  label,
  recording,
  conflict,
  onRecord,
}: {
  id: ShortcutId;
  label: string;
  recording: boolean;
  /** Another shortcut has the same keys. */
  conflict: boolean;
  onRecord: (on: boolean) => void;
}) {
  const t = useT();
  const binding = useBinding(id);
  const fallback = SHORTCUTS.find((s) => s.id === id)?.fallback ?? "";
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label}: ${
            binding === null ? t("settings.shortcuts.none") : keys(binding)
          }`}
          aria-pressed={recording}
          aria-invalid={conflict && !recording}
          // No frame of its own: the keys in their boxes are the button,
          // at the right edge; only a soft ground shows it on a hover.
          className="flex h-7 items-center justify-end rounded-md px-1.5 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong aria-pressed:bg-raise"
          onClick={() => onRecord(!recording)}
          onBlur={() => {
            if (recording) onRecord(false);
          }}
        >
          {recording ? (
            <span className="text-muted">{t("settings.shortcuts.record")}</span>
          ) : binding === null ? (
            <span className="text-faint">{t("settings.shortcuts.none")}</span>
          ) : (
            <Shortcut text={keys(binding)} danger={conflict} />
          )}
        </button>
        <ResetButton
          label={t("settings.resetTo", { value: keys(fallback) })}
          disabled={isDefault(id, binding)}
          onReset={() => setBinding(id, fallback)}
        />
      </div>
    </Row>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <span>{label}</span>
      {children}
    </div>
  );
}

/**
 * Puts a setting back to its default: an arrow turning back, framed as
 * the control of the setting beside it. Faded while the setting is the
 * default, so the row keeps its layout.
 */
function ResetButton({
  label,
  disabled,
  onReset,
}: {
  label: string;
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        // Framed as the list button beside it.
        className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line-strong bg-panel text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong disabled:opacity-50 disabled:hover:bg-panel disabled:hover:text-muted"
        onClick={onReset}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5" />
        </svg>
      </button>
    </Tooltip>
  );
}
