import type { Vault } from "@carbon/core";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { BacklinksPanel } from "../../features/backlinks/BacklinksPanel";
import { CommandPalette } from "../../features/commands/CommandPalette";
import { Shortcut } from "../../features/commands/Shortcut";
import { useCommandList, useCommands } from "../../features/commands/commands";
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
import { useNoteMode } from "../../features/editor/use-note-mode";
import { FileTree } from "../../features/file-tree/FileTree";
import { OutlinePanel } from "../../features/outline/OutlinePanel";
import { SearchDialog } from "../../features/search/SearchDialog";
import { TagsPanel } from "../../features/tags/TagsPanel";
import { TrashPanel } from "../../features/trash/TrashPanel";
import { BookmarksPanel } from "../../features/bookmarks/BookmarksPanel";
import {
  useBookmarkCommand,
  useBookmarks,
} from "../../features/bookmarks/use-bookmarks";
import { useTrash } from "../../features/trash/use-trash";
import { useTags } from "../../features/tags/use-tags";
import { OPEN_SEARCH, useSearch } from "../../features/search/use-search";
import { NewNoteDialog } from "../../features/new-note/NewNoteDialog";
import { NEW_NOTE, useNewNote } from "../../features/new-note/use-new-note";
import { QuickSwitcher } from "../../features/switcher/QuickSwitcher";
import { useQuickSwitcher } from "../../features/switcher/use-quick-switcher";
import {
  OPEN_RANDOM_NOTE,
  useRandomNote,
} from "../../features/random-note/use-random-note";
import { useOutline } from "../../features/outline/use-outline";
import {
  TOGGLE_GRAPH,
  useGraphView,
} from "../../features/graph/use-graph-view";
import { useT } from "../../features/i18n/i18n";
import { useAppSettings } from "../../features/settings/app-settings";
import {
  toggleToolbar,
  toolbarPreference,
} from "../../features/settings/toolbar";
import { SettingsOpener } from "../../features/settings/Settings";
import { StartScreen } from "../../features/start/StartScreen";
import { timing } from "../../features/vault/timing";
import { IndexTiming } from "../../features/vault/IndexTiming";
import { StartupHost } from "../../features/startup/StartupHost";
import { NotificationsButton } from "../../features/notifications/NotificationsButton";
import { useIndexStatus } from "../../features/vault/use-index-status";
import { useVaultSession } from "../../features/vault/vault-session";
import { useWorkspaceShortcuts } from "../../features/workspace/use-workspace-shortcuts";
import { useWorkspace } from "../../features/workspace/workspace";
import { WorkspaceProvider } from "../../features/workspace/WorkspaceProvider";
import { HistoryButtons } from "../../features/workspace/HistoryButtons";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { useContextMenuGuard } from "./use-context-menu-guard";
import { useTabFocusGuard } from "./use-tab-focus-guard";
import { useEmojiChooserGuard } from "./use-emoji-chooser-guard";
import { useClickFocusGuard } from "./use-click-focus-guard";
import { useReadyToShow } from "./use-ready-to-show";
import { VaultMenu } from "./VaultMenu";
import { useFileDropGuard } from "./use-file-drop-guard";
import { AppMark } from "./AppMark";
import { PanelToggle } from "./PanelToggle";
import { ResizeHandle } from "./ResizeHandle";
import { SlidePanel } from "./SlidePanel";
import { ViewTabs } from "./ViewTabs";
import { Toolbar, type ToolbarItem } from "./Toolbar";
import { toolbarIcons } from "./toolbar-icons";
import {
  noteMinFraction,
  panelWidth,
  TOOLBAR_WIDTH,
  toolbarFraction,
  WINDOW_CONTROLS_ROOM,
} from "./layout";
import {
  usePanelShortcuts,
  useRightPanel,
  type RightPanel,
  type RightPanelView,
} from "./use-panels";
import { useSidePanel } from "./use-side-panel";
import { useSidebar, type PanelWidth } from "./use-sidebar";
import { useSidebarView, type SidebarViewState } from "./use-sidebar-view";
import { DragStrip, WindowControls } from "./WindowControls";
import {
  useFullscreenShortcut,
  useWindowShape,
  type WindowFrame,
} from "./window-frame";
import { Tooltip } from "../../features/ui/Tooltip";
import { useShortcutLabel } from "../../features/shortcuts/shortcuts";
import { errorText } from "../../features/i18n/error-text";

