import { Dialog } from "@base-ui/react/dialog";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
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
  focusOnOpenPreference,
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
  useSystemFonts,
  useWarmFonts,
  type FontChoice,
  type SystemFont,
} from "./fonts";
import { FontPicker } from "./FontPicker";
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
  inlineTitlePreference,
  listGuidesPreference,
  nameHeadingPreference,
  webImagesPreference,
} from "./note-style";
import { Tooltip } from "../ui/Tooltip";
import { ScrollArea } from "../ui/ScrollArea";
import { SettingSelect, SettingSwitch } from "../ui/controls";
import { log } from "../log/log";
import { newIssueUrl } from "../help/report-bug";
import { StartupOverSettings } from "../startup/StartupHost";
import { slowStartNoticePreference } from "../startup/slow-start";
import { resetPreferences } from "./preference";
import {
  hiddenToolsPreference,
  setToolShown,
  TOOLBAR_TOOLS,
  toolbarPreference,
} from "./toolbar";
import {
  checkAtStartPreference,
  checkForUpdates,
  showUpdate,
  useCanCheckForUpdates,
  useCheckState,
} from "../updates/update-state";

/** Opens the settings dialog; another dialog open closes. */
function openSettings(): void {
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

/**
 * The groups, in the order of the column, each with its icon: 16 by 16
 * outlines, drawn as the other icons of the app.
 */
const GROUPS: readonly {
  group: SettingsGroup;
  label: MessageKey;
  icon: ReactNode;
}[] = [
  {
    group: "general",
    label: "settings.general",
    icon: (
      <>
        <path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7" />
        <circle cx="11" cy="4.5" r="1.5" />
        <circle cx="5" cy="11.5" r="1.5" />
      </>
    ),
  },
  {
    group: "appearance",
    label: "settings.appearance",
    icon: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </>
    ),
  },
  {
    group: "fonts",
    label: "settings.fonts",
    icon: (
      <>
        <path d="M1.5 12.5 5 3.5l3.5 9M2.85 9.5h4.3" />
        <circle cx="12" cy="10.75" r="1.75" />
        <path d="M13.75 8.75v3.75" />
      </>
    ),
  },
  {
    group: "notes",
    label: "settings.notes",
    icon: <path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 8.5h4M6 11h4" />,
  },
  {
    group: "editor",
    label: "settings.editor",
    icon: <path d="M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3" />,
  },
  {
    group: "shortcuts",
    label: "settings.shortcuts",
    icon: (
      <>
        <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
        <path d="M4.25 6.75h.01M6.75 6.75h.01M9.25 6.75h.01M11.75 6.75h.01M5 9.5h6" />
      </>
    ),
  },
];

/**
 * An icon of the settings: a 16 by 16 outline in the color of the text,
 * drawn at the sizes of the main window: as the icon beside the name of
 * the vault next to text, as the buttons of a note in a button.
 */
