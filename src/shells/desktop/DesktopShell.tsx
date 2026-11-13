import type { Vault } from "@carbon/core";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { BacklinksPanel } from "../../features/backlinks/BacklinksPanel";
import { useBacklinks } from "../../features/backlinks/use-backlinks";
import { NoteEditor } from "../../features/editor/NoteEditor";
import { useSourceMode } from "../../features/editor/use-source-mode";
import { FileTree } from "../../features/file-tree/FileTree";
import { OutlinePanel } from "../../features/outline/OutlinePanel";
import { useOutline } from "../../features/outline/use-outline";
import { useAppSettings } from "../../features/settings/app-settings";
import { StartScreen } from "../../features/start/StartScreen";
import { useIndexStatus } from "../../features/vault/use-index-status";
import { useVaultSession } from "../../features/vault/vault-session";
import { useWorkspaceShortcuts } from "../../features/workspace/use-workspace-shortcuts";
import { useWorkspace } from "../../features/workspace/workspace";
import { WorkspaceProvider } from "../../features/workspace/WorkspaceProvider";
import { Sidebar } from "./Sidebar";
import { StatusBar, StatusButton } from "./StatusBar";
import { TabBar } from "./TabBar";
import { useFileDropGuard } from "./use-file-drop-guard";
import { useSidePanel } from "./use-side-panel";
import { useSidebar } from "./use-sidebar";

// Dev builds only: in a release build the condition is false at build time
// and the panel is not bundled.
const DevPanel = import.meta.env.DEV
  ? lazy(() => import("../../dev/DevPanel"))
  : null;

/**
 * The desktop layout: sidebar, main area, status bar. It decides which
 * features are mounted and where; what they do lives in their hooks
 * (ARCHITECTURE.md, section 8).
 */
export function DesktopShell() {
  const { vault, close } = useVaultSession();
  const { recentVaults } = useAppSettings();
  const sidebar = useSidebar();
  const outlinePanel = useSidePanel("carbon.desktop.outline");
  const backlinksPanel = useSidePanel("carbon.desktop.backlinks");
  useFileDropGuard();
  const [devOpen, setDevOpen] = useState(false);

  const showDev = devOpen && DevPanel !== null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-ui text-fg">
      <div className="flex min-h-0 flex-1">
        {showDev ? (
          <div className="min-w-0 flex-1 overflow-auto">
            <Suspense fallback={null}>
              <DevPanel />
            </Suspense>
          </div>
        ) : vault === null ? (
          <main className="min-w-0 flex-1 overflow-auto">
            <StartScreen />
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
            {!sidebar.collapsed && (
              <Sidebar
                fraction={sidebar.fraction}
                onResize={sidebar.resize}
                onNudge={sidebar.nudge}
                header={
                  <>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {nameOf(vault.root)}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-sm px-1.5 text-small text-muted hover:bg-raise hover:text-fg"
                      onClick={close}
                    >
                      Close vault
                    </button>
                  </>
                }
              >
                <FileTree vault={vault} />
              </Sidebar>
            )}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <NoteArea
                vault={vault}
                outlineOpen={outlinePanel.open}
                backlinksOpen={backlinksPanel.open}
              />
            </main>
          </WorkspaceProvider>
        )}
      </div>

      <StatusBar
        actions={
          <>
            {vault !== null && !showDev && (
              <StatusButton
                pressed={outlinePanel.open}
                onClick={outlinePanel.toggle}
              >
                Outline
              </StatusButton>
            )}
            {vault !== null && !showDev && (
              <StatusButton
                pressed={backlinksPanel.open}
                onClick={backlinksPanel.toggle}
              >
                Backlinks
              </StatusButton>
            )}
            {DevPanel !== null && (
              <StatusButton
                pressed={devOpen}
                onClick={() => setDevOpen(!devOpen)}
              >
                Dev panel
              </StatusButton>
            )}
          </>
        }
      >
        {vault !== null && !showDev && (
          <StatusButton pressed={!sidebar.collapsed} onClick={sidebar.toggle}>
            Sidebar
          </StatusButton>
        )}
        {vault === null ? (
          <span>No vault is open</span>
        ) : (
          <>
            <span className="truncate" title={vault.root}>
              {vault.root}
            </span>
            {!vault.watching && (
              <span className="shrink-0 text-danger">
                Changes made by other programs are not noticed
              </span>
            )}
            <IndexState vault={vault} />
          </>
        )}
      </StatusBar>
    </div>
  );
}

