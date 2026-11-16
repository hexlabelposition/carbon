import type { TreeNode, Vault } from "@carbon/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { imageTypeOf } from "../image/image-file";
import { findNode, isWithin, joinPath, parentOf, rebase } from "../vault/paths";
import { t } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";

/** What is being typed into the tree: a new name, or a name for a new item. */
export type TreeEdit =
  | { kind: "rename"; path: string }
  | { kind: "new"; what: "note" | "folder"; parent: string };

/**
 * A change made in the tree that "undo" can take back and "redo" make
 * again: a move or a rename (from `from` to `to`), or a copy of `source`
 * made at `path`.
 */
type Undoable =
  | { kind: "move"; from: string; to: string; folder: boolean }
  | { kind: "copy"; source: string; path: string; folder: boolean };

/** How many changes "undo" and "redo" each keep, the latest first. */
const UNDO_LIMIT = 50;

/** One line of the tree as it is shown: folders that are closed hide theirs. */
export type TreeRow =
  | { kind: "node"; node: TreeNode; depth: number }
  /** The line where the name of a new note or folder is typed. */
  | { kind: "new"; what: "note" | "folder"; depth: number };

export interface FileTree {
  /** True until the vault has been listed for the first time. */
  loading: boolean;
  rows: readonly TreeRow[];
  /** The row the keyboard and the toolbar act on. */
  selected: string | null;
  /** Position of the selected row in `rows`, or -1. */
  selectedIndex: number;
  /** The note that is open in the workspace. */
  activePath: string | null;
  edit: TreeEdit | null;
  /** The entry marked to be moved by "cut", then "paste". */
  cut: string | null;
  /** Whether "paste" would do something in the folder of the selection. */
  canPaste: boolean;
  /** Whether the selection is in a folder and could go to the root. */
  canMoveToRoot: boolean;
  /** The last thing that went wrong, in words for the user. */
  error: string | null;
  /** Set when moving to the trash failed: the user may delete for good. */
  trashFailure: { path: string; message: string } | null;

  isExpanded(path: string): boolean;
  /** Selects `path`; `null` selects nothing, so new things go to the root. */
  select(path: string | null): void;
  /**
   * A click or Enter: opens a note, opens or closes a folder. With
   * `newTab` the note gets a tab of its own.
   */
  activate(node: TreeNode, newTab?: boolean): void;
  /** Moves the selection up (-1) or down (1) the visible rows. */
  step(delta: number): void;
  /** Arrow right: opens the folder, or goes to its first child. */
  expandOrEnter(): void;
  /** Arrow left: closes the folder, or goes to the parent folder. */
  collapseOrLeave(): void;

  /** Starts typing a name for a new item next to the selection. */
  startNew(what: "note" | "folder"): void;
  startRename(): void;
  commitEdit(text: string): void;
  cancelEdit(): void;

  /** Moves the selection to the system trash. */
  remove(): void;
  /** After a failed `remove`: deletes that entry for good. */
  removeForGood(): void;
  dismiss(): void;

  /** Whether `path` can be moved into `folder` ("" is the vault root). */
  canMove(path: string, folder: string): boolean;
  move(path: string, folder: string): void;
  cutSelected(): void;
  /** Marks the selection to be copied by "paste". */
  copySelected(): void;
  /**
   * Moves the cut entry, or copies the copied one, into the folder of the
   * selection. A copy whose name is taken there gets a number: "Note 1".
   */
  paste(): void;
  /** Moves the selection to the vault root. */
  moveToRoot(): void;
  /** Forgets what was cut or copied. */
  cancelCut(): void;
  /** Whether there is a change for `undo` to take back. */
  canUndo: boolean;
  /**
   * Takes back the last move, rename or copy made in the tree: moves the
   * entry back, or moves the copy to the system trash.
   */
  undo(): void;
  /** Whether there is a change taken back for `redo` to make again. */
  canRedo: boolean;
  /** Makes again the last change `undo` took back. */
  redo(): void;
}

