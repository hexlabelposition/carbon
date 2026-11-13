import type { NotePath, TreeNode, Vault } from "@carbon/core";
import { useMemo } from "react";
import { useWorkspace } from "../workspace/workspace";
import type { LinkHost } from "./link-completion";

/**
 * What the editor of one note needs to suggest links to other notes, and
 * to open the notes its links point to.
 */
export function useNoteLinks(vault: Vault, path: NotePath): LinkHost {
  const { open } = useWorkspace();
  return useMemo(
    () => ({
      // The tree is listed once and reused while nothing changes.
      notes: async () => notesIn(await vault.tree()),
      current: path,
      follow: (link, options) => {
        // The index can take a moment during the startup scan: the note
        // opens once it is found. A missing note opens nothing yet (C-223).
        vault.links
          .resolve(path, link)
          .then((target) => {
            if (target !== null) open(target, options);
          })
          .catch(() => {
            // Without an index there is nothing to find the note by.
          });
      },
    }),
    [vault, path, open],
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
