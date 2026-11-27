import type { EntryInfo, TreeNode, Vault } from "@carbon/core";
import { useState, type ReactElement } from "react";
import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { nameOf } from "../vault/paths";
import { dateTime } from "./date-time";

/**
 * The tooltip of a row of the file tree: the whole name of its file or
 * folder, the extension too. Below it, for a file, when it was made and
 * last changed, as 2026-11-20 14:05, asked for as the tooltip opens, so
 * they are those of now; a date the system does not keep is left out.
 * For a folder, how many folders and files are right in it, on one line.
 */
export function RowTooltip({
  vault,
  node,
  children,
}: {
  vault: Vault;
  node: TreeNode;
  /** The row, which takes the props of the tooltip and its ref. */
  children: ReactElement;
}) {
  const t = useT();
  const [info, setInfo] = useState<EntryInfo | null>(null);
  const lines: string[] = [];
  if (node.kind === "folder") {
    const folders = node.children.filter((c) => c.kind === "folder").length;
    const files = node.children.length - folders;
    // On one line, both even when one is none: "0 folders, 12 files".
    lines.push(
      `${t("tree.folderCount", { count: folders })}, ${t("tree.fileCount", { count: files })}`,
    );
  } else if (info !== null) {
    if (info.created !== null) {
      lines.push(t("tree.created", { date: dateTime(info.created) }));
    }
    if (info.modified > 0) {
      lines.push(t("tree.modified", { date: dateTime(info.modified) }));
    }
  }
  return (
    <Tooltip
      label={
        <span className="flex flex-col gap-0.5">
          <span className="truncate">{nameOf(node.path)}</span>
          {lines.map((line) => (
            <span key={line} className="text-muted">
              {line}
            </span>
          ))}
        </span>
      }
      side="right"
      // A row in the tree takes the focus to be moved through with the
      // keys, not to be explained.
      hoverOnly
      onOpenChange={(open) => {
        if (!open || node.kind === "folder") return;
        vault.info(node.path).then(setInfo, () => setInfo(null));
      }}
    >
      {children}
    </Tooltip>
  );
}
