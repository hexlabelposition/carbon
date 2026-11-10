import type { FsEvent, Watcher } from "@carbon/core";
import { watchImmediate, type WatchEvent } from "@tauri-apps/plugin-fs";
import { toCorePath } from "./paths";

/** `Watcher` on top of the Tauri `fs` plugin (needs its `watch` feature). */
export const tauriWatcher: Watcher = {
  watch(dir, onEvent) {
    return watchImmediate(
      dir,
      (event) => {
        for (const fsEvent of toFsEvents(event)) onEvent(fsEvent);
      },
      { recursive: true },
    );
  },
};

function toFsEvents({ type, paths }: WatchEvent): FsEvent[] {
  const all = (kind: FsEvent["kind"]): FsEvent[] =>
    paths.map((path) => ({ kind, path: toCorePath(path) }));

  // The backend could not tell what happened: report a modification and let
  // the vault check the file.
  if (typeof type === "string") return all("modified");
  if ("access" in type) return [];
  if ("create" in type) return all("created");
  if ("remove" in type) return all("removed");

  const modify = type.modify;
  if (modify.kind !== "rename") return all("modified");
  switch (modify.mode) {
    case "from":
      return all("removed");
    case "to":
      return all("created");
    case "both":
      // paths is [from, to]
      return [
        { kind: "removed", path: toCorePath(paths[0]) },
        { kind: "created", path: toCorePath(paths[1]) },
      ];
    default:
      return all("modified");
  }
}
