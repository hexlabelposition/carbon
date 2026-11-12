import type { NotePath, TreeNode, Vault } from "@carbon/core";
import { useMemo } from "react";
import type { LinkHost } from "./link-completion";

/** What the editor of one note needs to suggest links to other notes. */
export function useNoteLinks(vault: Vault, path: NotePath): LinkHost {
  return useMemo(
    () => ({
      // The tree is listed once and reused while nothing changes.
      notes: async () => notesIn(await vault.tree()),
      current: path,
    }),
    [vault, path],
  );
}

function notesIn(tree: readonly TreeNode[]): NotePath[] {
  const notes: NotePath[] = [];
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "folder") walk(node.children);
      else if (node.kind === "note") notes.push(node.path);
    }
  };
  walk(tree);
  return notes;
}
