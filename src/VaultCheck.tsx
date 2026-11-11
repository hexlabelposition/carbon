import { Vault } from "@carbon/core";
import { useState } from "react";
import { pickVaultFolder, tauriPlatform } from "./platform";

/**
 * Temporary M0 check: reads a real file through `@carbon/core` and the Tauri
 * adapters. It goes away with the rest of this preview in M1 (C-110).
 */
export function VaultCheck() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [path, setPath] = useState("README.md");
  const [output, setOutput] = useState("");

  async function run(action: () => Promise<string>) {
    try {
      setOutput(await action());
    } catch (error) {
      setOutput(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const openVault = () =>
    run(async () => {
      const root = await pickVaultFolder();
      if (root === null) return output;
      const opened = await Vault.open(root, tauriPlatform);
      vault?.close();
      setVault(opened);
      return `Opened ${opened.root}`;
    });

  const readNote = () =>
    run(async () => {
      if (!vault) return "Open a vault first";
      return vault.notes.read(path);
    });

  const button =
    "h-[26px] rounded-sm border border-line-strong bg-panel px-3 disabled:text-faint";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
        Vault check
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} onClick={openVault}>
          Open vault
        </button>
        <input
          aria-label="Note path, relative to the vault"
          className="h-6.5 min-w-0 flex-1 rounded-sm border border-line bg-bg px-2 font-mono text-small"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <button
          type="button"
          className={button}
          disabled={!vault}
          onClick={readNote}
        >
          Read note
        </button>
      </div>
      {output && (
        <pre className="max-h-60 overflow-auto rounded-md border border-line bg-code px-3 py-2 font-mono text-small whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </section>
  );
}
