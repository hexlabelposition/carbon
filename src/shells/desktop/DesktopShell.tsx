import type { Vault } from "@carbon/core";
import {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BacklinksPanel } from "../../features/backlinks/BacklinksPanel";
import { CommandPalette } from "../../features/commands/CommandPalette";
import {
  keys,
  useCommandList,
  useCommands,
  type Command,
} from "../../features/commands/commands";
import {
  OPEN_PALETTE,
  useCommandPalette,
} from "../../features/commands/use-command-palette";
import { useBacklinks } from "../../features/backlinks/use-backlinks";
import { UnlinkedMentionsPanel } from "../../features/backlinks/UnlinkedMentionsPanel";
import { useUnlinkedMentions } from "../../features/backlinks/use-unlinked-mentions";
import { NoteEditor } from "../../features/editor/NoteEditor";
import { CarbonMark } from "../../features/brand/CarbonLogo";
import { ImageView } from "../../features/image/ImageView";
import { imageTypeOf } from "../../features/image/image-file";
import { useReadingMode } from "../../features/editor/use-reading-mode";
import { useSourceMode } from "../../features/editor/use-source-mode";
import { FileTree } from "../../features/file-tree/FileTree";
import { OutlinePanel } from "../../features/outline/OutlinePanel";
import { SearchPanel } from "../../features/search/SearchPanel";
import { useSearch } from "../../features/search/use-search";
import { QuickSwitcher } from "../../features/switcher/QuickSwitcher";
import { useQuickSwitcher } from "../../features/switcher/use-quick-switcher";
import { useOutline } from "../../features/outline/use-outline";
import { useT } from "../../features/i18n/i18n";
import { useAppSettings } from "../../features/settings/app-settings";
import { StartScreen } from "../../features/start/StartScreen";
import { useIndexStatus } from "../../features/vault/use-index-status";
import { useVaultSession } from "../../features/vault/vault-session";
import { useWorkspaceShortcuts } from "../../features/workspace/use-workspace-shortcuts";
import { useWorkspace } from "../../features/workspace/workspace";
import { WorkspaceProvider } from "../../features/workspace/WorkspaceProvider";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { useFileDropGuard } from "./use-file-drop-guard";
import { AppMark } from "./AppMark";
import { PanelToggle } from "./PanelToggle";
import { ResizeHandle } from "./ResizeHandle";
import { SlidePanel } from "./SlidePanel";
import { ViewTabs } from "./ViewTabs";
import {
  LEFT_PANEL_SHORTCUT,
  RIGHT_PANEL_SHORTCUT,
  usePanelShortcuts,
  useRightPanel,
  type RightPanel,
  type RightPanelView,
} from "./use-panels";
import { useSidePanel } from "./use-side-panel";
import { useSidebar, type PanelWidth } from "./use-sidebar";
import { useSidebarView, type SidebarViewState } from "./use-sidebar-view";
import {
  DragStrip,
  WINDOW_CONTROLS_ROOM,
  WindowControls,
  useWindowShape,
  type WindowFrame,
} from "./WindowControls";

// Dev builds only: in a release build the condition is false at build time
// and the panel is not bundled.
const DevPanel = import.meta.env.DEV
  ? lazy(() => import("../../dev/DevPanel"))
  : null;

/**
 * The desktop layout: the left panel, the main area and the right panel.
 * It decides which features are mounted and where; what they do lives in
 * their hooks (ARCHITECTURE.md, section 8).
 */
