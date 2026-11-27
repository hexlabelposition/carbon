import type { ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { menuIcons } from "../ui/menu-icons";
import { Tooltip } from "../ui/Tooltip";
import { treeControls } from "./tree-controls";
import { toolButton } from "../ui/tool-button";
import type { TreeScope } from "./use-file-tree";

/**
 * The buttons above a tree that make a new note and a new folder, next to
 * the selection, as the items of its menu: the name is typed in the tree.
 */
export function TreeNewButtons({ scope }: { scope: TreeScope }) {
  const t = useT();
  const start = (what: "note" | "folder") =>
    treeControls.actions(scope)?.startNew(what);
  return (
    <>
      <ToolButton
        label={t(scope === "drafts" ? "drafts.new" : "tree.newNote")}
        icon={menuIcons.newNote}
        onClick={() => start("note")}
      />
      <ToolButton
        label={t("tree.newFolder")}
        icon={menuIcons.newFolder}
        onClick={() => start("folder")}
      />
    </>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        className={toolButton}
        onClick={onClick}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </button>
    </Tooltip>
  );
}
