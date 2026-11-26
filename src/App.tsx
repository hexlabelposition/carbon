import { CommandsProvider } from "./features/commands/CommandsProvider";
import { AppSettingsProvider } from "./features/settings/AppSettingsProvider";
import { Settings } from "./features/settings/Settings";
import { VaultProvider } from "./features/vault/VaultProvider";
import { TooltipProvider } from "./features/ui/Tooltip";
import { ThemeSwitch } from "./features/theme/ThemeSwitch";
import { InterfaceZoom } from "./features/zoom/InterfaceZoom";
import { Updates } from "./features/updates/Updates";
import { ClipboardContext } from "./features/editor/clipboard";
import {
  openLogFolder,
  openWebPage,
  pickVaultFolder,
  appCacheFolder,
  setInterfaceZoom,
  showInFileManager,
  tauriClipboard,
  tauriPlatform,
  tauriUpdater,
  tauriWindow,
} from "./platform";
import { DesktopShell } from "./shells/desktop/DesktopShell";
import { createWorkerParser } from "./workers/worker-parser";

/** The Tauri platform, with notes parsed in a worker. */
const platform = { ...tauriPlatform, parser: createWorkerParser() };

/**
 * Wires the platform into the features and picks the shell. There is one
 * shell for now (ARCHITECTURE.md, section 8).
 */
function App() {
  return (
    <TooltipProvider>
      <ClipboardContext value={tauriClipboard}>
        <AppSettingsProvider store={tauriPlatform.settings}>
          <VaultProvider
            platform={platform}
            pickFolder={pickVaultFolder}
            cacheFolder={appCacheFolder}
          >
            <CommandsProvider>
              <InterfaceZoom apply={setInterfaceZoom} />
              <ThemeSwitch />
              <Settings
                openLogFolder={openLogFolder}
                openWebPage={openWebPage}
              />
              <Updates updater={tauriUpdater} dev={import.meta.env.DEV} />
              <DesktopShell
                frame={tauriWindow}
                showInFileManager={showInFileManager}
              />
            </CommandsProvider>
          </VaultProvider>
        </AppSettingsProvider>
      </ClipboardContext>
    </TooltipProvider>
  );
}

export default App;