export function DesktopShell({ frame }: { frame: WindowFrame }) {
  useWindowShape(frame);
  const t = useT();
  const { vault, close } = useVaultSession();
  const { recentVaults } = useAppSettings();
  const sidebar = useSidebar();
  const { collapsed, toggle: toggleSidebar } = sidebar;
  const revealSidebar = useCallback(() => {
    if (collapsed) toggleSidebar();
  }, [collapsed, toggleSidebar]);
  const rightPanel = useRightPanel();
  const { toggle: toggleRightPanel } = rightPanel;
  useFileDropGuard();
  const [devOpen, setDevOpen] = useState(false);

  const showDev = devOpen && DevPanel !== null;
  const sidebarView = useSidebarView(vault !== null && !showDev, revealSidebar);
  const { show: showSidebarView } = sidebarView;
  const { toggleView: toggleRightView } = rightPanel;
  usePanelShortcuts(
    vault !== null && !showDev,
    toggleSidebar,
    toggleRightPanel,
  );

  useCommands(
    useMemo(() => {
      const commands: Command[] = [];
      if (DevPanel !== null) {
        commands.push({
          id: "shell.devPanel",
          title: t("shell.toggleDevPanel"),
          run: () => setDevOpen((open) => !open),
        });
      }
      if (vault === null || showDev) return commands;
      return [
        ...commands,
        {
          id: "shell.sidebar",
          title: t("shell.toggleLeftPanel"),
          shortcut: LEFT_PANEL_SHORTCUT,
          run: toggleSidebar,
        },
        {
          id: "shell.rightPanel",
          title: t("shell.toggleRightPanel"),
          shortcut: RIGHT_PANEL_SHORTCUT,
          run: toggleRightPanel,
        },
        {
          id: "shell.outline",
          title: t("shell.toggleOutline"),
          run: () => toggleRightView("outline"),
        },
        {
          id: "shell.backlinks",
          title: t("shell.toggleBacklinks"),
          run: () => toggleRightView("backlinks"),
        },
        {
          id: "shell.files",
          title: t("shell.showFiles"),
          run: () => {
            revealSidebar();
            showSidebarView("files");
          },
        },
        {
          id: "shell.search",
          title: t("shell.searchAll"),
          shortcut: keys("Mod+Shift+F"),
          run: () => {
            revealSidebar();
            showSidebarView("search");
          },
        },
        { id: "shell.closeVault", title: t("shell.closeVault"), run: close },
      ];
    }, [
      t,
      vault,
      showDev,
      toggleSidebar,
      toggleRightPanel,
      toggleRightView,
      revealSidebar,
      showSidebarView,
      close,
    ]),
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-ui text-fg">
      <AppMark />
      <WindowControls frame={frame} />
      <div className="flex min-h-0 flex-1">
        {showDev ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <DragStrip room roomStart />
            <div className="min-h-0 flex-1 overflow-auto">
              <Suspense fallback={null}>
                <DevPanel />
              </Suspense>
            </div>
          </div>
        ) : vault === null ? (
          <main className="flex min-w-0 flex-1 flex-col">
            <DragStrip room roomStart />
            <div className="min-h-0 flex-1 overflow-auto">
              <StartScreen />
            </div>
          </main>
        ) : (
          <WorkspaceProvider
            key={vault.root}
            vault={vault}
            initial={
              recentVaults.find((v) => v.path === vault.root)?.lastOpenedNote ??
              null
            }
          >
            <Sidebar
              open={!sidebar.collapsed}
              fraction={sidebar.fraction}
              onResize={sidebar.resize}
              onNudge={sidebar.nudge}
              header={
                <>
                  <span
                    data-tauri-drag-region
                    className="min-w-0 flex-1 truncate font-semibold"
                  >
                    {nameOf(vault.root)}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-sm px-1.5 text-small text-muted hover:bg-raise hover:text-fg"
                    onClick={close}
                  >
                    {t("shell.closeVault")}
                  </button>
                </>
              }
            >
              <SidebarContent
                vault={vault}
                view={sidebarView}
                reveal={revealSidebar}
              />
            </Sidebar>
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <NoteArea
                vault={vault}
                leftOpen={!sidebar.collapsed}
                onToggleLeft={toggleSidebar}
                right={rightPanel}
              />
            </main>
            <QuickSwitcherHost vault={vault} />
          </WorkspaceProvider>
        )}
      </div>
      <CommandPaletteHost />
    </div>
  );
}

/**
 * The views of the sidebar, files and search, with tabs to switch. Both
 * stay mounted: switching keeps the open folders and the search.
 */
