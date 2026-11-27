import { ContextMenu } from "@base-ui/react/context-menu";
import type { TreeNode, Vault } from "@carbon/core";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { isWithin, joinPath, nameOf, parentOf } from "../vault/paths";
import {
  labelOf,
  useFileTree,
  type FileTree as Tree,
  type TreeRow,
  type TreeScope,
} from "./use-file-tree";
import { useVirtualRows } from "./use-virtual-rows";
import { useTreeMotion } from "./use-tree-motion";
import { ScrollArea } from "../ui/ScrollArea";
import { NameInput } from "./NameInput";
import { RowTooltip } from "./RowTooltip";
import { shortcutLetter } from "../workspace/shortcut-letter";
import { keys, useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { canBookmark, type BookmarksView } from "../bookmarks/use-bookmarks";
import { log } from "../log/log";
import { imageTypeOf } from "../image/image-file";
import { MenuItemBody } from "../ui/MenuItemBody";

/**
 * Room for the scrollbar at the right of the rows, as `SCROLLBAR_ROOM`,
 * with the margin that keeps the bar off the resize handle.
 */
const TREE_SCROLLBAR_ROOM = "group-data-scrolls/scroll:pr-4.5";

/** Every row has this height, in pixels: the list is windowed by it. */
const ROW_HEIGHT = 26;
/** Room between two rows, in pixels: none, the rows touch. */
const ROW_GAP = 0;
/** From the top of a row to the top of the next one. */
const ROW_STEP = ROW_HEIGHT + ROW_GAP;
/** Room around the rows, in pixels: Tailwind's `px-2` at the sides. */
const LIST_PADDING = 8;
/** How far a level of the tree is shifted to the right, in pixels. */
const INDENT = 14;

/**
 * The file tree of the sidebar. Works with the mouse (click, drag to move,
 * the right button for a menu of what can be done) and with the keyboard
 * alone: arrows, Enter, F2, Delete, Ctrl+X or Ctrl+C then Ctrl+V to move
 * or copy, Ctrl+Z to take back the last move, rename or copy, and
 * Ctrl+Shift+Z or Ctrl+Y to make it again.
 * Ctrl+click, the middle button and Ctrl+Enter open a note in a new tab.
 */
export function FileTree({
  vault,
  scope = "vault",
  bookmarks,
  onReveal,
  showInFileManager,
}: {
  vault: Vault;
  /** Offered in the menu of a note or an image when given. */
  bookmarks?: BookmarksView;
  /** The vault, or the drafts (ADR-031), with a tree of their own. */
  scope?: TreeScope;
  /**
   * Opens the file manager of the system at an absolute path: offered in
   * the menu when given.
   */
  showInFileManager?: (path: string) => Promise<void>;
  /**
   * Makes the tree visible, for a command of the palette that acts in
   * it, such as "New folder".
   */
  onReveal?: () => void;
}) {
  const t = useT();
  const tree = useFileTree(vault, scope);
  // The latest, so the commands stay the same while the tree changes.
  const startNewRef = useRef(tree.startNew);
  useEffect(() => {
    startNewRef.current = tree.startNew;
  });
  useCommands(
    useMemo(
      () => [
        scope === "drafts"
          ? {
              id: "drafts.new",
              title: t("drafts.new"),
              run: () => {
                onReveal?.();
                startNewRef.current("note");
              },
            }
          : {
              id: "fileTree.newFolder",
              title: t("tree.newFolder"),
              run: () => {
                onReveal?.();
                startNewRef.current("folder");
              },
            },
      ],
      [t, onReveal, scope],
    ),
  );
  const { viewportRef, onScroll, first, end, totalHeight, scrollToIndex } =
    useVirtualRows(tree.rows.length, ROW_STEP, LIST_PADDING);
  const { motion, done } = useTreeMotion(tree.rows);
  const [dragging, setDragging] = useState<string | null>(null);
  /** The folder a drop would go to; `tree.root` is the root of the tree. */
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  /**
   * Whether the tree is being moved through with the arrows: only then is
   * the row the keys act on outlined. A click shows what it opened, not a
   * ring, and neither does the focus coming back after a menu or a dialog.
   */
  const [byKeys, setByKeys] = useState(false);

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
    else if (command && shortcutLetter(event) === "c") tree.copySelected();
    else if (command && shortcutLetter(event) === "z") {
      if (event.shiftKey) tree.redo();
      else tree.undo();
    } else if (command && shortcutLetter(event) === "y") tree.redo();
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

  const renderRow = (row: TreeRow) => {
    const indent = { paddingLeft: row.depth * INDENT + 6 };
    if (row.kind === "new") {
      return (
        <div
          key="new"
          className="flex shrink-0 items-center gap-1 pr-2"
          style={{ ...indent, height: ROW_HEIGHT }}
        >
          <Chevron hidden />
          <NameInput
            label={t(
              row.what === "note" ? "tree.newNoteName" : "tree.newFolderName",
            )}
            initial=""
            onCommit={(text) => finishEdit(() => tree.commitEdit(text))}
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
      dropFolder !== tree.root &&
      isWithin(node.path, dropFolder);
    const element = (
      <div
        id={rowId(node.path)}
        data-path={node.path}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-selected={selected}
        aria-expanded={isFolder ? tree.isExpanded(node.path) : undefined}
        draggable={!renaming}
        className={`flex shrink-0 cursor-default items-center gap-1 rounded-md pr-2 select-none ${
          tree.activePath === node.path || inDrop
            ? "bg-selected"
            : "hover:bg-raise"
        } ${
          selected && byKeys
            ? "outline-1 -outline-offset-1 outline-line-strong"
            : ""
        } ${
          tree.cut === node.path || dragging === node.path ? "opacity-50" : ""
        } ${node.kind === "file" ? "text-muted" : ""}`}
        style={{ ...indent, height: ROW_HEIGHT }}
        onClick={(event) => tree.activate(node, event.ctrlKey || event.metaKey)}
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
        {...dropZone(isFolder ? node.path : parentOf(node.path))}
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
            onCommit={(text) => finishEdit(() => tree.commitEdit(text))}
            onCancel={() => finishEdit(tree.cancelEdit)}
          />
        ) : (
          <span className="truncate">{labelOf(node)}</span>
        )}
      </div>
    );
    // No tooltip over the field of a new name.
    if (renaming) return <Fragment key={node.path}>{element}</Fragment>;
    return (
      <RowTooltip key={node.path} vault={vault} node={node}>
        {element}
      </RowTooltip>
    );
  };

  /**
   * The rows in view; while a folder opens or closes, the rows it shows or
   * hides are drawn in a block that grows from nothing or shrinks to it,
   * so the rows below it slide. Only for a folder in view.
   */
  const renderRows = () => {
    const rows = tree.rows;
    const at = motion?.at ?? -1;
    if (motion === null || at - 1 < first || at - 1 >= end) {
      return rows.slice(first, end).map(renderRow);
    }
    const shown =
      motion.kind === "open"
        ? rows.slice(at, Math.min(end, at + motion.rows.length))
        : motion.rows.slice(0, end - first);
    const after =
      motion.kind === "open" ? Math.min(end, at + motion.rows.length) : at;
    return [
      ...rows.slice(first, at).map(renderRow),
      <div
        key={`motion-${motion.key}`}
        className={`flex shrink-0 flex-col overflow-hidden ${
          motion.kind === "open" ? "cb-tree-open" : "cb-tree-close"
        }`}
        style={
          {
            "--cb-tree-height": `${shown.length * ROW_STEP}px`,
          } as CSSProperties
        }
        // The rows of a closing folder are gone already: only drawn.
        aria-hidden={motion.kind === "close" ? true : undefined}
        inert={motion.kind === "close"}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) done();
        }}
      >
        {shown.map(renderRow)}
      </div>,
      ...rows.slice(after, end).map(renderRow),
    ];
  };

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
          <ScrollArea
            ref={viewportRef}
            rootClassName="flex-1"
            // Off the edge of the sidebar: the handle that resizes it is
            // there, as wide (`w-1.5`, ResizeHandle).
            scrollbarClassName="mr-1.5"
            role="tree"
            aria-label={t(scope === "drafts" ? "shell.drafts" : "shell.files")}
            aria-activedescendant={
              tree.selected === null ? undefined : rowId(tree.selected)
            }
            tabIndex={0}
            className={`flex-1 focus-visible:bg-bg/40 ${
              dropFolder === tree.root ? "bg-raise" : ""
            }`}
            onScroll={onScroll}
            onKeyDown={(event) => {
              // Only the arrows move the row the keys act on: Escape or
              // Delete leave nothing to show.
              if (event.key.startsWith("Arrow")) setByKeys(true);
              onKeyDown(event);
            }}
            onPointerDown={() => setByKeys(false)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setByKeys(false);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDropFolder(null);
              }
            }}
            {...dropZone(tree.root)}
          >
            {tree.loading ? null : tree.rows.length === 0 ? (
              <p className="px-3 py-4 text-center text-faint">
                {t(scope === "drafts" ? "drafts.empty" : "tree.empty")}
              </p>
            ) : (
              <div
                className={`px-2 ${TREE_SCROLLBAR_ROOM}`}
                style={{ height: totalHeight }}
              >
                <div
                  className="flex flex-col"
                  style={{
                    gap: ROW_GAP,
                    transform: `translateY(${LIST_PADDING + first * ROW_STEP}px)`,
                  }}
                >
                  {renderRows()}
                </div>
              </div>
            )}
          </ScrollArea>
        </ContextMenu.Trigger>
        <TreeMenu
          target={menuTarget}
          // After an item that starts typing a name, the field has the
          // focus; after the others, the tree takes it back.
          finalFocus={() =>
            pendingEdit.current !== null ? false : viewportRef.current
          }
          onOpenInNewTab={
            menuTarget !== null &&
            (menuTarget.kind === "note" ||
              imageTypeOf(menuTarget.path) !== null)
              ? () => tree.activate(menuTarget, true)
              : undefined
          }
          onNewNote={() => editLater(() => tree.startNew("note"))}
          onNewFolder={() => editLater(() => tree.startNew("folder"))}
          onRename={() => editLater(tree.startRename)}
          onDelete={tree.remove}
          onCut={tree.cutSelected}
          onCopy={tree.copySelected}
          onPaste={tree.paste}
          canPaste={tree.canPaste}
          onUndo={tree.undo}
          canUndo={tree.canUndo}
          onRedo={tree.redo}
          canRedo={tree.canRedo}
          onMoveToRoot={tree.canMoveToRoot ? tree.moveToRoot : undefined}
          moveToRootLabel={t(
            scope === "drafts" ? "drafts.moveToRoot" : "tree.moveToRoot",
          )}
          onMoveAcross={tree.moveAcross}
          bookmark={
            bookmarks === undefined ||
            menuTarget === null ||
            !canBookmark(menuTarget.path)
              ? undefined
              : {
                  on: bookmarks.has(menuTarget.path),
                  toggle: () => bookmarks.toggle(menuTarget.path),
                }
          }
          moveAcrossLabel={t(
            scope === "drafts" ? "drafts.moveToVault" : "tree.moveToDrafts",
          )}
          onShowInFileManager={
            showInFileManager === undefined
              ? undefined
              : () => {
                  // The row of the menu, or the folder of the tree itself.
                  const path = joinPath(
                    vault.root,
                    menuTarget === null ? tree.root : menuTarget.path,
                  );
                  showInFileManager(path).catch((reason: unknown) =>
                    log.error("Could not open the file manager", reason),
                  );
                }
          }
        />
      </ContextMenu.Root>
    </div>
  );
}