function SettingsIcon({
  children,
  size = "size-4.5",
}: {
  children: ReactNode;
  size?: "size-4.5" | "size-5";
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`${size} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/**
 * The settings of the app: applies the note settings and the language
 * and shows the dialog while it is open. Mount it once, inside the
 * commands provider. What opens it is `SettingsOpener`, mounted apart.
 * `openLogFolder` shows where the log file is (C-606), `openWebPage`
 * opens the page to report a bug on: each is offered in the General group
 * and in the command palette where the platform gives it.
 */
export function Settings({
  openLogFolder,
  openWebPage,
  listFonts,
}: {
  openLogFolder?: () => Promise<void>;
  openWebPage?: (url: string) => Promise<void>;
  /** The font families of the system, offered in the Fonts group. */
  listFonts?: () => Promise<readonly SystemFont[]>;
}) {
  useNoteStyle();
  useFonts();
  const t = useT();
  const language = useLanguage();
  const [open, setOpen] = useDialog("settings");
  /** The group shown: the last one, while the app runs. */
  const [group, setGroup] = useState<SettingsGroup>("general");
  /** The tab of the group shown, which takes the focus as it opens. */
  const groupTab = useRef<HTMLButtonElement>(null);

  // The language of the page: hyphenation follows it.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const help = useHelp(openLogFolder, openWebPage);

  useCommands(
    useMemo(
      () => [
        {
          id: "settings.resetNoteSize",
          title: t("settings.resetNoteSize"),
          run: resetNoteSize,
        },
        ...(help.openLogs === undefined
          ? []
          : [{ id: "logs.open", title: t("logs.open"), run: help.openLogs }]),
        ...(help.reportBug === undefined
          ? []
          : [
              {
                id: "help.reportBug",
                title: t("help.reportBug"),
                run: help.reportBug,
              },
            ]),
      ],
      [t, help],
    ),
  );

  return (
    <AppDialog
      open={open}
      onClose={() => setOpen(false)}
      // The group shown, not the first control: that is the close button,
      // whose tooltip would open. The arrows then go through the groups.
      initialFocus={groupTab}
      // Centered by its margins, not moved back by half its size: a move of
      // half an odd size lands between pixels, and the text in it is drawn
      // blurred. Sizes in pixels, not as the classes of the scale: the root
      // text is 13px, so a step of the scale is 3.25px, and "w-220" would be
      // 715px, not 880.
      className="fixed inset-0 m-auto flex h-[min(600px,calc(100vh-96px))] w-[880px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
    >
      {/* A header as the one above a note: the name, and a way out. */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel pr-1.5 pl-4">
        <Dialog.Title className="font-semibold">
          {t("settings.title")}
        </Dialog.Title>
        <Tooltip label={t("common.close")} shortcut="Esc">
          <Dialog.Close
            aria-label={t("common.close")}
            className="ml-auto flex size-8 items-center justify-center rounded-md text-muted outline-none hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
          >
            <SettingsIcon size="size-5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </SettingsIcon>
          </Dialog.Close>
        </Tooltip>
      </header>
      <div className="flex min-h-0 flex-1">
        {/* The groups at the left, one shown at a time at the right. */}
        {/* As wide as the longest name of a group, in any language. */}
        <nav className="flex w-max min-w-52 shrink-0 flex-col border-r border-line bg-panel p-2">
          <GroupTabs current={group} onShow={setGroup} currentRef={groupTab} />
          <p className="mt-auto px-2.5 pb-1 text-small text-faint">
            {t("settings.version", { version: __CARBON_VERSION__ })}
          </p>
        </nav>
        <ScrollArea
          rootClassName="min-w-0 flex-1"
          className="flex-1"
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`settings-tab-${group}`}
        >
          {/* A readable column, as the text of a note: 600px wide at most. */}
          <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-8 pt-6 pb-8">
            <h2 className="text-h2 font-semibold">
              {t(
                GROUPS.find((g) => g.group === group)?.label ??
                  "settings.general",
              )}
            </h2>
            {group === "general" && <GeneralSettings help={help} />}
            {group === "appearance" && <AppearanceSettings />}
            {group === "fonts" && <FontSettings listFonts={listFonts} />}
            {group === "notes" && <NoteSettings />}
            {group === "editor" && <EditorSettings />}
            {group === "shortcuts" && <ShortcutSettings />}
          </div>
        </ScrollArea>
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
  currentRef,
}: {
  current: SettingsGroup;
  onShow: (group: SettingsGroup) => void;
  /** Given the tab of the group shown. */
  currentRef?: Ref<HTMLButtonElement>;
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
      {GROUPS.map(({ group, label, icon }) => {
        const selected = group === current;
        return (
          <button
            key={group}
            ref={selected ? currentRef : undefined}
            type="button"
            role="tab"
            id={`settings-tab-${group}`}
            aria-selected={selected}
            aria-controls="settings-panel"
            tabIndex={selected ? 0 : -1}
            className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left whitespace-nowrap outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong ${
              selected ? "bg-selected font-medium text-fg" : "text-muted"
            }`}
            onClick={() => onShow(group)}
          >
            <SettingsIcon>{icon}</SettingsIcon>
            {t(label)}
          </button>
        );
      })}
    </div>
  );
}

