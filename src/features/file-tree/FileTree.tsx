import { ContextMenu } from "@base-ui/react/context-menu";
import type { TreeNode, Vault } from "@carbon/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { isWithin, nameOf, parentOf } from "../vault/paths";
import { labelOf, useFileTree, type FileTree as Tree } from "./use-file-tree";
import { useVirtualRows } from "./use-virtual-rows";
import { NameInput } from "./NameInput";
import { shortcutLetter } from "../workspace/shortcut-letter";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";

/** Every row has this height, in pixels: the list is windowed by it. */
const ROW_HEIGHT = 26;
/** How far a level of the tree is shifted to the right, in pixels. */
const INDENT = 14;

/**
 * The file tree of the sidebar. Works with the mouse (click, drag to move,
 * the right button for a menu of what can be done) and with the keyboard
 * alone: arrows, Enter, F2, Delete, and Ctrl+X then Ctrl+V to move.
 * Ctrl+click, the middle button and Ctrl+Enter open a note in a new tab.
 */
export function FileTree({
  vault,
  onReveal,
}: {
  vault: Vault;
  /**
   * Makes the tree visible, for a command of the palette that acts in
   * it, such as "New folder".
   */
  onReveal?: () => void;
}) {
  const t = useT();
  const tree = useFileTree(vault);
  // The latest, so the commands stay the same while the tree changes.
  const startNewRef = useRef(tree.startNew);
  useEffect(() => {
    startNewRef.current = tree.startNew;
  });
  useCommands(
    useMemo(
      () => [
        {
          id: "fileTree.newFolder",
          title: t("tree.newFolder"),
          run: () => {
            onReveal?.();
            startNewRef.current("folder");
          },
        },
      ],
      [t, onReveal],
    ),
  );
  const { viewportRef, onScroll, first, end, totalHeight, scrollToIndex } =
    useVirtualRows(tree.rows.length, ROW_HEIGHT);
  const [dragging, setDragging] = useState<string | null>(null);
  /** The folder a drop would go to; "" is the vault root. */
  const [dropFolder, setDropFolder] = useState<string | null>(null);

  useEffect(() => {
    scrollToIndex(tree.selectedIndex);
  }, [scrollToIndex, tree.selectedIndex]);

  /**
   * What the menu of the right button acts on: the row pressed, which it
   * selects, or `null` for the empty space below the rows: the root.
   */
  const [menuTarget, setMenuTarget] = useState<TreeNode | null>(null);
  /**
   * What a menu item that types a name does, run once the menu is shut:
   * while it is open it holds the focus, and the field would lose it.
   */
  const pendingEdit = useRef<(() => void) | null>(null);

  function onContextMenu(event: MouseEvent<HTMLDivElement>) {
    const row =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-path]")
        : null;
    const path = row?.dataset.path ?? null;
    const node =
      path === null
        ? undefined
        : tree.rows.find(
            (r): r is Extract<typeof r, { kind: "node" }> =>
              r.kind === "node" && r.node.path === path,
          )?.node;
    tree.select(node?.path ?? null);
    setMenuTarget(node ?? null);
    pendingEdit.current = null;
  }

  /** For a menu item that starts typing a name: runs `action` once shut. */
  function editLater(action: () => void) {
    pendingEdit.current = action;
  }

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
      tree.activate(row.node, command);
    } else if (event.key === "F2") tree.startRename();
    else if (event.key === "Delete") tree.remove();
    else if (command && shortcutLetter(event) === "x") tree.cutSelected();
    else if (command && shortcutLetter(event) === "v") tree.paste();
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
      <Notice tree={tree} />

      <ContextMenu.Root
        onOpenChangeComplete={(open) => {
          const edit = pendingEdit.current;
          pendingEdit.current = null;
          // After the menu is gone and has handed the focus back, in a
          // task of its own: then the field can keep the focus.
          if (!open && edit !== null) setTimeout(edit, 0);
        }}
      >
        {/* The right button anywhere in the tree: on a row, or below them. */}
        <ContextMenu.Trigger
          className="flex min-h-0 flex-1 flex-col"
          onContextMenu={onContextMenu}
        >
          <div
            ref={viewportRef}
            role="tree"
            aria-label={t("shell.files")}
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
                {t("tree.empty")}
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
                            label={t(
                              row.what === "note"
                                ? "tree.newNoteName"
                                : "tree.newFolderName",
                            )}
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
                      tree.edit?.kind === "rename" &&
                      tree.edit.path === node.path;
                    const inDrop =
                      dropFolder !== null &&
                      dropFolder !== "" &&
                      isWithin(node.path, dropFolder);
                    return (
                      <div
                        key={node.path}
                        id={rowId(node.path)}
                        data-path={node.path}
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
                        onClick={(event) =>
                          tree.activate(node, event.ctrlKey || event.metaKey)
                        }
                        onAuxClick={(event) => {
                          // The middle button opens a note in a new tab.
                          if (event.button === 1 && !isFolder) {
                            tree.activate(node, true);
                          }
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", node.path);
                          event.dataTransfer.effectAllowed = "move";
                          setDragging(node.path);
                        }}
                        onDragEnd={endDrag}
                        {...dropZone(
                          isFolder ? node.path : parentOf(node.path),
                        )}
                      >
                        <Chevron
                          hidden={!isFolder}
                          open={isFolder && tree.isExpanded(node.path)}
                        />
                        {renaming ? (
                          <NameInput
                            label={t("tree.newName", {
                              name: nameOf(node.path),
                            })}
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
        </ContextMenu.Trigger>
        <TreeMenu
          target={menuTarget}
          // After an item that starts typing a name, the field has the
          // focus; after the others, the tree takes it back.
          finalFocus={() =>
            pendingEdit.current !== null ? false : viewportRef.current
          }
          onNewNote={() => editLater(() => tree.startNew("note"))}
          onNewFolder={() => editLater(() => tree.startNew("folder"))}
          onRename={() => editLater(tree.startRename)}
          onDelete={tree.remove}
        />
      </ContextMenu.Root>
    </div>
  );
}

interface TreeMenuProps {
  /** The row it was opened on, or `null` for the root. */
  target: TreeNode | null;
  finalFocus: () => HTMLElement | false | null;
  onNewNote: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

const menuItem =
  "flex h-7 cursor-default items-center justify-between gap-6 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise";

/**
 * The menu of the right button: new things in the folder of the row, or
 * at the root; and for a row, rename and delete it, with their keys.
 */
function TreeMenu({
  target,
  finalFocus,
  onNewNote,
  onNewFolder,
  onRename,
  onDelete,
}: TreeMenuProps) {
  const t = useT();
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className="z-50 outline-none">
        <ContextMenu.Popup
          finalFocus={finalFocus}
          className="min-w-44 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none"
        >
          <ContextMenu.Item className={menuItem} onClick={onNewNote}>
            {t("tree.newNote")}
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItem} onClick={onNewFolder}>
            {t("tree.newFolder")}
          </ContextMenu.Item>
          {target !== null && (
            <>
              <ContextMenu.Separator className="mx-1 my-1 h-px bg-line" />
              <ContextMenu.Item className={menuItem} onClick={onRename}>
                {t("tree.rename")}
                <span className="text-small text-faint">F2</span>
              </ContextMenu.Item>
              <ContextMenu.Item
                className={`${menuItem} text-danger`}
                onClick={onDelete}
              >
                {t("tree.delete")}
                <span className="text-small text-faint">Del</span>
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}

/** What went wrong, with a way out. */
function Notice({ tree }: { tree: Tree }) {
  const t = useT();
  if (tree.trashFailure !== null) {
    const name = nameOf(tree.trashFailure.path);
    return (
      <div
        role="alert"
        className="flex shrink-0 flex-col gap-1.5 border-b border-line px-3 py-2 text-small"
      >
        <p>
          {t("tree.trashFailed", {
            name,
            reason: tree.trashFailure.message,
          })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-6 rounded-sm bg-danger px-2 text-on-danger"
            onClick={tree.removeForGood}
          >
            {t("tree.deleteForGood")}
          </button>
          <button
            type="button"
            className="h-6 rounded-sm border border-line-strong px-2"
            onClick={tree.dismiss}
          >
            {t("tree.keep")}
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
          {t("common.dismiss")}
        </button>
      </div>
    );
  }
  return null;
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