/** Everything the file tree does; the component only shows it. */
export function useFileTree(vault: Vault): FileTree {
  const active = useWorkspace();
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(active.path);
  const [edit, setEdit] = useState<TreeEdit | null>(null);
  /** What "cut" or "copy" marked, for "paste". */
  const [clipboard, setClipboard] = useState<{
    path: string;
    mode: "cut" | "copy";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trashFailure, setTrashFailure] =
    useState<FileTree["trashFailure"]>(null);
  /**
   * The changes `undo` can take back and the ones `redo` can make again,
   * the latest last in each.
   */
  const changes = useRef<{ undo: Undoable[]; redo: Undoable[] }>({
    undo: [],
    redo: [],
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  function syncHistory() {
    setCanUndo(changes.current.undo.length > 0);
    setCanRedo(changes.current.redo.length > 0);
  }
  /** A new change: it can be taken back, and what was taken back is gone. */
  function remember(change: Undoable) {
    changes.current = {
      undo: [...changes.current.undo, change].slice(-UNDO_LIMIT),
      redo: [],
    };
    syncHistory();
  }
  /** Raised to list the vault again: after a change, here or outside. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const reload = () => setVersion((v) => v + 1);
    // "tree" is this app changing the vault, from the tree or from the
    // editor saving an attachment; "changed" is everyone else.
    const stopOwn = vault.on("tree", reload);
    const stopOutside = vault.on("changed", reload);
    return () => {
      stopOwn();
      stopOutside();
    };
  }, [vault]);

  useEffect(() => {
    // An older listing must not replace a newer one.
    let stale = false;
    vault.tree().then(
      (nodes) => {
        if (!stale) setTree(nodes);
      },
      (reason: unknown) => {
        if (!stale) setError(messageOf(reason));
      },
    );
    return () => {
      stale = true;
    };
  }, [vault, version]);

  /**
   * The open note as the tree shows it: once the listing has it. A note
   * renamed elsewhere, as from its title, is open under its new path a
   * moment before the tree is listed again; until then its old row stays
   * marked, so the mark does not blink off and on. Worked out while
   * rendering, from the last one (React's way to adjust state to props).
   */
  const [shownActive, setShownActive] = useState(active.path);
  const nextActive =
    active.path === null
      ? null
      : tree === null || findNode(tree, active.path) !== undefined
        ? active.path
        : shownActive;
  if (nextActive !== shownActive) setShownActive(nextActive);

  // Show the open note: its folders are opened and it becomes the selection.
  // Done when another note is shown, not when the user closes a folder.
  const [followed, setFollowed] = useState<string | null>(null);
  if (nextActive !== null && nextActive !== followed) {
    setFollowed(nextActive);
    setSelected(nextActive);
    setExpanded((current) => withParents(current, nextActive));
  }

  const rows = useMemo(
    () => flatten(tree ?? [], expanded, edit),
    [tree, expanded, edit],
  );
  const selectedIndex = rows.findIndex(
    (row) => row.kind === "node" && row.node.path === selected,
  );
  const selectedNode =
    selected === null || tree === null ? undefined : findNode(tree, selected);

  /** The folder new and pasted things go to: where the selection is. */
  const targetFolder =
    selectedNode === undefined
      ? ""
      : selectedNode.kind === "folder"
        ? selectedNode.path
        : parentOf(selectedNode.path);

  const expand = (path: string) =>
    setExpanded((current) => new Set(current).add(path));
  const collapse = (path: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      next.delete(path);
      return next;
    });

  /** Runs a change to the vault and reports a failure. */
  async function run(action: () => Promise<void>) {
    setError(null);
    setTrashFailure(null);
    try {
      // The open note may have edits that are not written yet; they must
      // reach its file before the file is moved, renamed or deleted.
      await active.flush();
      await action();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  /** Keeps everything that points at `from` pointing at it after a move. */
  function follow(from: string, to: string) {
    const moved = (path: string) =>
      isWithin(path, from) ? rebase(path, from, to) : path;
    setExpanded((current) => new Set([...current].map(moved)));
    setSelected((current) => (current === null ? null : moved(current)));
    // A cut entry has been moved; a copied one is still to be copied.
    setClipboard((current) =>
      current === null || current.mode === "cut"
        ? null
        : { ...current, path: moved(current.path) },
    );
    active.moved(from, to);
  }

  function forget(path: string) {
    setExpanded(
      (current) => new Set([...current].filter((p) => !isWithin(p, path))),
    );
    setSelected((current) =>
      current !== null && isWithin(current, path) ? null : current,
    );
    setClipboard((current) =>
      current !== null && isWithin(current.path, path) ? null : current,
    );
    active.removed(path);
  }

  async function rename(node: TreeNode, to: string): Promise<void> {
    // The links the rename rewrote, or could not, are not shown yet.
    await (node.kind === "folder"
      ? vault.folders.rename(node.path, to)
      : vault.notes.rename(node.path, to));
  }

  function removeNode(node: TreeNode, permanent: boolean): Promise<void> {
    return node.kind === "folder"
      ? vault.folders.remove(node.path, { permanent })
      : vault.notes.remove(node.path, { permanent });
  }

  const canMove = (path: string, folder: string) =>
    parentOf(path) !== folder && !isWithin(folder, path);

  function move(path: string, folder: string) {
    const node = tree === null ? undefined : findNode(tree, path);
    if (node === undefined || !canMove(path, folder)) return;
    const to = joinPath(folder, node.name);
    void run(async () => {
      await rename(node, to);
      follow(path, to);
      remember({
        kind: "move",
        from: path,
        to,
        folder: node.kind === "folder",
      });
      if (folder !== "") expand(folder);
    });
  }

  /** Copies `path` into `folder`, under a free name. */
  function copy(path: string, folder: string) {
    const node = tree === null ? undefined : findNode(tree, path);
    if (node === undefined || tree === null) return;
    if (isWithin(folder, path)) {
      setError(t("tree.copyIntoItself"));
      return;
    }
    const parent = folder === "" ? undefined : findNode(tree, folder);
    const siblings: readonly TreeNode[] =
      folder === "" ? tree : parent?.kind === "folder" ? parent.children : [];
    const taken = new Set(siblings.map((n) => n.name.toLowerCase()));
    const to = joinPath(folder, freeName(node, taken));
    void run(async () => {
      await (node.kind === "folder"
        ? vault.folders.copy(node.path, to)
        : vault.notes.copy(node.path, to));
      remember({
        kind: "copy",
        source: node.path,
        path: to,
        folder: node.kind === "folder",
      });
      setSelected(to);
      if (folder !== "") expand(folder);
    });
  }

  const canPaste =
    clipboard !== null &&
    (clipboard.mode === "cut"
      ? canMove(clipboard.path, targetFolder)
      : !isWithin(targetFolder, clipboard.path));

  function commitEdit(text: string) {
    const current = edit;
    const name = text.trim();
    setEdit(null);
    if (current === null || name === "") return;
    if (/[\\/]/.test(name)) {
      setError(t("tree.badName"));
      return;
    }

    if (current.kind === "new") {
      const isNote = current.what === "note";
      const path = joinPath(current.parent, isNote ? withMd(name) : name);
      void run(async () => {
        if (isNote) await vault.notes.create(path);
        else await vault.folders.create(path);
        setSelected(path);
        if (isNote) active.open(path);
      });
      return;
    }

    const node = tree === null ? undefined : findNode(tree, current.path);
    if (node === undefined) return;
    const to = joinPath(
      parentOf(node.path),
      node.kind === "note" ? withMd(name) : name,
    );
    if (to === node.path) return;
    void run(async () => {
      await rename(node, to);
      follow(node.path, to);
      remember({
        kind: "move",
        from: node.path,
        to,
        folder: node.kind === "folder",
      });
    });
  }

  /** Does `change` again (`forward`) or takes it back. */
  async function apply(change: Undoable, forward: boolean): Promise<void> {
    if (change.kind === "move") {
      const [from, to] = forward
        ? [change.from, change.to]
        : [change.to, change.from];
      await (change.folder
        ? vault.folders.rename(from, to)
        : vault.notes.rename(from, to));
      follow(from, to);
      if (parentOf(to) !== "") expand(parentOf(to));
    } else if (forward) {
      await (change.folder
        ? vault.folders.copy(change.source, change.path)
        : vault.notes.copy(change.source, change.path));
      setSelected(change.path);
      if (parentOf(change.path) !== "") expand(parentOf(change.path));
    } else {
      // To the system trash, not for good: the copy can still be got back.
      await (change.folder
        ? vault.folders.remove(change.path)
        : vault.notes.remove(change.path));
      forget(change.path);
    }
  }

  /** Takes back the last change ("undo"), or does again the last taken back. */
  function step(direction: "undo" | "redo") {
    const history = changes.current;
    const change = history[direction].at(-1);
    if (change === undefined) return;
    // Taken off first: a change that cannot be redone or undone, as one
    // whose entry was moved or deleted since, must not stand in the way
    // of the ones before it. The failure is told as any other.
    history[direction] = history[direction].slice(0, -1);
    syncHistory();
    void run(async () => {
      await apply(change, direction === "redo");
      const other = direction === "undo" ? "redo" : "undo";
      history[other] = [...history[other], change].slice(-UNDO_LIMIT);
      syncHistory();
    });
  }

  return {
    loading: tree === null,
    rows,
    selected,
    selectedIndex,
    activePath: shownActive,
    edit,
    cut: clipboard?.mode === "cut" ? clipboard.path : null,
    canPaste,
    canMoveToRoot:
      selectedNode !== undefined && parentOf(selectedNode.path) !== "",
    error,
    trashFailure,

    isExpanded: (path) => expanded.has(path),
    select: setSelected,
    activate(node, newTab = false) {
      setSelected(node.path);
      // A note opens in the editor, an image in a view of its own.
      if (node.kind === "note" || imageTypeOf(node.path) !== null) {
        active.open(node.path, { target: newTab ? "newTab" : "here" });
      } else if (node.kind === "folder") {
        if (expanded.has(node.path)) collapse(node.path);
        else expand(node.path);
      }
    },
    step(delta) {
      const nodes = rows.filter((row) => row.kind === "node");
      if (nodes.length === 0) return;
      const index = nodes.findIndex((row) => row.node.path === selected);
      const next =
        index === -1
          ? delta > 0
            ? 0
            : nodes.length - 1
          : Math.min(nodes.length - 1, Math.max(0, index + delta));
      setSelected(nodes[next].node.path);
    },
    expandOrEnter() {
      if (selectedNode?.kind !== "folder") return;
      if (!expanded.has(selectedNode.path)) expand(selectedNode.path);
      else if (selectedNode.children.length > 0) {
        setSelected(selectedNode.children[0].path);
      }
    },
    collapseOrLeave() {
      if (selectedNode === undefined) return;
      if (selectedNode.kind === "folder" && expanded.has(selectedNode.path)) {
        collapse(selectedNode.path);
      } else if (parentOf(selectedNode.path) !== "") {
        setSelected(parentOf(selectedNode.path));
      }
    },

    startNew(what) {
      if (targetFolder !== "") expand(targetFolder);
      setEdit({ kind: "new", what, parent: targetFolder });
    },
    startRename() {
      if (selectedNode) setEdit({ kind: "rename", path: selectedNode.path });
    },
    commitEdit,
    cancelEdit: () => setEdit(null),

    remove() {
      const node = selectedNode;
      if (node === undefined) return;
      void run(async () => {
        try {
          await removeNode(node, false);
        } catch (reason) {
          setTrashFailure({ path: node.path, message: messageOf(reason) });
          return;
        }
        forget(node.path);
      });
    },
    removeForGood() {
      const node =
        trashFailure === null || tree === null
          ? undefined
          : findNode(tree, trashFailure.path);
      if (node === undefined) {
        setTrashFailure(null);
        return;
      }
      void run(async () => {
        await removeNode(node, true);
        forget(node.path);
      });
    },
    dismiss() {
      setError(null);
      setTrashFailure(null);
    },

    canMove,
    move,
    cutSelected() {
      if (selectedNode) setClipboard({ path: selectedNode.path, mode: "cut" });
    },
    copySelected() {
      if (selectedNode) setClipboard({ path: selectedNode.path, mode: "copy" });
    },
    paste() {
      if (clipboard === null || !canPaste) return;
      if (clipboard.mode === "cut") move(clipboard.path, targetFolder);
      else copy(clipboard.path, targetFolder);
    },
    moveToRoot() {
      if (selectedNode) move(selectedNode.path, "");
    },
    cancelCut: () => setClipboard(null),
    canUndo,
    undo: () => step("undo"),
    canRedo,
    redo: () => step("redo"),
  };
}

/** The visible lines of the tree, top to bottom. */
function flatten(
  tree: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  edit: TreeEdit | null,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const add = (nodes: readonly TreeNode[], folder: string, depth: number) => {
    if (edit?.kind === "new" && edit.parent === folder) {
      rows.push({ kind: "new", what: edit.what, depth });
    }
    for (const node of nodes) {
      rows.push({ kind: "node", node, depth });
      if (node.kind === "folder" && expanded.has(node.path)) {
        add(node.children, node.path, depth + 1);
      }
    }
  };
  add(tree, "", 0);
  return rows;
}

/** `expanded` plus every folder above `path`. */
function withParents(
  expanded: ReadonlySet<string>,
  path: string,
): ReadonlySet<string> {
  const next = new Set(expanded);
  for (let p = parentOf(path); p !== ""; p = parentOf(p)) next.add(p);
  return next.size === expanded.size ? expanded : next;
}

/**
 * The name of `node`, or, if it is taken (`taken` holds lower-case names),
 * the first free one with a number before the ending: "Note 1.md",
 * "Photo 2.png", "Folder 1".
 */
function freeName(node: TreeNode, taken: ReadonlySet<string>): string {
  if (!taken.has(node.name.toLowerCase())) return node.name;
  const ending =
    node.kind === "folder" ? "" : (/(?<=.)\.[^.]+$/.exec(node.name)?.[0] ?? "");
  const base = node.name.slice(0, node.name.length - ending.length);
  for (let n = 1; ; n++) {
    const name = `${base} ${n}${ending}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** A note is a `.md` file, so the user does not have to type the ending. */
function withMd(name: string): string {
  return /\.md$/i.test(name) ? name : `${name}.md`;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** How a tree entry is shown: a note without its `.md`. */
export function labelOf(node: TreeNode): string {
  return node.kind === "note" ? node.name.replace(/\.md$/i, "") : node.name;
}