/** The ways to get help that the platform gives: each may be missing. */
interface Help {
  openLogs?: () => void;
  reportBug?: () => void;
}

/**
 * Opening the log folder and the page of a new issue, for the General
 * group and the command palette. The same object while the platform and
 * the version stay, so the commands are not offered again on every draw.
 */
function useHelp(
  openLogFolder: (() => Promise<void>) | undefined,
  openWebPage: ((url: string) => Promise<void>) | undefined,
): Help {
  return useMemo(
    () => ({
      openLogs:
        openLogFolder &&
        (() => {
          openLogFolder().catch((reason: unknown) =>
            log.error("Could not open the log folder", reason),
          );
        }),
      reportBug:
        openWebPage &&
        (() => {
          openWebPage(newIssueUrl(__CARBON_VERSION__)).catch(
            (reason: unknown) =>
              log.error("Could not open the page to report a bug", reason),
          );
        }),
    }),
    [openLogFolder, openWebPage],
  );
}

function GeneralSettings({ help }: { help: Help }) {
  const t = useT();
  const language = languagePreference.use();
  const deleteTo = deleteToPreference.use();
  const checkAtStart = checkAtStartPreference.use();
  const canCheck = useCanCheckForUpdates();
  return (
    <>
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
      {canCheck && (
        <Rows title={t("updates.title")}>
          <Row label={t("settings.version", { version: __CARBON_VERSION__ })}>
            <UpdateStatus />
          </Row>
          <Row label={t("updates.checkAtStart")}>
            <SettingSwitch
              label={t("updates.checkAtStart")}
              checked={checkAtStart}
              onChange={checkAtStartPreference.set}
            />
          </Row>
        </Rows>
      )}
      <Rows title={t("help.title")}>
        {help.reportBug !== undefined && (
          <Row label={t("help.reportBug")}>
            <button
              type="button"
              className={cardButton}
              onClick={help.reportBug}
            >
              {t("help.reportBugButton")}
            </button>
          </Row>
        )}
        {help.openLogs !== undefined && (
          <Row label={t("logs.row")}>
            <button
              type="button"
              className={cardButton}
              onClick={help.openLogs}
            >
              {t("logs.openShort")}
            </button>
          </Row>
        )}
        <StartupRow />
      </Rows>
      <ResetSettings />
    </>
  );
}

/**
 * Whether to be told of a slow start, with a stopwatch beside the switch
 * that shows how the vault started: over the settings, which stay open
 * below it, as the question before a reset.
 */
function StartupRow() {
  const t = useT();
  const notice = slowStartNoticePreference.use();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    // The focus is not given back while the settings are open
    // (`AppDialog`): back to the button here.
    requestAnimationFrame(() => button.current?.focus());
  }

  return (
    <Row label={t("startup.notice")}>
      <div className="flex shrink-0 items-center gap-3">
        <Tooltip label={t("startup.show")}>
          <button
            ref={button}
            type="button"
            aria-label={t("startup.show")}
            // Framed as the reset buttons beside other settings.
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line-strong bg-panel text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
            onClick={() => setOpen(true)}
          >
            <SettingsIcon>
              {/* A stopwatch: the dial, its hand, the button on top. */}
              <circle cx="8" cy="9" r="5" />
              <path d="M8 9V6.5M6.5 2.5h3M8 2.5V4M12 4.5l1-1" />
            </SettingsIcon>
          </button>
        </Tooltip>
        <SettingSwitch
          label={t("startup.notice")}
          checked={notice}
          onChange={slowStartNoticePreference.set}
        />
      </div>
      <StartupOverSettings open={open} onClose={close} />
    </Row>
  );
}

/**
 * Puts every setting back to its default, after a question in a dialog
 * over the settings. It is not one of the dialogs that stand over the
 * window one at a time (`openDialog`): the settings stay open below it.
 * The question gives the focus to "Cancel", so a stray Enter resets
 * nothing.
 */
