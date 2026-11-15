import { CommandsProvider } from "./features/commands/CommandsProvider";
import { AppSettingsProvider } from "./features/settings/AppSettingsProvider";
import { VaultProvider } from "./features/vault/VaultProvider";
import { ThemeSwitch } from "./features/theme/ThemeSwitch";
import { InterfaceZoom } from "./features/zoom/InterfaceZoom";
import {
  pickVaultFolder,
  setInterfaceZoom,
  tauriPlatform,
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
    <AppSettingsProvider store={tauriPlatform.settings}>
      <VaultProvider platform={platform} pickFolder={pickVaultFolder}>
        <CommandsProvider>
          <InterfaceZoom apply={setInterfaceZoom} />
          <ThemeSwitch />
          <DesktopShell frame={tauriWindow} />
        </CommandsProvider>
      </VaultProvider>
    </AppSettingsProvider>
  );
}

export default App;
