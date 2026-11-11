import { AppSettingsProvider } from "./features/settings/AppSettingsProvider";
import { VaultProvider } from "./features/vault/VaultProvider";
import { pickVaultFolder, tauriPlatform } from "./platform";
import { DesktopShell } from "./shells/desktop/DesktopShell";

/**
 * Wires the platform into the features and picks the shell. There is one
 * shell for now (ARCHITECTURE.md, section 8).
 */
function App() {
  return (
    <AppSettingsProvider store={tauriPlatform.settings}>
      <VaultProvider platform={tauriPlatform} pickFolder={pickVaultFolder}>
        <DesktopShell />
      </VaultProvider>
    </AppSettingsProvider>
  );
}

export default App;