function ResetSettings() {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const ask = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  function answer(reset: boolean) {
    if (reset) resetPreferences();
    setAsking(false);
    // The focus is not given back while the settings are open
    // (`AppDialog`): back to the button here.
    requestAnimationFrame(() => ask.current?.focus());
  }

  const button = "h-8 rounded-md px-3 outline-none focus-visible:ring-2";
  return (
    <Rows>
      <Row label={t("settings.reset")}>
        <button
          ref={ask}
          type="button"
          className={cardButton}
          onClick={() => setAsking(true)}
        >
          {t("settings.resetConfirm")}
        </button>
      </Row>
      <AppDialog
        open={asking}
        onClose={() => answer(false)}
        initialFocus={cancel}
        aria-labelledby="settings-reset-title"
        aria-describedby="settings-reset-text"
        popupProps={{ role: "alertdialog" }}
        backdrop="bg-backdrop/40"
        className="fixed inset-0 m-auto h-fit w-full max-w-[min(440px,calc(100vw-32px))] rounded-lg border border-line bg-bg p-4 shadow-dialog"
      >
        <h2 id="settings-reset-title" className="font-medium">
          {t("settings.resetQuestion")}
        </h2>
        <p id="settings-reset-text" className="mt-1.5 text-muted">
          {t("settings.resetText")}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            className={`${button} border border-line-strong hover:bg-raise focus-visible:ring-line-strong`}
            onClick={() => answer(false)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`${button} bg-danger text-on-danger focus-visible:ring-line-strong`}
            onClick={() => answer(true)}
          >
            {t("settings.resetConfirm")}
          </button>
        </div>
      </AppDialog>
    </Rows>
  );
}

/** A button in a row of the settings, as "Check now". */
const cardButton =
  "h-7 shrink-0 rounded-md border border-line-strong bg-panel px-3 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong disabled:opacity-50 disabled:hover:bg-panel";

/**
 * What the last look for a newer version found, beside the button that
 * looks again. Only an update found opens a dialog, to install it; why a
 * look failed is in the tooltip and the log.
 */
function UpdateStatus() {
  const t = useT();
  const state = useCheckState();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {state.kind === "checking" && (
        <span className="text-muted">{t("updates.checking")}</span>
      )}
      {state.kind === "upToDate" && (
        <span className="text-muted">{t("updates.latest")}</span>
      )}
      {state.kind === "failed" && (
        <Tooltip label={state.message}>
          <span
            tabIndex={0}
            className="cursor-default text-danger outline-none"
          >
            {t("updates.checkFailed")}
          </span>
        </Tooltip>
      )}
      {state.kind === "available" ? (
        <>
          <span className="text-muted">
            {t("updates.availableShort", { version: state.update.version })}
          </span>
          <button type="button" className={cardButton} onClick={showUpdate}>
            {t("updates.update")}
          </button>
        </>
      ) : (
        <button
          type="button"
          className={cardButton}
          disabled={state.kind === "checking"}
          onClick={checkForUpdates}
        >
          {t("updates.checkNow")}
        </button>
      )}
    </div>
  );
}

function AppearanceSettings() {
  const t = useT();
  const theme = themePreference.use();
  const zoom = zoomPreference.use();
  const toolbar = toolbarPreference.use();
  const hiddenTools = hiddenToolsPreference.use();
  return (
    <>
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
        <Row label={t("shell.toolbar")}>
          <SettingSwitch
            label={t("shell.toolbar")}
            checked={toolbar}
            onChange={toolbarPreference.set}
          />
        </Row>
      </Rows>
      {/* The same as the right-click menu of the toolbar. */}
      <Rows title={t("settings.toolbarButtons")}>
        {TOOLBAR_TOOLS.map((tool) => (
          <Row key={tool.id} label={t(tool.label)}>
            <SettingSwitch
              label={t(tool.label)}
              checked={!hiddenTools.includes(tool.id)}
              onChange={(shown) => setToolShown(tool.id, shown)}
            />
          </Row>
        ))}
      </Rows>
    </>
  );
}