interface NoteAreaProps {
  vault: Vault;
  /** Shows the outline of the note beside it. */
  outlineOpen: boolean;
  /** Shows the notes that link to the note beside it. */
  backlinksOpen: boolean;
}

/**
 * The main area of the workspace: the tabs, the note that is shown and,
 * beside it, the panels that are open: the outline of the note and its
 * backlinks, one above the other.
 */
function NoteArea({ vault, outlineOpen, backlinksOpen }: NoteAreaProps) {
  const workspace = useWorkspace();
  useWorkspaceShortcuts();
  const sourceMode = useSourceMode();
  const outline = useOutline();
  const { path } = workspace;

  if (path === null) return <Placeholder>No note is open.</Placeholder>;
  const split = workspace.panes.length > 1;
  return (
    <div className="flex min-h-0 flex-1">
      {workspace.panes.map((pane, index) => {
        const active = index === workspace.activePane;
        return (
          <section
            key={pane.id}
            aria-label={split ? `Pane ${index + 1}` : undefined}
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
              />
            </div>
            {pane.path !== null && (
              <div className="min-h-0 flex-1">
                <NoteEditor
                  key={pane.path}
                  vault={vault}
                  path={pane.path}
                  sourceMode={sourceMode.on}
                  onToggleSourceMode={sourceMode.toggle}
                  // One outline: of the note in the active pane.
                  outline={active ? outline.link : undefined}
                />
              </div>
            )}
          </section>
        );
      })}
      {(outlineOpen || backlinksOpen) && (
        <div className="flex w-64 shrink-0 flex-col border-l border-line bg-panel">
          {outlineOpen && (
            <SidePanel title="Outline">
              <OutlinePanel
                headings={outline.headings}
                current={outline.current}
                onReveal={outline.reveal}
              />
            </SidePanel>
          )}
          {backlinksOpen && <BacklinksSection vault={vault} path={path} />}
        </div>
      )}
    </div>
  );
}

/**
 * What the index is doing, while it is not ready: how far the startup scan
 * is, or that links and backlinks do not work without it. Nothing once it
 * is ready.
 */
function IndexState({ vault }: { vault: Vault }) {
  const status = useIndexStatus(vault);
  if (status.state === "ready") return null;
  if (status.state === "failed") {
    const reason =
      status.error instanceof Error
        ? status.error.message
        : String(status.error);
    return (
      <span className="shrink-0 text-danger" title={reason}>
        The index is not available: links and backlinks do not work
      </span>
    );
  }
  const { done, total } = status;
  // Nothing changed since the last start: ready a moment later.
  if (total === 0) return null;
  return (
    <span role="status" className="shrink-0">
      {total === null
        ? "Indexing…"
        : `Indexing ${done.toLocaleString()} of ${total.toLocaleString()} notes`}
    </span>
  );
}

/** One panel of the column beside the note; open panels share its height. */
function SidePanel({
  title,
  detail,
  children,
}: {
  title: string;
  /** Shown after the title, such as a count. */
  detail?: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="flex min-h-0 flex-1 flex-col border-b border-line last:border-b-0"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="font-semibold">{title}</span>
        {detail !== undefined && (
          <span className="text-small text-faint">{detail}</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  );
}

function BacklinksSection({ vault, path }: { vault: Vault; path: string }) {
  const backlinks = useBacklinks(vault, path);
  const { open } = useWorkspace();
  return (
    <SidePanel
      title="Backlinks"
      detail={
        backlinks.status === "ready"
          ? String(backlinks.backlinks.length)
          : undefined
      }
    >
      <BacklinksPanel
        state={backlinks}
        onOpen={(note, at) => open(note, { at })}
      />
    </SidePanel>
  );
}

function Placeholder({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-faint">
      {children}
    </div>
  );
}

/** The folder name of a vault: the last part of its path. */
function nameOf(root: string): string {
  return root.slice(root.lastIndexOf("/") + 1);
}
