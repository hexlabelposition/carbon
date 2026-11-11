import type { Vault } from "@carbon/core";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { isWithin, nameOf, parentOf } from "../vault/paths";
import { labelOf, useFileTree, type FileTree as Tree } from "./use-file-tree";
import { useVirtualRows } from "./use-virtual-rows";

/** Every row has this height, in pixels: the list is windowed by it. */
const ROW_HEIGHT = 26;
/** How far a level of the tree is shifted to the right, in pixels. */
const INDENT = 14;

const toolButton =
  "h-6 rounded-sm px-1.5 text-small text-muted hover:bg-raise hover:text-fg disabled:text-faint disabled:hover:bg-transparent";

/**
 * The file tree of the sidebar. Works with the mouse (click, drag to move)
 * and with the keyboard alone: arrows, Enter, F2, Delete, and Ctrl+X then
 * Ctrl+V to move.
 */
export function FileTree({ vault }: { vault: Vault }) {
  const tree = useFileTree(vault);
  const { viewportRef, onScroll, first, end, totalHeight, scrollToIndex } =
    useVirtualRows(tree.rows.length, ROW_HEIGHT);
  const [dragging, setDragging] = useState<string | null>(null);
  /** The folder a drop would go to; "" is the vault root. */
  const [dropFolder, setDropFolder] = useState<string | null>(null);

  useEffect(() => {
    scrollToIndex(tree.selectedIndex);
  }, [scrollToIndex, tree.selectedIndex]);

  const hasSelection = tree.selectedIndex !== -1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys typed into a name field belong to the field.
    if (event.target !== event.currentTarget) return;
    const command = event.ctrlKey || event.metaKey;
    const row = tree.rows[tree.selectedIndex];
    if (event.key === "ArrowDown") tree.step(1);
    else if (event.key === "ArrowUp") tree.step(-1);
    else if (event.key === "ArrowRight") tree.expandOrEnter();
    else if (event.key === "ArrowLeft") tree.collapseOrLeave();
    else if (event.key === "Enter" && row?.kind === "node") {
      tree.activate(row.node);
    } else if (event.key === "F2") tree.startRename();
    else if (event.key === "Delete") tree.remove();
    else if (command && event.key.toLowerCase() === "x") tree.cutSelected();
    else if (command && event.key.toLowerCase() === "v") tree.paste();
    else if (event.key === "Escape") tree.cancelCut();
    else return;
    event.preventDefault();
  }

  function endDrag() {
    setDragging(null);
    setDropFolder(null);
  }

  /** Handlers that make `folder` a place to drop what is being dragged. */
  function dropZone(folder: string) {
    return {
      onDragOver(event: DragEvent) {
        if (dragging === null) return;
        // The innermost zone decides; the tree behind it is the vault root.
        event.stopPropagation();
        if (tree.canMove(dragging, folder)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropFolder(folder);
        } else setDropFolder(null);
      },
      onDrop(event: DragEvent) {
        event.stopPropagation();
        event.preventDefault();
        if (dragging !== null) tree.move(dragging, folder);
        endDrag();
      },
    };
  }

  const finishEdit = (action: () => void) => {
    action();
    viewportRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap gap-0.5 border-b border-line px-1.5 py-1">
        <button
          type="button"
          className={toolButton}
          onClick={() => tree.startNew("note")}
        >
          New note
        </button>
        <button
          type="button"
          className={toolButton}
          onClick={() => tree.startNew("folder")}
        >
          New folder
        </button>
        <button
          type="button"
          className={toolButton}
          disabled={!hasSelection}
          onClick={tree.startRename}
        >
          Rename
        </button>
        <button
          type="button"
          className={toolButton}
          disabled={!hasSelection}
          onClick={tree.remove}
        >
          Delete
        </button>
      </div>

      <Notice tree={tree} />

      <div
        ref={viewportRef}
        role="tree"
        aria-label="Files"
        aria-activedescendant={
          tree.selected === null ? undefined : rowId(tree.selected)
        }
        tabIndex={0}
        className={`min-h-0 flex-1 overflow-auto outline-none focus-visible:bg-bg/40 ${
          dropFolder === "" ? "bg-raise" : ""
        }`}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDropFolder(null);
          }
        }}
        {...dropZone("")}
      >
        {tree.loading ? null : tree.rows.length === 0 ? (
          <p className="px-3 py-4 text-center text-faint">
            This vault is empty. Create the first note.
          </p>
        ) : (
          <div style={{ height: totalHeight }}>
            <div
              style={{
                transform: `translateY(${first * ROW_HEIGHT}px)`,
              }}
            >
              {tree.rows.slice(first, end).map((row) => {
                const indent = { paddingLeft: row.depth * INDENT + 6 };
                if (row.kind === "new") {
                  return (
                    <div
                      key="new"
                      className="flex items-center gap-1 pr-2"
                      style={{ ...indent, height: ROW_HEIGHT }}
                    >
                      <Chevron hidden />
                      <NameInput
                        label={`Name of the new ${row.what}`}
                        initial=""
                        onCommit={(text) =>
                          finishEdit(() => tree.commitEdit(text))
                        }
                        onCancel={() => finishEdit(tree.cancelEdit)}
                      />
                    </div>
                  );
                }

                const { node } = row;
                const isFolder = node.kind === "folder";
                const selected = tree.selected === node.path;
                const renaming =
                  tree.edit?.kind === "rename" && tree.edit.path === node.path;
                const inDrop =
                  dropFolder !== null &&
                  dropFolder !== "" &&
                  isWithin(node.path, dropFolder);
                return (
                  <div
                    key={node.path}
                    id={rowId(node.path)}
                    role="treeitem"
                    aria-level={row.depth + 1}
                    aria-selected={selected}
                    aria-expanded={
                      isFolder ? tree.isExpanded(node.path) : undefined
                    }
                    draggable={!renaming}
                    className={`flex cursor-default items-center gap-1 pr-2 select-none ${
                      tree.activePath === node.path || inDrop
                        ? "bg-selected"
                        : "hover:bg-raise"
                    } ${
                      selected
                        ? "outline-1 -outline-offset-1 outline-line-strong"
                        : ""
                    } ${
                      tree.cut === node.path || dragging === node.path
                        ? "opacity-50"
                        : ""
                    } ${node.kind === "file" ? "text-muted" : ""}`}
                    style={{ ...indent, height: ROW_HEIGHT }}
                    onClick={() => tree.activate(node)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", node.path);
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(node.path);
                    }}
                    onDragEnd={endDrag}
                    {...dropZone(isFolder ? node.path : parentOf(node.path))}
                  >
                    <Chevron
                      hidden={!isFolder}
                      open={isFolder && tree.isExpanded(node.path)}
                    />
                    {renaming ? (
                      <NameInput
                        label={`New name of ${nameOf(node.path)}`}
                        initial={labelOf(node)}
                        onCommit={(text) =>
                          finishEdit(() => tree.commitEdit(text))
                        }
                        onCancel={() => finishEdit(tree.cancelEdit)}
                      />
                    ) : (
                      <span className="truncate">{labelOf(node)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** What went wrong, with a way out. */
function Notice({ tree }: { tree: Tree }) {
  if (tree.trashFailure !== null) {
    const name = nameOf(tree.trashFailure.path);
    return (
      <div
        role="alert"
        className="flex shrink-0 flex-col gap-1.5 border-b border-line px-3 py-2 text-small"
      >
        <p>
          “{name}” could not be moved to the trash: {tree.trashFailure.message}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-6 rounded-sm bg-danger px-2 text-on-danger"
            onClick={tree.removeForGood}
          >
            Delete for good
          </button>
          <button
            type="button"
            className="h-6 rounded-sm border border-line-strong px-2"
            onClick={tree.dismiss}
          >
            Keep
          </button>
        </div>
      </div>
    );
  }
  if (tree.error !== null) {
    return (
      <div
        role="alert"
        className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2 text-small"
      >
        <p className="min-w-0 flex-1 text-danger">{tree.error}</p>
        <button
          type="button"
          className="shrink-0 rounded-sm px-1 text-muted hover:bg-raise hover:text-fg"
          onClick={tree.dismiss}
        >
          Dismiss
        </button>
      </div>
    );
  }
  return null;
}

interface NameInputProps {
  label: string;
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/** The field a name is typed into. Enter or leaving it keeps the name. */
function NameInput({ label, initial, onCommit, onCancel }: NameInputProps) {
  const [text, setText] = useState(initial);
  /** Enter is followed by a blur; only the first of them counts. */
  const done = useRef(false);

  const finish = (action: () => void) => {
    if (done.current) return;
    done.current = true;
    action();
  };

  return (
    <input
      aria-label={label}
      autoFocus
      autoComplete="off"
      spellCheck={false}
      className="h-5 min-w-0 flex-1 rounded-sm border border-line-strong bg-bg px-1 outline-none"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => finish(() => onCommit(text))}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(() => onCommit(text));
        else if (event.key === "Escape") finish(onCancel);
      }}
    />
  );
}

/** The arrow of a folder; `hidden` keeps its place for files. */
function Chevron({ hidden, open }: { hidden?: boolean; open?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-3 shrink-0 text-faint ${hidden ? "invisible" : ""} ${
        open ? "rotate-90" : ""
      }`}
    >
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function rowId(path: string): string {
  return `file-tree:${path}`;
}
