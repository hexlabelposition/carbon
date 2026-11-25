import { ContextMenu } from "@base-ui/react/context-menu";
import type { NotePath, TagNode } from "@carbon/core";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { NameInput } from "../file-tree/NameInput";
import { useT } from "../i18n/i18n";
import type { TagsView } from "./use-tags";
import { Tooltip } from "../ui/Tooltip";

interface TagsPanelProps {
  tags: TagsView;
  /** Opens a note, in a new tab if `newTab`. */
  onOpen: (path: NotePath, newTab: boolean) => void;
}

/** Pixels a nested tag is moved in by, as in the file tree. */
const INDENT = 14;

const menuItem =
  "flex h-7 cursor-default items-center justify-between gap-6 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise";

/**
 * The tags of the vault as a tree, each with the number of its notes. A
 * click on a tag lists its notes below the tree, those of the tags nested
 * in it too; a click on the arrow shows or hides the nested tags. The
 * right button, or F2, renames a tag in every note.
 */
export function TagsPanel({ tags, onOpen }: TagsPanelProps) {
  const t = useT();
  const { tree } = tags;
  /** The tag the menu of the right button is for. */
  const [menuTag, setMenuTag] = useState<string | null>(null);
  /** Rename from the menu: started once the menu is shut and gives up
   * the focus, or the field would lose it at once. */
  const pendingRename = useRef<string | null>(null);
  if (tree.status === "loading") return null;
  if (tree.status === "error") {
    return (
      <p className="px-3 py-2 text-small text-danger">
        {t("tags.failed", { reason: tree.message })}
      </p>
    );
  }

  function onContextMenu(event: MouseEvent<HTMLDivElement>) {
    const row =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-tag]")
        : null;
    setMenuTag(row?.dataset.tag ?? null);
    pendingRename.current = null;
  }

  return (
    <div className="flex h-full flex-col">
      {tags.renameError !== null && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2 text-small text-danger"
        >
          <p className="min-w-0 flex-1">{tags.renameError}</p>
          <button
            type="button"
            className="shrink-0 text-faint hover:text-fg"
            onClick={tags.dismissRenameError}
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}
      <ContextMenu.Root
        onOpenChangeComplete={(open) => {
          const tag = pendingRename.current;
          pendingRename.current = null;
          if (!open && tag !== null) setTimeout(() => tags.startRename(tag), 0);
        }}
      >
        <ContextMenu.Trigger
          className="min-h-0 flex-1 overflow-auto py-1"
          onContextMenu={onContextMenu}
        >
          {tree.partial && (
            <p role="status" className="px-3 pb-1 text-small text-faint">
              {t("tags.partial")}
            </p>
          )}
          {tree.tags.length === 0 ? (
            <p className="px-3 py-1 text-small text-faint">{t("tags.empty")}</p>
          ) : (
            <ul role="tree" aria-label={t("shell.tags")}>
              {tree.tags.map((node) => (
                <TagRow
                  key={node.tag.toLowerCase()}
                  node={node}
                  depth={0}
                  tags={tags}
                />
              ))}
            </ul>
          )}
        </ContextMenu.Trigger>
        {menuTag !== null && (
          <ContextMenu.Portal>
            <ContextMenu.Positioner className="z-50 outline-none">
              <ContextMenu.Popup
                finalFocus={() => pendingRename.current === null}
                className="min-w-44 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none"
              >
                <ContextMenu.Item
                  className={menuItem}
                  onClick={() => {
                    pendingRename.current = menuTag;
                  }}
                >
                  {t("tags.rename")}
                  <span className="text-small text-faint">F2</span>
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        )}
      </ContextMenu.Root>
      {tags.selected !== null && (
        <TagNotes tag={tags.selected} tags={tags} onOpen={onOpen} />
      )}
    </div>
  );
}

