import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { treeControls } from "./tree-controls";
import { toolButton } from "../ui/tool-button";
import type { TreeScope } from "./use-file-tree";

/** Two chevrons, drawn on 16 by 16: apart to open, together to close. */
const CHEVRONS_APART = "M5 6l3-3 3 3M5 10l3 3 3-3";
const CHEVRONS_TOGETHER = "M5 3l3 3 3-3M5 13l3-3 3 3";

/**
 * The button beside the sort of a tree that closes all its folders when
 * one is open, and otherwise opens them all. Greyed out in a tree with
 * no folders.
 */
export function TreeFoldButton({ scope }: { scope: TreeScope }) {
  const t = useT();
  const { hasFolders, anyOpen } = treeControls.use(scope);
  const label = t(anyOpen ? "tree.collapseAll" : "tree.expandAll");
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={!hasFolders}
        className={toolButton}
        onClick={() => treeControls.actions(scope)?.setAllExpanded(!anyOpen)}
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
          <path d={anyOpen ? CHEVRONS_TOGETHER : CHEVRONS_APART} />
        </svg>
      </button>
    </Tooltip>
  );
}