function SidebarContent({
  vault,
  view: { view, show, searchRequest },
  reveal,
}: {
  vault: Vault;
  view: SidebarViewState;
  /** Opens the sidebar if it is shut. */
  reveal: () => void;
}) {
  const t = useT();
  const search = useSearch(vault);
  // For what the file tree starts from elsewhere, such as "New note" from
  // the palette: its name field must be where it can be typed in.
  const showFiles = useCallback(() => {
    reveal();
    show("files");
  }, [reveal, show]);
  return (
    <div className="flex h-full flex-col">
      <ViewTabs
        label={t("shell.sidebarViews")}
        views={[
          { view: "files", label: t("shell.files") },
          { view: "search", label: t("shell.search") },
        ]}
        current={view}
        onShow={show}
      />
      <div
        role="tabpanel"
        aria-label={t("shell.files")}
        className={view === "files" ? "min-h-0 flex-1" : "hidden"}
      >
        <FileTree vault={vault} onReveal={showFiles} />
      </div>
      <div
        role="tabpanel"
        aria-label={t("shell.search")}
        className={view === "search" ? "min-h-0 flex-1" : "hidden"}
      >
        <SearchPanel search={search} focusRequest={searchRequest} />
      </div>
      <VaultStatus vault={vault} />
    </div>
  );
}

/**
 * What the user should know about the vault, at the foot of the sidebar:
 * how far indexing is, and what does not work. Nothing while all is well.
 */
function VaultStatus({ vault }: { vault: Vault }) {
  const t = useT();
  const index = useIndexStatus(vault);
  // A scan with nothing to do is over a moment later: not worth a line.
  const indexing = index.state === "scanning" && index.total !== 0;
  if (vault.watching && index.state !== "failed" && !indexing) return null;
  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-line px-3 py-2 text-small text-faint">
      {!vault.watching && (
        <p className="text-danger">{t("shell.notWatching")}</p>
      )}
      <IndexState vault={vault} />
    </div>
  );
}

/** The command palette, shown while it is open (Ctrl+P). */
function CommandPaletteHost() {
  const palette = useCommandPalette();
  return palette.isOpen ? <CommandPalette palette={palette} /> : null;
}

/** The quick switcher, shown while it is open (Ctrl+O). */
function QuickSwitcherHost({ vault }: { vault: Vault }) {
  const switcher = useQuickSwitcher(vault);
  return switcher.isOpen ? <QuickSwitcher switcher={switcher} /> : null;
}

interface NoteAreaProps {
  vault: Vault;
  /** Whether the left panel is open, for its button at the start of the tabs. */
  leftOpen: boolean;
  onToggleLeft: () => void;
  /** The panel beside the note: its outline and the notes that link to it. */
  right: RightPanel;
}

/**
 * The main area of the workspace: the tabs, the note that is shown and,
 * beside it, the panels that are open: the outline of the note and its
 * backlinks, one above the other.
 */
