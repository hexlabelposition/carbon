import type { NotePath, TagNode } from "@carbon/core";
import { useT } from "../i18n/i18n";
import type { TagsView } from "./use-tags";

interface TagsPanelProps {
  tags: TagsView;
  /** Opens a note, in a new tab if `newTab`. */
  onOpen: (path: NotePath, newTab: boolean) => void;
}

/** Pixels a nested tag is moved in by, as in the file tree. */
const INDENT = 14;

/**
 * The tags of the vault as a tree, each with the number of its notes. A
 * click on a tag lists its notes below the tree, those of the tags nested
 * in it too; a click on the arrow shows or hides the nested tags.
 */
export function TagsPanel({ tags, onOpen }: TagsPanelProps) {
  const t = useT();
  const { tree } = tags;
  if (tree.status === "loading") return null;
  if (tree.status === "error") {
    return (
      <p className="px-3 py-2 text-small text-danger">
        {t("tags.failed", { reason: tree.message })}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto py-1">
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
              <TagRow key={node.tag} node={node} depth={0} tags={tags} />
            ))}
          </ul>
        )}
      </div>
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
  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={nested ? open : undefined}
    >
      <div
        className={`flex h-6 items-center gap-1 pr-3 ${
          selected ? "bg-selected text-fg" : "text-muted hover:bg-raise"
        }`}
        style={{ paddingLeft: depth * INDENT + 6 }}
      >
        <button
          type="button"
          tabIndex={nested ? 0 : -1}
          aria-label={t("tags.toggle", { tag: node.tag })}
          className={`flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-selected ${
            nested ? "" : "invisible"
          }`}
          onClick={() => tags.toggle(node.tag)}
        >
          <Chevron open={open} />
        </button>
        <button
          type="button"
          title={`#${node.tag}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-fg"
          onClick={() => tags.select(selected ? null : node.tag)}
        >
          <span className="truncate">{node.name}</span>
          <span className="ml-auto shrink-0 text-small text-faint">
            {node.count}
          </span>
        </button>
      </div>
      {open && (
        <ul role="group">
          {node.children.map((child) => (
            <TagRow
              key={child.tag}
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
        <span className="truncate text-small font-semibold" title={`#${tag}`}>
          {t("tags.notesOf", { tag })}
        </span>
        <button
          type="button"
          aria-label={t("common.close")}
          title={t("common.close")}
          className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-sm text-faint hover:bg-raise hover:text-fg"
          onClick={() => tags.select(null)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
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
                <button
                  type="button"
                  title={path}
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
      className={`size-3 text-faint ${open ? "rotate-90" : ""}`}
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