interface TreeMenuProps {
  /** The row it was opened on, or `null` for the root. */
  target: TreeNode | null;
  finalFocus: () => HTMLElement | false | null;
  /** Offered for a row that opens in a tab: a note or an image. */
  onOpenInNewTab?: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  /** Whether there is something to paste into the folder of the row. */
  canPaste: boolean;
  onUndo: () => void;
  /** Whether there is a move, rename or copy to take back. */
  canUndo: boolean;
  onRedo: () => void;
  /** Whether there is a change taken back to make again. */
  canRedo: boolean;
  /** Offered for a row in a folder, not for one at the root already. */
  onMoveToRoot?: () => void;
  moveToRootLabel: string;
  /** Whether the row is a bookmark, and a way to change it; for notes. */
  bookmark?: { on: boolean; toggle: () => void };
  /** Moves a row to the other tree: to the drafts, or out of them. */
  onMoveAcross: () => void;
  moveAcrossLabel: string;
  /** Offered when the system file manager can be opened. */
  onShowInFileManager?: () => void;
}

const menuItem =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise data-disabled:text-faint";

const separator = "mx-1 my-1 h-px bg-line";

/**
 * The menu of the right button: new things in the folder of the row, or
 * at the root; cut, copy and paste; moving a row to the root and showing
 * it in the file manager of the system; renaming and deleting a row.
 */