// Dev builds only: in a release build the condition is false at build time
// and neither is bundled.
const DevPanel = import.meta.env.DEV
  ? lazy(() => import("../../dev/DevPanel"))
  : null;
const DevButton = import.meta.env.DEV
  ? lazy(() => import("../../dev/DevButton"))
  : null;

// Loaded when a graph is first shown: sigma.js and its WebGL programs
// would add about 450 kB to the start of the app.
const GraphView = lazy(() =>
  import("../../features/graph/GraphView").then((module) => ({
    default: module.GraphView,
  })),
);
const LocalGraphView = lazy(() =>
  import("../../features/graph/GraphView").then((module) => ({
    default: module.LocalGraphView,
  })),
);

/**
 * The desktop layout: the left panel, the main area and the right panel.
 * It decides which features are mounted and where; what they do lives in
 * their hooks (ARCHITECTURE.md, section 8).
 */
export function DesktopShell({
  frame,
  showInFileManager,
}: {
  frame: WindowFrame;
  /** Opens the file manager of the system at an absolute path. */
  showInFileManager?: (path: string) => Promise<void>;
}) {
  // The first frame the app draws: the window shows something (C-602).
  useEffect(() => {
    requestAnimationFrame(() => {
      timing.shownAt ??= performance.now();
    });
  }, []);
  useWindowShape(frame);
  useFullscreenShortcut(frame);
  const t = useT();
  const { vault, close, restoring } = useVaultSession();
  const { recentVaults } = useAppSettings();
  const sidebar = useSidebar();
  const { collapsed, toggle: toggleSidebar } = sidebar;
  const revealSidebar = useCallback(() => {
    if (collapsed) toggleSidebar();
  }, [collapsed, toggleSidebar]);
  const rightPanel = useRightPanel();
  const { toggle: toggleRightPanel } = rightPanel;
  // Shown or hidden here, in the settings and by its shortcut alike.
  const toolbarOpen = toolbarPreference.use();
  // The two side panels never cover each other: each is at most as wide
  // as the window less the toolbar, the other panel and the narrowest
  // notes between them. As drawn (`panelWidth`), so as it is dragged.
  const rightOpen = rightPanel.open;
  const rightFraction = rightPanel.width.fraction;
  const sidebarFraction = sidebar.fraction;
  /** The sidebar as it is drawn, as a share of the window. */
  const drawnSidebar = useCallback(
    () =>
      collapsed
        ? 0
        : Math.min(
            sidebarFraction,
            1 - toolbarFraction(toolbarOpen) - noteMinFraction(),
          ),
    [collapsed, sidebarFraction, toolbarOpen],
  );
  const startFraction = useCallback(
    () => toolbarFraction(toolbarOpen) + drawnSidebar(),
    [toolbarOpen, drawnSidebar],
  );
  const sidebarRoom = useCallback(() => {
    const note = noteMinFraction();
    // The right panel as it is drawn: made narrower by the sidebar, if
    // that was opened wide while it was shut (`NoteArea`).
    const right = rightOpen
      ? Math.min(rightFraction, 1 - startFraction() - note)
      : 0;
    return 1 - toolbarFraction(toolbarOpen) - right - note;
  }, [toolbarOpen, rightOpen, rightFraction, startFraction]);
  const toolbarWidth = toolbarOpen ? TOOLBAR_WIDTH : "0px";
  const sidebarWidth = panelWidth(sidebar.fraction, toolbarWidth);
  useFileDropGuard();
  useContextMenuGuard();
  useTabFocusGuard();
  useEmojiChooserGuard();
  useClickFocusGuard();
  // Nothing shows while the vault left open is opened again: then the
  // interface fades in whole.
  const shown = useReadyToShow(!restoring);
  const [devOpen, setDevOpen] = useState(false);
  const leftShortcut = useShortcutLabel("shell.sidebar");
  const rightShortcut = useShortcutLabel("shell.rightPanel");
  const toolbarShortcut = useShortcutLabel("shell.toolbar");

  const showDev = devOpen && DevPanel !== null;
  const sidebarView = useSidebarView();
  const { show: showSidebarView } = sidebarView;
  const { toggleView: toggleRightView } = rightPanel;
  usePanelShortcuts(
    // A dialog open too: the panels show or hide below it, as the window
    // buttons work (`AppDialog` leaves the top row out).
    vault !== null && !showDev,
    toggleSidebar,
    toggleRightPanel,
    toggleToolbar,
  );

  useCommands(
    useMemo(() => {
      if (vault === null || showDev) return [];
      return [
        {
          id: "shell.sidebar",
          title: t("shell.toggleLeftPanel"),
          shortcut: leftShortcut,
          run: toggleSidebar,
        },
        {
          id: "shell.rightPanel",
          title: t("shell.toggleRightPanel"),
          shortcut: rightShortcut,
          run: toggleRightPanel,
        },
        {
          id: "shell.toolbar",
          title: t("shell.toggleToolbar"),
          shortcut: toolbarShortcut,
          run: toggleToolbar,
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
          id: "shell.localGraph",
          title: t("shell.toggleLocalGraph"),
          run: () => toggleRightView("graph"),
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
          id: "shell.bookmarks",
          title: t("shell.showBookmarks"),
          run: () => {
            revealSidebar();
            showSidebarView("bookmarks");
          },
        },
        {
          id: "shell.tags",
          title: t("shell.showTags"),
          run: () => {
            revealSidebar();
            showSidebarView("tags");
          },
        },
        {
          id: "shell.drafts",
          title: t("shell.showDrafts"),
          run: () => {
            revealSidebar();
            showSidebarView("drafts");
          },
        },
        {
          id: "shell.trash",
          title: t("shell.showTrash"),
          run: () => {
            revealSidebar();
            showSidebarView("trash");
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
      leftShortcut,
      rightShortcut,
      toolbarShortcut,
    ]),
  );

  return (
    // The background stays: the window is transparent, it would show the
    // desktop. What stands on it fades in.
    <div
      className={`flex h-dvh flex-col overflow-hidden bg-bg text-ui text-fg *:transition-opacity *:duration-200 *:ease-out motion-reduce:*:transition-none ${
        shown ? "" : "*:opacity-0"
      }`}
    >
      <AppMark />
      <WindowControls
        frame={frame}
        dev={
          DevButton !== null ? (
            <Suspense fallback={null}>
              <DevButton
                vault={vault}
                panelOpen={devOpen}
                onTogglePanel={() => setDevOpen((open) => !open)}
              />
            </Suspense>
          ) : undefined
        }
        notifications={
          vault !== null && !showDev ? <NotificationsButton /> : undefined
        }
        panels={
          vault !== null && !showDev ? (
            <>
              <PanelToggle
                side="left"
                open={!sidebar.collapsed}
                shortcut={leftShortcut}
                onToggle={toggleSidebar}
              />
              <PanelToggle
                side="right"
                open={rightPanel.open}
                shortcut={rightShortcut}
                onToggle={toggleRightPanel}
              />
            </>
          ) : undefined
        }
      />
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
              {/* While the vault left open at the last start is opened
                  again, nothing: the start screen would only flash. */}
              {!restoring && <StartScreen />}
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
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <NoteArea
                vault={vault}
                right={rightPanel}
                startWidth={`calc(${toolbarWidth} + ${
                  sidebar.collapsed ? "0px" : sidebarWidth
                })`}
                startFraction={startFraction}
                start={
                  <>
                    <ToolbarHost
                      open={toolbarOpen}
                      sidebarOpen={!sidebar.collapsed}
                      sidebarView={sidebarView}
                      revealSidebar={revealSidebar}
                      toggleSidebar={toggleSidebar}
                    />
                    <Sidebar
                      open={!sidebar.collapsed}
                      fraction={sidebar.fraction}
                      width={sidebarWidth}
                      room={sidebarRoom}
                      onResize={sidebar.resize}
                      onNudge={sidebar.nudge}
                      onClose={sidebar.close}
                    >
                      <SidebarContent
                        vault={vault}
                        view={sidebarView}
                        reveal={revealSidebar}
                        showInFileManager={showInFileManager}
                      />
                    </Sidebar>
                  </>
                }
              />
            </main>
            <QuickSwitcherHost vault={vault} />
            <SearchHost vault={vault} />
            <NewNoteHost vault={vault} />
            <StartupHost vault={vault} />
          </WorkspaceProvider>
        )}
      </div>
      {/* Not on the start screen: there a vault is opened or made. */}
      {vault !== null && (
        <>
          <CommandPaletteHost />
          <SettingsOpener />
        </>
      )}
    </div>
  );
}

/**
 * The views of the sidebar: files, bookmarks, tags, drafts and trash, one at a time,
 * each shown by its button of the toolbar or from the palette; there is
 * no row of tabs. They stay mounted: switching keeps the open folders and
 * the open tags. Search is a dialog of its own (`SearchHost`).
 */
function SidebarContent({
  vault,
  view: { view, show },
  reveal,
  showInFileManager,
}: {
  vault: Vault;
  view: SidebarViewState;
  /** Opens the sidebar if it is shut. */
  reveal: () => void;
  showInFileManager?: (path: string) => Promise<void>;
}) {
  const t = useT();
  const tags = useTags(vault, view === "tags");
  const trash = useTrash(vault, view === "trash");
  const bookmarks = useBookmarks(vault);
  useBookmarkCommand(bookmarks);
  const { open, path: activePath } = useWorkspace();
  // For what the file tree starts from elsewhere, such as "New note" from
  // the palette: its name field must be where it can be typed in.
  const showFiles = useCallback(() => {
    reveal();
    show("files");
  }, [reveal, show]);
  const showDrafts = useCallback(() => {
    reveal();
    show("drafts");
  }, [reveal, show]);
  return (
    <div className="flex h-full flex-col">
      <div
        role="region"
        aria-label={t("shell.files")}
        className={view === "files" ? "min-h-0 flex-1" : "hidden"}
      >
        <FileTree
          vault={vault}
          bookmarks={bookmarks}
          onReveal={showFiles}
          showInFileManager={showInFileManager}
        />
      </div>
      <div
        role="region"
        aria-label={t("shell.bookmarks")}
        className={view === "bookmarks" ? "min-h-0 flex-1" : "hidden"}
      >
        <BookmarksPanel
          bookmarks={bookmarks}
          activePath={activePath}
          onOpen={(path, newTab) =>
            open(path, { target: newTab ? "newTab" : "here" })
          }
        />
      </div>
      <div
        role="region"
        aria-label={t("shell.tags")}
        className={view === "tags" ? "min-h-0 flex-1" : "hidden"}
      >
        <TagsPanel
          tags={tags}
          onOpen={(path, newTab) =>
            open(path, { target: newTab ? "newTab" : "here" })
          }
        />
      </div>
      <div
        role="region"
        aria-label={t("shell.drafts")}
        className={view === "drafts" ? "min-h-0 flex-1" : "hidden"}
      >
        <FileTree
          vault={vault}
          scope="drafts"
          bookmarks={bookmarks}
          onReveal={showDrafts}
          showInFileManager={showInFileManager}
        />
      </div>
      <div
        role="region"
        aria-label={t("shell.trash")}
        className={view === "trash" ? "min-h-0 flex-1" : "hidden"}
      >
        <TrashPanel vault={vault} trash={trash} />
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
  if (vault.watching && index.state !== "failed" && !indexing && !SHOW_TIMING) {
    return null;
  }
  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-line px-3 py-2 text-small text-faint">
      {!vault.watching && (
        <p className="text-danger">{t("shell.notWatching")}</p>
      )}
      <IndexState vault={vault} />
      {SHOW_TIMING && <IndexTiming status={index} />}
    </div>
  );
}

/**
 * Whether the sidebar shows how long the startup scan took: in a build
 * made with `VITE_CARBON_TIMING=1`, to measure a release build against
 * the budgets (C-602). A dev build shows it in the dev tools instead.
 */
const SHOW_TIMING =
  !import.meta.env.DEV && import.meta.env.VITE_CARBON_TIMING === "1";

/**
 * The toolbar at the left edge: files, tags and drafts, which show in the
 * sidebar and hide it when it shows them already, and a few commands, the
 * search dialog first; at the foot
 * the settings and the menu of the vault.
 */
function ToolbarHost({
  open,
  sidebarOpen,
  sidebarView: { view, show },
  revealSidebar,
  toggleSidebar,
}: {
  open: boolean;
  sidebarOpen: boolean;
  sidebarView: SidebarViewState;
  revealSidebar: () => void;
  toggleSidebar: () => void;
}) {
  const t = useT();
  const all = useCommandList();
  const command = (id: string, icon: ReactNode): ToolbarItem[] => {
    const found = all.find((c) => c.id === id);
    return found === undefined
      ? []
      : [
          {
            id,
            label: found.title,
            shortcut: found.shortcut,
            icon,
            run: found.run,
          },
        ];
  };
  const sidebarItem = (
    which: SidebarViewState["view"],
    label: string,
    icon: ReactNode,
    shortcut?: string,
  ): ToolbarItem => {
    const shown = sidebarOpen && view === which;
    return {
      id: `sidebar.${which}`,
      label,
      shortcut,
      pressed: shown,
      icon,
      run: () => {
        if (shown) {
          toggleSidebar();
          return;
        }
        revealSidebar();
        show(which);
      },
    };
  };
  return (
    <Toolbar
      open={open}
      items={[
        sidebarItem("files", t("shell.files"), toolbarIcons.files),
        sidebarItem("bookmarks", t("shell.bookmarks"), toolbarIcons.bookmarks),
        ...command(OPEN_SEARCH, toolbarIcons.search),
        sidebarItem("tags", t("shell.tags"), toolbarIcons.tags),
        sidebarItem("drafts", t("shell.drafts"), toolbarIcons.drafts),
        ...command("switcher.open", toolbarIcons.note),
        ...command(OPEN_RANDOM_NOTE, toolbarIcons.randomNote),
        ...command(TOGGLE_GRAPH, toolbarIcons.graph),
        ...command(OPEN_PALETTE, toolbarIcons.commands),
      ]}
      footer={[
        sidebarItem("trash", t("shell.trash"), toolbarIcons.trash),
        ...command("settings.open", toolbarIcons.settings),
      ]}
      footerEnd={<VaultMenu />}
    />
  );
}

/** The command palette, shown while it is open (Ctrl+P). */
function CommandPaletteHost() {
  const palette = useCommandPalette();
  return palette.isOpen ? <CommandPalette palette={palette} /> : null;
}

/** The "New note" dialog, shown while it is open (Ctrl+N). */
function NewNoteHost({ vault }: { vault: Vault }) {
  const newNote = useNewNote(vault);
  return newNote.isOpen ? <NewNoteDialog newNote={newNote} /> : null;
}

/**
 * The search dialog, shown while it is open (Ctrl+Shift+F). The hook stays
 * mounted, for its shortcut and command and to keep the last query.
 */
function SearchHost({ vault }: { vault: Vault }) {
  const search = useSearch(vault);
  return search.isOpen ? <SearchDialog search={search} /> : null;
}

/** The quick switcher, shown while it is open (Ctrl+O). */
function QuickSwitcherHost({ vault }: { vault: Vault }) {
  const switcher = useQuickSwitcher(vault);
  return switcher.isOpen ? <QuickSwitcher switcher={switcher} /> : null;
}

interface NoteAreaProps {
  vault: Vault;
  /** The panel beside the note: its outline and the notes that link to it. */
  right: RightPanel;
  /**
   * What stands at the left, below the top row: the toolbar and the
   * sidebar. The top row of the first pane runs on above them, from the
   * mark in the corner.
   */
  start: ReactNode;
  /** How wide `start` is now, as a CSS length. */
  startWidth: string;
  /** How wide `start` is now, as a share of the window width. */
  startFraction: () => number;
}

/**
 * The main area of the workspace: the tabs, the note that is shown and,
 * beside it, the panels that are open: the outline of the note and its
 * backlinks, one above the other. The toolbar and the sidebar stand at the
 * left of the first pane, below its tabs.
 */
function NoteArea({
  vault,
  right,
  start,
  startWidth,
  startFraction,
}: NoteAreaProps) {
  const workspace = useWorkspace();
  const t = useT();
  useWorkspaceShortcuts();
  useRandomNote(vault);
  const noteMode = useNoteMode();
  const outline = useOutline();
  const graph = useGraphView();
  const { path, open } = workspace;
  const { close: closeGraph } = graph;
  // A note opened from anywhere, the graph or the sidebar, takes the
  // place of the graph.
  const [graphFor, setGraphFor] = useState(path);
  if (graphFor !== path) {
    setGraphFor(path);
    if (graph.open) closeGraph();
  }
  const openFromGraph = useCallback(
    (note: string, newTab: boolean) => {
      open(note, { target: newTab ? "newTab" : "here" });
      closeGraph();
    },
    [open, closeGraph],
  );
  /** The edge of the right panel is being dragged: it does not glide. */
  const [resizingRight, setResizingRight] = useState(false);
  /**
   * How wide the right panel is open: as wide as it was made, but never
   * over what stands at the left, with the narrowest notes between, such
   * as the sidebar opened wide while it was shut, or a window made
   * narrower.
   */
  const rightWidth = panelWidth(right.width.fraction, startWidth);
  const rightRoom = useCallback(
    () => 1 - startFraction() - noteMinFraction(),
    [startFraction],
  );

  const rightPanel = (
    <SlidePanel
      open={right.open}
      side="right"
      // As the sidebar: at its narrowest its edge meets the buttons in
      // the corner above it.
      width={rightWidth}
      animate={!resizingRight}
      keepMounted={false}
    >
      <RightPanelContent
        width={right.width}
        onResizing={setResizingRight}
        onClose={right.close}
        room={rightRoom}
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
  );

  // No note open, or the graph shown: one column, the watermark or the
  // graph in place of the notes.
  const panes = path === null || graph.open ? [] : workspace.panes;
  const split = panes.length > 1;
  const last = panes.length - 1;

  /**
   * A column of the note area: its top row and below it its note. The
   * first holds the sidebar too, at the same place whether a note is open
   * or not, so it keeps its state.
   */
  const column = (
    key: number,
    index: number,
    header: ReactNode,
    body: ReactNode,
  ) => (
    <div
      // The first by its place: the sidebar in it stays mounted.
      key={index === 0 ? "first" : key}
      className={`flex min-w-0 flex-col ${
        index > 0 ? "border-l border-line" : ""
      } ${
        split
          ? "transition-[flex-basis] duration-200 ease-out motion-reduce:transition-none"
          : ""
      }`}
      // The first column holds the sidebar too: it starts as wide as that,
      // and the room left is shared alike, so the notes of the panes are as
      // wide as each other.
      style={{ flex: index === 0 ? `1 1 ${startWidth}` : "1 1 0" }}
    >
      {header}
      {index === 0 ? (
        <div className="flex min-h-0 flex-1">
          {start}
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  );

  // In the place of the watermark, so the sidebar in it keeps its state.
  const graphColumn = graph.open
    ? column(
        0,
        0,
        <TabBar
          tabs={[{ id: 0, label: t("graph.title"), title: t("graph.title") }]}
          activeId={0}
          onActivate={() => {}}
          onClose={closeGraph}
          leaveRoomStart
          leaveRoom
        />,
        <section
          aria-label={t("graph.title")}
          className="min-h-0 min-w-0 flex-1"
        >
          <Suspense fallback={null}>
            <GraphView
              vault={vault}
              current={path}
              onOpen={openFromGraph}
              onClose={closeGraph}
            />
          </Suspense>
        </section>,
      )
    : null;

  return (
    <div
      className="flex min-h-0 flex-1"
      // What the right panel covers of the window buttons above it: the
      // top rows of the notes leave room for the rest (WINDOW_CONTROLS_ROOM).
      style={
        {
          "--cb-right-panel-cover": right.open ? rightWidth : "0px",
        } as CSSProperties
      }
    >
      {panes.length === 0
        ? graph.open
          ? graphColumn
          : column(
              0,
              0,
              <DragStrip room roomStart />,
              <div className="min-w-0 flex-1">
                <Watermark label={t("shell.noNoteOpen")} />
              </div>,
            )
        : panes.map((pane, index) => {
            const active = index === workspace.activePane;
            const history = (
              <HistoryButtons
                canGoBack={pane.canGoBack}
                canGoForward={pane.canGoForward}
                onBack={workspace.back}
                onForward={workspace.forward}
              />
            );
            // The pane the user works in is the one keys and the rest
            // of the app act on: its tabs or its note pressed, not the
            // sidebar. On the press, before the click, so back and
            // forward act on it.
            const focus = {
              onMouseDownCapture: () => workspace.focusPane(index),
              onFocusCapture: () => workspace.focusPane(index),
            };
            const body = (
              <section
                aria-label={
                  split ? t("shell.pane", { number: index + 1 }) : undefined
                }
                className="flex min-h-0 min-w-0 flex-1 flex-col"
                {...focus}
              >
                {pane.path !== null && imageTypeOf(pane.path) !== null && (
                  <div className="min-h-0 flex-1">
                    <ImageView
                      key={pane.path}
                      vault={vault}
                      path={pane.path}
                      history={history}
                    />
                  </div>
                )}
                {pane.path !== null && imageTypeOf(pane.path) === null && (
                  <div className="min-h-0 flex-1">
                    <NoteEditor
                      key={pane.path}
                      vault={vault}
                      path={pane.path}
                      history={history}
                      mode={noteMode.mode}
                      onModeChange={noteMode.setMode}
                      // One outline: of the note in the active pane.
                      outline={active ? outline.link : undefined}
                      active={active}
                    />
                  </div>
                )}
              </section>
            );
            return column(
              pane.id,
              index,
              // With two panes, the one not worked in is dimmed.
              <div
                className={split && !active ? "opacity-60" : undefined}
                {...focus}
              >
                <TabBar
                  tabs={pane.tabs.map((tab) => ({
                    id: tab.id,
                    label: nameOf(tab.path).replace(/\.md$/i, ""),
                    title: tab.path,
                  }))}
                  activeId={pane.activeTabId}
                  onActivate={workspace.activateTab}
                  onClose={workspace.closeTab}
                  // The first bar starts at the left edge, under the mark.
                  leaveRoomStart={index === 0}
                  // The right end of the top row holds the window buttons:
                  // what the right panel does not cover of them.
                  leaveRoom={index === last}
                />
              </div>,
              body,
            );
          })}
      {rightPanel}
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
    const reason = errorText(status.error, t);
    return (
      <Tooltip label={reason}>
        <p className="text-danger">{t("shell.indexFailed")}</p>
      </Tooltip>
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

interface RightPanelProps {
  width: PanelWidth;
  /** Told when its edge is dragged and let go. */
  onResizing: (resizing: boolean) => void;
  /** Closes it: its edge dragged near the right edge of the window. */
  onClose: () => void;
  /** The widest it can be now, beside the sidebar (`ResizeHandle`). */
  room: () => number;
  vault: Vault;
  /** The note it is about; `null` while none is open: it is empty then. */
  path: string | null;
  view: RightPanelView;
  onShow: (view: RightPanelView) => void;
  /** The outline of the note, which the note area keeps up to date. */
  outline: ReactNode;
}

/** The panel at the right of the note: empty while no note is open. */
function RightPanelContent(props: RightPanelProps) {
  return props.path === null ? (
    <RightPanelFrame {...props} backlinks={null}>
      {null}
    </RightPanelFrame>
  ) : (
    <RightPanelForNote {...props} path={props.path} />
  );
}

function RightPanelForNote(props: RightPanelProps & { path: string }) {
  const { vault, path, view, outline } = props;
  const backlinks = useBacklinks(vault, path);
  return (
    <RightPanelFrame
      {...props}
      backlinks={
        backlinks.status === "ready" ? backlinks.backlinks.length : null
      }
    >
      {view === "outline" ? (
        outline
      ) : view === "graph" ? (
        <LocalGraphHost vault={vault} path={path} />
      ) : (
        <BacklinksView vault={vault} path={path} backlinks={backlinks} />
      )}
    </RightPanelFrame>
  );
}

/**
 * The right panel laid out as the left one: an empty top row, which drags
 * the window and leaves its buttons room, the tabs of what it can show,
 * and what it shows. The line at its edge starts below the top row, so the
 * row runs on from the one beside it.
 */
function RightPanelFrame({
  width,
  onResizing,
  onClose,
  room,
  view,
  onShow,
  backlinks,
  children,
}: RightPanelProps & {
  /** How many notes link to the note, shown on its tab; `null` if unknown. */
  backlinks: number | null;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <aside
      aria-label={t("shell.rightPanel")}
      className="relative flex h-full flex-col bg-panel"
      // Its own top row leaves the window buttons all their room.
      style={{ "--cb-right-panel-cover": "0px" } as CSSProperties}
    >
      <ResizeHandle
        side="right"
        label={t("shell.resizeRightPanel")}
        fraction={width.fraction}
        onResize={width.resize}
        onNudge={width.nudge}
        onClose={onClose}
        room={room}
        onDragging={onResizing}
      />
      {/* Runs on into the top row beside it, with no line between. */}
      <div
        data-tauri-drag-region
        className={`h-bar shrink-0 border-b border-line ${WINDOW_CONTROLS_ROOM}`}
      />
      <div className="flex min-h-0 flex-1 flex-col border-l border-line">
        <ViewTabs
          label={t("shell.rightPanelViews")}
          views={[
            { view: "outline", label: t("shell.outline") },
            {
              view: "backlinks",
              label: (
                <>
                  {t("shell.backlinks")}
                  {backlinks !== null && (
                    // A space, not a gap: the name and the count are cut
                    // short together, as one line of text.
                    <span className="ml-1.5 text-faint">{backlinks}</span>
                  )}
                </>
              ),
            },
            { view: "graph", label: t("shell.graph") },
          ]}
          current={view}
          onShow={onShow}
        />
        <div
          role="tabpanel"
          // The graph fills the panel and moves within it: no scrolling.
          className={`min-h-0 flex-1 ${
            view === "graph" ? "overflow-hidden" : "overflow-auto"
          }`}
        >
          {children}
        </div>
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

/**
 * The graph around the note (C-504). A click opens a note in the tab, and
 * the graph then follows it; with Ctrl or Cmd, in a new tab.
 */
function LocalGraphHost({ vault, path }: { vault: Vault; path: string }) {
  const { open } = useWorkspace();
  const onOpen = useCallback(
    (note: string, newTab: boolean) =>
      open(note, { target: newTab ? "newTab" : "here" }),
    [open],
  );
  return (
    <Suspense fallback={null}>
      <LocalGraphView vault={vault} path={path} onOpen={onOpen} />
    </Suspense>
  );
}

/** The commands offered below the watermark, in this order. */
const WATERMARK_COMMANDS = [
  NEW_NOTE,
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
  // The commands are registered by effects, so the first frame has none:
  // shown then, the mark would stand alone in the middle and jump up as
  // they come in a moment later.
  const ready = commands.length > 0;
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-8 px-8 ${
        ready ? "" : "invisible"
      }`}
    >
      <CarbonMark shadow className="h-auto w-[min(15rem,50%)] text-line" />
      <span className="sr-only">{label}</span>
      {ready && (
        <ul className="flex w-full max-w-72 flex-col gap-1.5">
          {commands.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-1 text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
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

/** The folder name of a vault: the last part of its path. */
function nameOf(root: string): string {
  return root.slice(root.lastIndexOf("/") + 1);
}