function TagRow({
  node,
  depth,
  tags,
}: {
  node: TagNode;
  depth: number;
  tags: TagsView;
}) {
  const t = useT();
  const nested = node.children.length > 0;
  const open = nested && tags.isExpanded(node.tag);
  const selected = tags.selected?.toLowerCase() === node.tag.toLowerCase();
  const renaming = tags.renaming === node.tag;
  const name = useRef<HTMLButtonElement>(null);
  const { focusTag, focused } = tags;
  const takesFocus =
    !renaming && focusTag?.toLowerCase() === node.tag.toLowerCase();
  useEffect(() => {
    if (!takesFocus || name.current === null) return;
    name.current.focus();
    focused();
  }, [takesFocus, focused]);
  return (
    <li
      data-tag={node.tag}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={nested ? open : undefined}
    >
      <div
        // The focus shows on the whole row, as the selection in the file tree.
        className={`flex h-6 items-center gap-1 pr-3 has-focus-ring:outline-1 has-focus-ring:-outline-offset-1 has-focus-ring:outline-line-strong ${
          selected ? "bg-selected text-fg" : "text-muted hover:bg-raise"
        }`}
        style={{ paddingLeft: depth * INDENT + 6 }}
      >
        <button
          type="button"
          tabIndex={nested ? 0 : -1}
          aria-label={t("tags.toggle", { tag: node.tag })}
          className={`flex size-4 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-selected ${
            nested ? "" : "invisible"
          }`}
          onClick={() => tags.toggle(node.tag)}
        >
          <Chevron open={open} />
        </button>
        {renaming ? (
          // The whole tag: renaming can move it under another one too.
          <NameInput
            label={t("tags.newName", { tag: node.tag })}
            initial={node.tag}
            onCommit={(text) => tags.commitRename(node.tag, text)}
            onCancel={tags.cancelRename}
          />
        ) : (
          <Tooltip label={`#${node.tag}`}>
            <button
              ref={name}
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none hover:text-fg"
              onClick={() => tags.select(selected ? null : node.tag)}
              onKeyDown={(event) => {
                if (event.key === "F2") {
                  event.preventDefault();
                  tags.startRename(node.tag);
                }
              }}
            >
              <span className="truncate">{node.name}</span>
              <span className="ml-auto shrink-0 text-small text-faint tabular-nums">
                {node.count}
              </span>
            </button>
          </Tooltip>
        )}
      </div>
      {open && (
        <ul role="group">
          {node.children.map((child) => (
            <TagRow
              // By the tag as the index matches it: a new spelling from
              // the index keeps the row, and the focus in it.
              key={child.tag.toLowerCase()}
              node={child}
              depth={depth + 1}
              tags={tags}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The notes of the picked tag, below the tree. */
function TagNotes({
  tag,
  tags,
  onOpen,
}: {
  tag: string;
  tags: TagsView;
  onOpen: (path: NotePath, newTab: boolean) => void;
}) {
  const t = useT();
  const { notes } = tags;
  return (
    <section
      aria-label={t("tags.notesOf", { tag })}
      className="flex max-h-[50%] shrink-0 flex-col border-t border-line"
    >
      <div className="flex h-7 shrink-0 items-center gap-2 pr-1 pl-3">
        <Tooltip label={`#${tag}`}>
          <span className="truncate text-small font-semibold">
            {t("tags.notesOf", { tag })}
          </span>
        </Tooltip>
        <Tooltip label={t("common.close")}>
          <button
            type="button"
            aria-label={t("common.close")}
            className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-sm text-faint hover:bg-raise hover:text-fg"
            onClick={() => tags.select(null)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-1">
        {notes.status === "error" ? (
          <p className="px-3 py-1 text-small text-danger">
            {t("tags.failed", { reason: notes.message })}
          </p>
        ) : notes.status === "ready" && notes.notes.length === 0 ? (
          <p className="px-3 py-1 text-small text-faint">{t("tags.noNotes")}</p>
        ) : notes.status === "ready" ? (
          <ul>
            {notes.notes.map((path) => (
              <li key={path}>
                <Tooltip label={path}>
                  <button
                    type="button"
                    className="block w-full truncate px-3 py-0.5 text-left text-muted hover:bg-raise hover:text-fg"
                    onClick={(event) =>
                      onOpen(path, event.ctrlKey || event.metaKey)
                    }
                    onAuxClick={(event) => {
                      // The middle button opens a note in a new tab.
                      if (event.button === 1) onOpen(path, true);
                    }}
                  >
                    {titleOf(path)}
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-3.5 text-faint ${open ? "rotate-90" : ""}`}
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

/** The name of a note without its folder and `.md`. */
function titleOf(path: NotePath): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}
