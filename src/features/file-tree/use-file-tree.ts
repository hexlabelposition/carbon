import type { TreeNode, Vault } from "@carbon/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { findNode, isWithin, joinPath, parentOf, rebase } from "../vault/paths";
import { useWorkspace } from "../workspace/workspace";

/** What is being typed into the tree: a new name, or a name for a new item. */
export type TreeEdit =
  | { kind: "rename"; path: string }
  | { kind: "new"; what: "note" | "folder"; parent: string };

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
  /** The last thing that went wrong, in words for the user. */
  error: string | null;
  /** Set when moving to the trash failed: the user may delete for good. */
  trashFailure: { path: string; message: string } | null;

  isExpanded(path: string): boolean;
  select(path: string): void;
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
  /** Moves the cut entry into the folder of the selection. */
  paste(): void;
  cancelCut(): void;
}

/** Everything the file tree does; the component only shows it. */
export function useFileTree(vault: Vault): FileTree {
  const active = useWorkspace();
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(active.path);
  const [edit, setEdit] = useState<TreeEdit | null>(null);
  const [cut, setCut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trashFailure, setTrashFailure] =
    useState<FileTree["trashFailure"]>(null);
  /** Raised to list the vault again: after a change, here or outside. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => vault.on("changed", () => setVersion((v) => v + 1)), [vault]);

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

  // Show the open note: its folders are opened and it becomes the selection.
  // Runs when another note is opened, not when the user closes a folder.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (active.path === null || active.path === shown.current) return;
    shown.current = active.path;
    const path = active.path;
    setSelected(path);
    setExpanded((current) => withParents(current, path));
  }, [active.path]);

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

  /** Runs a change to the vault, reports a failure, then lists it again. */
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
    reload();
  }

  /** Keeps everything that points at `from` pointing at it after a move. */
  function follow(from: string, to: string) {
    const moved = (path: string) =>
      isWithin(path, from) ? rebase(path, from, to) : path;
    setExpanded((current) => new Set([...current].map(moved)));
    setSelected((current) => (current === null ? null : moved(current)));
    setCut(null);
    active.moved(from, to);
  }

  function forget(path: string) {
    setExpanded(
      (current) => new Set([...current].filter((p) => !isWithin(p, path))),
    );
    setSelected((current) =>
      current !== null && isWithin(current, path) ? null : current,
    );
    setCut((current) =>
      current !== null && isWithin(current, path) ? null : current,
    );
    active.removed(path);
  }

  function rename(node: TreeNode, to: string): Promise<void> {
    return node.kind === "folder"
      ? vault.folders.rename(node.path, to)
      : vault.notes.rename(node.path, to);
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
      if (folder !== "") expand(folder);
    });
  }

  function commitEdit(text: string) {
    const current = edit;
    const name = text.trim();
    setEdit(null);
    if (current === null || name === "") return;
    if (/[\\/]/.test(name)) {
      setError("A name cannot contain / or \\");
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
    });
  }

  return {
    loading: tree === null,
    rows,
    selected,
    selectedIndex,
    activePath: active.path,
    edit,
    cut,
    error,
    trashFailure,

    isExpanded: (path) => expanded.has(path),
    select: setSelected,
    activate(node, newTab = false) {
      setSelected(node.path);
      if (node.kind === "note") active.open(node.path, { newTab });
      else if (node.kind === "folder") {
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
    cutSelected: () => setCut(selectedNode?.path ?? null),
    paste() {
      if (cut !== null) move(cut, targetFolder);
    },
    cancelCut: () => setCut(null),
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