function NoteSettings() {
  const t = useT();
  const size = noteSizePreference.use();
  const width = noteWidthPreference.use();
  const wheelSize = wheelTextSizePreference.use();
  const lineHeight = lineHeightPreference.use();
  const inlineTitle = inlineTitlePreference.use();
  const listGuides = listGuidesPreference.use();
  const nameHeading = nameHeadingPreference.use();
  const webImages = webImagesPreference.use();
  return (
    <>
      <Rows>
        <Row label={t("settings.inlineTitle")}>
          <SettingSwitch
            label={t("settings.inlineTitle")}
            checked={inlineTitle}
            onChange={inlineTitlePreference.set}
          />
        </Row>
        <Row label={t("settings.listGuides")}>
          <SettingSwitch
            label={t("settings.listGuides")}
            checked={listGuides}
            onChange={listGuidesPreference.set}
          />
        </Row>
        <Row label={t("settings.nameHeading")}>
          <SettingSwitch
            label={t("settings.nameHeading")}
            checked={nameHeading}
            onChange={nameHeadingPreference.set}
          />
        </Row>
        <Row label={t("settings.webImages")}>
          <SettingSwitch
            label={t("settings.webImages")}
            checked={webImages}
            onChange={webImagesPreference.set}
          />
        </Row>
      </Rows>
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
        <Row label={t("settings.wheelSize", { key: keys("Mod") })}>
          <SettingSwitch
            label={t("settings.wheelSize", { key: keys("Mod") })}
            checked={wheelSize}
            onChange={wheelTextSizePreference.set}
          />
        </Row>
      </Rows>
      <Rows>
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
      </Rows>
    </>
  );
}

/** How the editor behaves: the mode to start in, Tab, the focus. */
function EditorSettings() {
  const t = useT();
  const startMode = startModePreference.use();
  const indent = indentPreference.use();
  const focusOnOpen = focusOnOpenPreference.use();
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
      <Row label={t("settings.focusOnOpen")}>
        <SettingSwitch
          label={t("settings.focusOnOpen")}
          checked={focusOnOpen}
          onChange={focusOnOpenPreference.set}
        />
      </Row>
    </Rows>
  );
}

/**
 * The three fonts: of the interface, of the note text, and the monospace
 * one, for code and for note text set to monospace.
 */
function FontSettings({
  listFonts,
}: {
  listFonts: (() => Promise<readonly SystemFont[]>) | undefined;
}) {
  const t = useT();
  const ui = uiFontPreference.use();
  const text = noteFontPreference.use();
  const mono = monoFontPreference.use();
  // Listed as the group opens: it takes a moment, and only once a run.
  const system = useSystemFonts(listFonts);
  // Loaded ahead, so a quick scroll of a list finds them ready.
  useWarmFonts(system);
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
        <FontPicker
          label={t("settings.font.ui")}
          value={ui}
          named={choices(UI_FONTS, ui)}
          system={system}
          onChange={uiFontPreference.set}
        />
      </Row>
      <Row label={t("settings.font.text")}>
        <FontPicker
          label={t("settings.font.text")}
          value={text}
          named={NOTE_FONTS.map(({ value, label }) => ({
            value,
            label: t(label),
          }))}
          system={system}
          onChange={noteFontPreference.set}
        />
      </Row>
      <Row label={t("settings.font.mono")}>
        <FontPicker
          label={t("settings.font.mono")}
          value={mono}
          named={choices(MONO_FONTS, mono)}
          system={system}
          monospace
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
      <p className="text-muted">{t("settings.shortcuts.hint")}</p>
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

/**
 * Settings that go together, as a card: one row each, thin lines between
 * them, and a title above when given.
 */
function Rows({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title !== undefined && (
        <h3 className="px-1 text-small font-medium text-muted">{title}</h3>
      )}
      <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <span className="min-w-0">{label}</span>
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