function NoteArea({ vault, leftOpen, onToggleLeft, right }: NoteAreaProps) {
  const workspace = useWorkspace();
  const t = useT();
  useWorkspaceShortcuts();
  const sourceMode = useSourceMode();
  const readingMode = useReadingMode();
  const outline = useOutline();
  const { path } = workspace;
  /** The edge of the right panel is being dragged: it does not glide. */
  const [resizingRight, setResizingRight] = useState(false);

  const leftToggle = (
    <PanelToggle
      side="left"
      open={leftOpen}
      shortcut={LEFT_PANEL_SHORTCUT}
      onToggle={onToggleLeft}
    />
  );

  if (path === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DragStrip room roomStart={!leftOpen}>
          {leftToggle}
        </DragStrip>
        <Watermark label={t("shell.noNoteOpen")} />
      </div>
    );
  }
  const split = workspace.panes.length > 1;
  const last = workspace.panes.length - 1;
  return (
    <div className="flex min-h-0 flex-1">
      {workspace.panes.map((pane, index) => {
        const active = index === workspace.activePane;
        return (
          <section
            key={pane.id}
            aria-label={
              split ? t("shell.pane", { number: index + 1 }) : undefined
            }
            className={`flex min-w-0 flex-1 flex-col ${
              index > 0 ? "border-l border-line" : ""
            }`}
            // The pane the user works in is the one keys and the rest of
            // the app act on.
            onMouseDownCapture={() => workspace.focusPane(index)}
            onFocusCapture={() => workspace.focusPane(index)}
          >
            {/* With two panes, the one not worked in is dimmed. */}
            <div className={split && !active ? "opacity-60" : undefined}>
              <TabBar
                tabs={pane.tabs.map((tab) => ({
                  id: tab.id,
                  label: nameOf(tab.path).replace(/\.md$/i, ""),
                  title: tab.path,
                }))}
                activeId={pane.activeTabId}
                canGoBack={pane.canGoBack}
                canGoForward={pane.canGoForward}
                onBack={workspace.back}
                onForward={workspace.forward}
                onActivate={workspace.activateTab}
                onClose={workspace.closeTab}
                start={index === 0 ? leftToggle : undefined}
                // With the left panel shut, the bar starts at the left edge.
                leaveRoomStart={index === 0 && !leftOpen}
                end={
                  index === last ? (
                    <PanelToggle
                      side="right"
                      open={right.open}
                      shortcut={RIGHT_PANEL_SHORTCUT}
                      onToggle={right.toggle}
                    />
                  ) : undefined
                }
                // The right end of the top row holds the window buttons.
                leaveRoom={!right.open && index === last}
              />
            </div>
            {pane.path !== null && imageTypeOf(pane.path) !== null && (
              <div className="min-h-0 flex-1">
                <ImageView key={pane.path} vault={vault} path={pane.path} />
              </div>
            )}
            {pane.path !== null && imageTypeOf(pane.path) === null && (
              <div className="min-h-0 flex-1">
                <NoteEditor
                  key={pane.path}
                  vault={vault}
                  path={pane.path}
                  sourceMode={sourceMode.on}
                  onToggleSourceMode={sourceMode.toggle}
                  readingMode={readingMode.on}
                  onToggleReadingMode={readingMode.toggle}
                  // One outline: of the note in the active pane.
                  outline={active ? outline.link : undefined}
                  active={active}
                />
              </div>
            )}
          </section>
        );
      })}
      <SlidePanel
        open={right.open}
        // As the sidebar: a share of the window, at least 180 pixels.
        width={`max(11.25rem, ${right.width.fraction * 100}vw)`}
        animate={!resizingRight}
        keepMounted={false}
      >
        <RightPanelContent
          width={right.width}
          onResizing={setResizingRight}
          vault={vault}
          path={path}
          view={right.view}
          onShow={right.show}
          outline={
            <OutlinePanel
              headings={outline.headings}
              current={outline.current}
              onReveal={outline.reveal}
            />
          }
        />
      </SlidePanel>
    </div>
  );
}

/**
 * What the index is doing, while it is not ready: how far the startup scan
 * is, or that links and backlinks do not work without it. Nothing once it
 * is ready.
 */
function IndexState({ vault }: { vault: Vault }) {
  const t = useT();
  const status = useIndexStatus(vault);
  if (status.state === "ready") return null;
  if (status.state === "failed") {
    const reason =
      status.error instanceof Error
        ? status.error.message
        : String(status.error);
    return (
      <p className="text-danger" title={reason}>
        {t("shell.indexFailed")}
      </p>
    );
  }
  const { done, total } = status;
  // Nothing changed since the last start: ready a moment later.
  if (total === 0) return null;
  return (
    <p role="status">
      {total === null
        ? t("shell.indexing")
        : t("shell.indexingOf", { done, count: total })}
    </p>
  );
}

/**
 * The panel at the right of the note, laid out as the left one: an empty
 * top row, which drags the window and leaves its buttons room, the tabs
 * of what it can show, and what it shows.
 */
