import {
  fragmentRange,
  linksToFile,
  noteBlocks,
  readFrontmatter,
  type NotePath,
  type TreeNode,
  type Vault,
} from "@carbon/core";
import { useMemo, useState } from "react";
import { t } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import type { LinkHost } from "./link-completion";
import { previewMarkdown } from "./link-preview";
import { errorText } from "../i18n/error-text";

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
      // While the index opens, links are suggested by name alone.
      aliases: () => vault.links.aliases().catch(() => []),
      current: path,
      headings: async (target) => {
        const note = await vault.links
          .resolve(path, { kind: "wiki", target })
          .catch(() => null);
        if (note === null) return [];
        const headings = await vault.links.headings(note).catch(() => []);
        return headings.map(({ level, text }) => ({ level, text }));
      },
      missing: async (targets) => {
        const found = await Promise.all(
          targets.map((target) =>
            vault.links.resolve(path, { kind: "wiki", target }),
          ),
        );
        return new Set(targets.filter((_, i) => found[i] === null));
      },
      onIndexChange: (listener) => {
        const stops = [
          vault.on("index:ready", listener),
          vault.on("index:updated", listener),
        ];
        return () => {
          for (const stop of stops) stop();
        };
      },
      blocks: async (target) => {
        const note = await vault.links
          .resolve(path, { kind: "wiki", target })
          .catch(() => null);
        if (note === null) return [];
        return noteBlocks(await vault.notes.read(note));
      },
      blockId: async (target, from) => {
        const note = await vault.links.resolve(path, { kind: "wiki", target });
        return note === null ? null : vault.links.blockId(note, from);
      },
      preview: async (link) => {
        const note = await vault.links.resolve(path, link);
        if (note === null) return { path: null, canCreate: !linksToFile(link) };
        const text = await vault.notes.read(note);
        // "[[Note#Heading]]" shows the section of that heading, up to the
        // next heading of its level; "[[Note#^id]]" the block of that id.
        // A fragment the note does not have shows the whole note.
        const range =
          link.fragment === null ? null : fragmentRange(text, link.fragment);
        const start = range?.from ?? readFrontmatter(text)?.length ?? 0;
        const shown = text
          .slice(start, range?.to ?? text.length)
          .replace(/^\s*\n/, "");
        return {
          path: note,
          title: titleOf(note),
          heading: range === null ? null : link.fragment,
          markdown: previewMarkdown(shown),
        };
      },
      follow: (link, options) => {
        // The index can take a moment during the startup scan: the note
        // opens once it is found.
        vault.links.follow(path, link).then(
          (followed) => {
            if (followed === null) {
              setError(
                linksToFile(link)
                  ? t("links.notNote", { target: link.target })
                  : t("links.outside", { target: link.target }),
              );
              return;
            }
            setError(null);
            // At the heading or block the link names, if the note has it.
            const fragment = link.fragment ?? null;
            if (followed.created || fragment === null) {
              open(followed.path, options);
              return;
            }
            vault.notes.read(followed.path).then(
              (text) => {
                const at = fragmentRange(text, fragment)?.from;
                open(followed.path, { ...options, at });
              },
              () => open(followed.path, options),
            );
          },
          (reason: unknown) => {
            const message = errorText(reason);
            setError(t("links.openFailed", { reason: message }));
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

function titleOf(path: NotePath): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}
