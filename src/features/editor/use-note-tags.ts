import type { NotePath, Vault } from "@carbon/core";
import { useMemo } from "react";
import type { TagHost } from "./tag-completion";

/**
 * What the editor of one note needs to suggest tags: those of the vault,
 * with the note as it is now in place of the note as it was saved.
 */
export function useNoteTags(vault: Vault, path: NotePath): TagHost {
  return useMemo<TagHost>(
    () => ({
      // While the index opens, only the tags of the note are offered.
      suggestions: (written) =>
        vault.tags
          .suggestions(path, written)
          .catch(() => written.map((tag) => ({ tag, count: 1 }))),
    }),
    [vault, path],
  );
}
