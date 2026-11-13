import type { NotePath, TreeNode, Vault } from "@carbon/core";
import { useMemo, useState } from "react";
import { useWorkspace } from "../workspace/workspace";
import type { LinkHost } from "./link-completion";

export interface NoteLinks {
  host: LinkHost;
  /** Why the last link that was followed did not open, for the user. */
  error: string | null;
  dismissError(): void;
}

/**
 * What the editor of one note needs to suggest links to other notes, and
 * to open the notes its links point to. A link to a note that does not
 * exist creates it (`vault.links.follow`).
 */
export function useNoteLinks(vault: Vault, path: NotePath): NoteLinks {
  const { open } = useWorkspace();
  const [error, setError] = useState<string | null>(null);

  const host = useMemo<LinkHost>(
    () => ({
      // The tree is listed once and reused while nothing changes.
      notes: async () => notesIn(await vault.tree()),
      current: path,
      headings: async (target) => {
        const note = await vault.links
          .resolve(path, { kind: "wiki", target })
          .catch(() => null);
        if (note === null) return [];
        const headings = await vault.links.headings(note).catch(() => []);
        return headings.map(({ level, text }) => ({ level, text }));
      },
      follow: (link, options) => {
        // The index can take a moment during the startup scan: the note
        // opens once it is found.
        vault.links.follow(path, link).then(
          (followed) => {
            if (followed === null) {
              setError(`"${link.target}" is outside the vault.`);
              return;
            }
            setError(null);
            open(followed.path, options);
          },
          (reason: unknown) => {
            const message =
              reason instanceof Error ? reason.message : String(reason);
            setError(`The note could not be opened: ${message}`);
          },
        );
      },
    }),
    [vault, path, open],
  );

  return { host, error, dismissError: () => setError(null) };
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
