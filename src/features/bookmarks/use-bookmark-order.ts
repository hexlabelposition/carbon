import { DRAFTS_FOLDER, type FileTimes, type Vault } from "@carbon/core";
import { useEffect, useMemo, useState } from "react";
import { bookmarkSortPreference, sortBookmarks } from "./bookmark-sort";

/**
 * `paths`, the bookmarks, in the order picked (`bookmarkSortPreference`).
 * For a sort by time the times of the files are asked for, those of the
 * drafts too if one is a bookmark, again whenever the list is.
 */
export function useBookmarkOrder(
  vault: Vault,
  paths: readonly string[] | null,
): readonly string[] | null {
  const sort = bookmarkSortPreference.use();
  const [times, setTimes] = useState<ReadonlyMap<string, FileTimes>>(
    () => new Map(),
  );
  const byTime = sort.startsWith("modified");

  useEffect(() => {
    if (!byTime || paths === null) return;
    let stale = false;
    const drafts = paths.some((path) => path.startsWith(`${DRAFTS_FOLDER}/`));
    Promise.all([
      vault.fileTimes(),
      drafts ? vault.fileTimes(true) : new Map<string, FileTimes>(),
    ]).then(
      ([files, inDrafts]) => {
        if (!stale) setTimes(new Map([...files, ...inDrafts]));
      },
      // Without them the bookmarks keep the order of their names.
      () => {},
    );
    return () => {
      stale = true;
    };
  }, [vault, paths, byTime]);

  return useMemo(
    () => (paths === null ? null : sortBookmarks(paths, sort, times)),
    [paths, sort, times],
  );
}
