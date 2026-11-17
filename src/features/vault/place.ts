import { DRAFTS_FOLDER } from "@carbon/core";
import type { Translate } from "../i18n/i18n";
import { nameOf, parentOf } from "./paths";

/**
 * Where an entry is, for a line under its name: its folder, the vault
 * root, or the drafts with the folder inside them.
 */
export function placeOf(path: string, t: Translate): string {
  const folder = parentOf(path);
  if (folder === DRAFTS_FOLDER) return t("shell.drafts");
  if (folder.startsWith(`${DRAFTS_FOLDER}/`)) {
    return `${t("shell.drafts")}/${folder.slice(DRAFTS_FOLDER.length + 1)}`;
  }
  return folder === "" ? t("trash.root") : folder;
}

/** The name of an entry as lists show it: a note without its `.md`. */
export function entryLabel(path: string): string {
  return nameOf(path).replace(/\.md$/i, "");
}
