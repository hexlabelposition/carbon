import { Vault, type TreeNode } from "@carbon/core";
import { useState } from "react";
import { pickVaultFolder, tauriPlatform } from "./platform";

const WRITE_CHECK_FILE = "carbon-write-check.md";
const OPERATIONS_CHECK_FOLDER = "carbon-operations-check";

/**
 * Temporary M0 check: reads a real file through `@carbon/core` and the Tauri
 * adapters. It goes away with the rest of this preview in M1 (C-110).
 */
export function VaultCheck() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [path, setPath] = useState("README.md");
  const [output, setOutput] = useState("");
  const [changes, setChanges] = useState<string[]>([]);

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
      setChanges([]);
      opened.on("changed", ({ kind, path }) => {
        const time = new Date().toLocaleTimeString();
        setChanges((list) =>
          [`${time}  ${kind}  ${path}`, ...list].slice(0, 50),
        );
      });
      const start = performance.now();
      const tree = await opened.tree();
      const ms = Math.round(performance.now() - start);
      const { folders, notes, files } = count(tree);
      return (
        `Opened ${opened.root}, watching: ${opened.watching ? "yes" : "NO"}\n` +
        `Tree in ${ms} ms: ${folders} folders, ${notes} notes, ${files} other files\n\n` +
        outline(tree).slice(0, 40).join("\n")
      );
    });

  const readNote = () =>
    run(async () => {
      if (!vault) return "Open a vault first";
      return vault.notes.read(path);
    });

  /** Writes one fixed file, so the check cannot damage real notes. */
  const writeNote = () =>
    run(async () => {
      if (!vault) return "Open a vault first";
      const text = `# Carbon write check\n\nWritten at ${new Date().toISOString()}\n`;
      await vault.notes.write(WRITE_CHECK_FILE, text);
      const readBack = await vault.notes.read(WRITE_CHECK_FILE);
      const same = readBack === text ? "the same text" : "DIFFERENT text";
      return `Wrote ${WRITE_CHECK_FILE}, read back ${same}\n\n${readBack}`;
    });

  /**
   * Creates, renames, moves and deletes inside one folder of its own. If
   * that folder already exists the check stops before touching anything.
   */
  const runOperations = () =>
    run(async () => {
      if (!vault) return "Open a vault first";
      const dir = OPERATIONS_CHECK_FOLDER;
      const log: string[] = [];
      const step = async (name: string, action: () => Promise<unknown>) => {
        await action();
        log.push(`ok  ${name}`);
      };
      const fails = async (name: string, action: () => Promise<unknown>) => {
        const failed = await action().then(
          () => false,
          () => true,
        );
        log.push(`${failed ? "ok " : "BAD"} ${name}`);
      };
      try {
        await step("create folder", () => vault.folders.create(dir));
        await step("create note with new subfolder", () =>
          vault.notes.create(`${dir}/a/One.md`, "one"),
        );
        await step("create second note", () =>
          vault.notes.create(`${dir}/Two.md`, "two"),
        );
        await fails("create over an existing note is rejected", () =>
          vault.notes.create(`${dir}/Two.md`),
        );
        await step("rename note", () =>
          vault.notes.rename(`${dir}/Two.md`, `${dir}/Three.md`),
        );
        await step("rename note, case only", () =>
          vault.notes.rename(`${dir}/Three.md`, `${dir}/THREE.md`),
        );
        await step("move note into a folder", () =>
          vault.notes.rename(`${dir}/THREE.md`, `${dir}/a/THREE.md`),
        );
        await fails("rename over an existing note is rejected", () =>
          vault.notes.rename(`${dir}/a/One.md`, `${dir}/a/THREE.md`),
        );
        await step("rename folder", () =>
          vault.folders.rename(`${dir}/a`, `${dir}/b`),
        );
        await step("read moved note", async () => {
          const text = await vault.notes.read(`${dir}/b/THREE.md`);
          if (text !== "two") throw new Error(`Unexpected text: ${text}`);
        });
        await step("delete note", () => vault.notes.remove(`${dir}/b/One.md`));
        await step("delete folder with contents", () =>
          vault.folders.remove(dir),
        );
        const left = (await vault.tree()).some((n) => n.name === dir);
        log.push(`${left ? "BAD" : "ok "} nothing is left behind`);
      } catch (error) {
        log.push(
          `FAILED: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return log.join("\n");
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
        <button
          type="button"
          className={button}
          disabled={!vault}
          onClick={writeNote}
        >
          Write check file
        </button>
        <button
          type="button"
          className={button}
          disabled={!vault}
          onClick={runOperations}
        >
          Run operations check
        </button>
      </div>
      {vault && (
        <pre className="max-h-40 overflow-auto rounded-md border border-line bg-code px-3 py-2 font-mono text-small whitespace-pre-wrap">
          {changes.length > 0
            ? changes.join("\n")
            : "Outside changes appear here. Edit, add or delete a file in the vault with another program."}
        </pre>
      )}
      {output && (
        <pre className="max-h-60 overflow-auto rounded-md border border-line bg-code px-3 py-2 font-mono text-small whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </section>
  );
}

function count(nodes: TreeNode[]) {
  const total = { folders: 0, notes: 0, files: 0 };
  const visit = (list: TreeNode[]) => {
    for (const node of list) {
      if (node.kind === "folder") {
        total.folders++;
        visit(node.children);
      } else if (node.kind === "note") total.notes++;
      else total.files++;
    }
  };
  visit(nodes);
  return total;
}

function outline(nodes: TreeNode[], indent = ""): string[] {
  return nodes.flatMap((node) =>
    node.kind === "folder"
      ? [`${indent}${node.name}/`, ...outline(node.children, `${indent}  `)]
      : [`${indent}${node.name}`],
  );
}
