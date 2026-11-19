import { CommandsProvider } from "./features/commands/CommandsProvider";
import { AppSettingsProvider } from "./features/settings/AppSettingsProvider";
import { Settings } from "./features/settings/Settings";
import { VaultProvider } from "./features/vault/VaultProvider";
import { TooltipProvider } from "./features/ui/Tooltip";
import { ThemeSwitch } from "./features/theme/ThemeSwitch";
import { InterfaceZoom } from "./features/zoom/InterfaceZoom";
import {
  pickVaultFolder,
  setInterfaceZoom,
  showInFileManager,
  tauriPlatform,
  tauriWindow,
} from "./platform";
import { DesktopShell } from "./shells/desktop/DesktopShell";
import { createWorkerParser } from "./workers/worker-parser";

/** The Tauri platform, with notes parsed in a worker. */
const platform = { ...tauriPlatform, parser: createWorkerParser() };

/**
 * The window starts hidden and shows once the interface has its zoom, so
 * the first frame is not drawn at 100% and then scaled.
 */
function showWindow() {
  tauriWindow
    .show()
    .catch((reason: unknown) =>
      console.error("Could not show the window", reason),
    );
}

/**
 * Wires the platform into the features and picks the shell. There is one
 * shell for now (ARCHITECTURE.md, section 8).
 */
function App() {
  return (
    <TooltipProvider>
      <AppSettingsProvider store={tauriPlatform.settings}>
        <VaultProvider platform={platform} pickFolder={pickVaultFolder}>
          <CommandsProvider>
            <InterfaceZoom
              apply={setInterfaceZoom}
              onFirstApplied={showWindow}
            />
            <ThemeSwitch />
            <Settings />
            <DesktopShell
              frame={tauriWindow}
              showInFileManager={showInFileManager}
            />
          </CommandsProvider>
        </VaultProvider>
      </AppSettingsProvider>
    </TooltipProvider>
  );
}

export default App;