function RightPanelContent({
  width,
  onResizing,
  vault,
  path,
  view,
  onShow,
  outline,
}: {
  width: PanelWidth;
  /** Told when its edge is dragged and let go. */
  onResizing: (resizing: boolean) => void;
  vault: Vault;
  path: string;
  view: RightPanelView;
  onShow: (view: RightPanelView) => void;
  /** The outline of the note, which the note area keeps up to date. */
  outline: ReactNode;
}) {
  const t = useT();
  const backlinks = useBacklinks(vault, path);
  return (
    <aside
      aria-label={t("shell.rightPanel")}
      className="relative flex h-full flex-col border-l border-line bg-panel"
    >
      <ResizeHandle
        side="right"
        label={t("shell.resizeRightPanel")}
        fraction={width.fraction}
        onResize={width.resize}
        onNudge={width.nudge}
        onDragging={onResizing}
      />
      <div
        data-tauri-drag-region
        className={`h-12 shrink-0 border-b border-line ${WINDOW_CONTROLS_ROOM}`}
      />
      <ViewTabs
        label={t("shell.rightPanelViews")}
        views={[
          { view: "outline", label: t("shell.outline") },
          {
            view: "backlinks",
            label: (
              <>
                {t("shell.backlinks")}
                {backlinks.status === "ready" && (
                  <span className="text-faint">
                    {backlinks.backlinks.length}
                  </span>
                )}
              </>
            ),
          },
        ]}
        current={view}
        onShow={onShow}
      />
      <div role="tabpanel" className="min-h-0 flex-1 overflow-auto">
        {view === "outline" ? (
          outline
        ) : (
          <BacklinksView vault={vault} path={path} backlinks={backlinks} />
        )}
      </div>
    </aside>
  );
}

function BacklinksView({
  vault,
  path,
  backlinks,
}: {
  vault: Vault;
  path: string;
  backlinks: ReturnType<typeof useBacklinks>;
}) {
  const mentionsPanel = useSidePanel("carbon.desktop.unlinkedMentions");
  const mentions = useUnlinkedMentions(vault, path, mentionsPanel.open);
  const { open } = useWorkspace();
  return (
    <>
      <BacklinksPanel
        state={backlinks}
        onOpen={(note, at) => open(note, { at })}
      />
      <UnlinkedMentionsPanel
        mentions={mentions}
        open={mentionsPanel.open}
        onToggle={mentionsPanel.toggle}
        onOpen={(note, at) => open(note, { at })}
      />
    </>
  );
}

/** The commands offered below the watermark, in this order. */
const WATERMARK_COMMANDS = [
  "fileTree.newNote",
  "switcher.open",
  OPEN_PALETTE,
  "settings.open",
];

/**
 * The mark as a large shadow, a shade off the background, and below it a
 * few commands to start with: what the note area shows while no note is
 * open. `label` says so to screen readers.
 */
function Watermark({ label }: { label: string }) {
  const all = useCommandList();
  const commands = WATERMARK_COMMANDS.flatMap(
    (id) => all.find((command) => command.id === id) ?? [],
  );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-8">
      <CarbonMark shadow className="h-auto w-[min(15rem,50%)] text-line" />
      <span className="sr-only">{label}</span>
      {commands.length > 0 && (
        <ul className="flex w-full max-w-72 flex-col">
          {commands.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-1 text-muted hover:bg-raise hover:text-fg"
                onClick={command.run}
              >
                <span className="truncate">{command.title}</span>
                {command.shortcut !== undefined && (
                  <Shortcut text={command.shortcut} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Keys such as "Ctrl+O", each in a box. */
function Shortcut({ text }: { text: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-small text-faint">
      {text.split("+").map((key, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <kbd className="min-w-5 rounded-sm border border-line-strong bg-panel px-1 text-center font-sans">
            {key}
          </kbd>
        </Fragment>
      ))}
    </span>
  );
}

/** The folder name of a vault: the last part of its path. */
function nameOf(root: string): string {
  return root.slice(root.lastIndexOf("/") + 1);
}
