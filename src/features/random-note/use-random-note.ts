import type { NotePath, TreeNode, Vault } from "@carbon/core";
import { useCallback, useMemo } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";

/** The command that opens a random note, offered in the toolbar. */
export const OPEN_RANDOM_NOTE = "randomNote.open";

/**
 * Offers "Open a random note": any note of the vault but the one shown,
 * in the active tab. Nothing happens in a vault with no other note.
 */
export function useRandomNote(vault: Vault): void {
  const t = useT();
  const { open, path: current } = useWorkspace();

  const openRandom = useCallback(async () => {
    // Listed once while the vault is watched, so a press costs little.
    const notes = notesOf(await vault.tree()).filter(
      (note) => note !== current,
    );
    if (notes.length === 0) return;
    open(notes[Math.floor(Math.random() * notes.length)]);
  }, [vault, open, current]);

  useCommands(
    useMemo(
      () => [
        {
          id: OPEN_RANDOM_NOTE,
          title: t("randomNote.open"),
          run: () => {
            openRandom().catch((reason: unknown) =>
              console.error("Could not open a random note", reason),
            );
          },
        },
      ],
      [t, openRandom],
    ),
  );
}

/** Every note in `nodes` and the folders below them. */
function notesOf(nodes: readonly TreeNode[]): NotePath[] {
  const notes: NotePath[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      if (node.kind === "folder") walk(node.children);
      else if (node.kind === "note") notes.push(node.path);
    }
  };
  walk(nodes);
  return notes;
}
