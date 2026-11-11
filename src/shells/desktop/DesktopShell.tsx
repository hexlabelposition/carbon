import { lazy, Suspense, useState } from "react";
import { FileTree } from "../../features/file-tree/FileTree";
import { useAppSettings } from "../../features/settings/app-settings";
import { StartScreen } from "../../features/start/StartScreen";
import { useVaultSession } from "../../features/vault/vault-session";
import { useActiveNote } from "../../features/workspace/active-note";
import { ActiveNoteProvider } from "../../features/workspace/ActiveNoteProvider";
import { Sidebar } from "./Sidebar";
import { StatusBar, StatusButton } from "./StatusBar";
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
          <ActiveNoteProvider
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
            <main className="min-w-0 flex-1 overflow-auto">
              <NoteArea />
            </main>
          </ActiveNoteProvider>
        )}
      </div>

      <StatusBar
        actions={
          DevPanel !== null && (
            <StatusButton
              pressed={devOpen}
              onClick={() => setDevOpen(!devOpen)}
            >
              Dev panel
            </StatusButton>
          )
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
          </>
        )}
      </StatusBar>
    </div>
  );
}

/** The editor is mounted here in C-113. */
function NoteArea() {
  const { path } = useActiveNote();
  return (
    <Placeholder>
      {path === null
        ? "No note is open."
        : `${path} is open. The editor will be here.`}
    </Placeholder>
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