function TreeMenu({
  target,
  finalFocus,
  onOpenInNewTab,
  onNewNote,
  onNewFolder,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  canPaste,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onMoveToRoot,
  moveToRootLabel,
  bookmark,
  onMoveAcross,
  moveAcrossLabel,
  onShowInFileManager,
}: TreeMenuProps) {
  const t = useT();
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className="z-50 outline-none">
        <ContextMenu.Popup
          finalFocus={finalFocus}
          className="min-w-64 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none"
        >
          {onOpenInNewTab !== undefined && (
            <>
              <ContextMenu.Item className={menuItem} onClick={onOpenInNewTab}>
                <MenuItemBody icon="newTab">
                  {t("tree.openInNewTab")}
                </MenuItemBody>
              </ContextMenu.Item>
              <ContextMenu.Separator className={separator} />
            </>
          )}
          <ContextMenu.Item className={menuItem} onClick={onNewNote}>
            <MenuItemBody icon="newNote">{t("tree.newNote")}</MenuItemBody>
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItem} onClick={onNewFolder}>
            <MenuItemBody icon="newFolder">{t("tree.newFolder")}</MenuItemBody>
          </ContextMenu.Item>
          <ContextMenu.Separator className={separator} />
          {target !== null && (
            <>
              <ContextMenu.Item className={menuItem} onClick={onCut}>
                <MenuItemBody icon="cut" keys={keys("Mod+X")}>
                  {t("tree.cut")}
                </MenuItemBody>
              </ContextMenu.Item>
              <ContextMenu.Item className={menuItem} onClick={onCopy}>
                <MenuItemBody icon="copy" keys={keys("Mod+C")}>
                  {t("tree.copy")}
                </MenuItemBody>
              </ContextMenu.Item>
            </>
          )}
          <ContextMenu.Item
            className={menuItem}
            disabled={!canPaste}
            onClick={onPaste}
          >
            <MenuItemBody icon="paste" keys={keys("Mod+V")}>
              {t("tree.paste")}
            </MenuItemBody>
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItem}
            disabled={!canUndo}
            onClick={onUndo}
          >
            <MenuItemBody icon="undo" keys={keys("Mod+Z")}>
              {t("tree.undo")}
            </MenuItemBody>
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItem}
            disabled={!canRedo}
            onClick={onRedo}
          >
            <MenuItemBody icon="redo" keys={keys("Mod+Shift+Z")}>
              {t("tree.redo")}
            </MenuItemBody>
          </ContextMenu.Item>
          {(target !== null || onShowInFileManager !== undefined) && (
            <ContextMenu.Separator className={separator} />
          )}
          {target !== null && bookmark !== undefined && (
            <ContextMenu.Item className={menuItem} onClick={bookmark.toggle}>
              <MenuItemBody icon="bookmark">
                {t(bookmark.on ? "bookmarks.remove" : "bookmarks.add")}
              </MenuItemBody>
            </ContextMenu.Item>
          )}
          {target !== null && onMoveToRoot !== undefined && (
            <ContextMenu.Item className={menuItem} onClick={onMoveToRoot}>
              <MenuItemBody icon="moveToRoot">{moveToRootLabel}</MenuItemBody>
            </ContextMenu.Item>
          )}
          {target !== null && (
            <ContextMenu.Item className={menuItem} onClick={onMoveAcross}>
              <MenuItemBody icon="moveAcross">{moveAcrossLabel}</MenuItemBody>
            </ContextMenu.Item>
          )}
          {onShowInFileManager !== undefined && (
            <ContextMenu.Item
              className={menuItem}
              onClick={onShowInFileManager}
            >
              <MenuItemBody icon="fileManager">
                {t("tree.showInFileManager")}
              </MenuItemBody>
            </ContextMenu.Item>
          )}
          {target !== null && (
            <>
              <ContextMenu.Separator className={separator} />
              <ContextMenu.Item className={menuItem} onClick={onRename}>
                <MenuItemBody icon="rename" keys="F2">
                  {t("tree.rename")}
                </MenuItemBody>
              </ContextMenu.Item>
              <ContextMenu.Item
                className={`${menuItem} text-danger`}
                onClick={onDelete}
              >
                <MenuItemBody icon="delete" keys="Del">
                  {t("tree.delete")}
                </MenuItemBody>
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
      className={`size-3.5 shrink-0 text-faint transition-transform duration-150 motion-reduce:transition-none ${hidden ? "invisible" : ""} ${
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
