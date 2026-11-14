import { useEffect, useRef, type KeyboardEvent } from "react";
import { Highlighted } from "../search/Highlighted";
import type { QuickSwitcher as Switcher } from "./use-quick-switcher";

/**
 * The quick switcher dialog. The arrow keys choose a row, Enter opens it,
 * Ctrl+Enter opens it in a new tab, Shift+Enter makes a note named as
 * typed even when others match. Escape or a click outside closes it.
 */
export function QuickSwitcher({ switcher }: { switcher: Switcher }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { query, setQuery, hits, newNote, selected, select, error } = switcher;
  const rows = hits.length + (newNote === null ? 0 : 1);

  // A modal `<dialog>` keeps the focus inside and closes on Escape.
  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function activate(index: number, newTab: boolean) {
    if (index < hits.length) switcher.choose(hits[index], newTab);
    else switcher.create(newTab);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const command = event.ctrlKey || event.metaKey;
    if (event.key === "ArrowDown" && rows > 0) select((selected + 1) % rows);
    else if (event.key === "ArrowUp" && rows > 0) {
      select((selected - 1 + rows) % rows);
    } else if (event.key === "Enter" && event.shiftKey)
      switcher.create(command);
    else if (event.key === "Enter" && rows > 0) activate(selected, command);
    else return;
    event.preventDefault();
  }

  const row = (index: number) =>
    `flex w-full items-baseline gap-2 px-3 py-1 text-left ${
      index === selected ? "bg-selected" : "hover:bg-raise"
    }`;

  return (
    <dialog
      ref={dialog}
      aria-label="Quick switcher"
      className="mx-auto mt-[15vh] w-full max-w-[560px] overflow-hidden rounded-lg border border-line bg-bg text-ui text-fg shadow-dialog backdrop:bg-backdrop/40"
      onCancel={(event) => {
        event.preventDefault();
        switcher.close();
      }}
      // A click on the backdrop lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) switcher.close();
      }}
    >
      <input
        autoFocus
        type="text"
        role="combobox"
        aria-expanded={rows > 0}
        aria-controls="switcher-list"
        aria-activedescendant={
          rows > 0 ? `switcher-row-${selected}` : undefined
        }
        aria-label="Find or create a note"
        placeholder="Find or create a note"
        spellCheck={false}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full border-b border-line bg-bg px-3 outline-none"
      />
      {error !== null && (
        <p role="alert" className="px-3 py-1.5 text-small text-danger">
          The note could not be created: {error}
        </p>
      )}
      {rows > 0 && (
        <ul
          id="switcher-list"
          ref={list}
          role="listbox"
          aria-label="Notes"
          className="max-h-[50vh] overflow-auto py-1"
        >
          {hits.map((hit, index) => (
            <li
              key={hit.path}
              id={`switcher-row-${index}`}
              role="option"
              aria-selected={index === selected}
              className={row(index)}
              onMouseMove={() => select(index)}
              onClick={(event) =>
                activate(index, event.ctrlKey || event.metaKey)
              }
            >
              <span className="min-w-0 shrink truncate">
                <Highlighted
                  text={hit.title}
                  ranges={hit.matches}
                  className="bg-transparent font-semibold text-fg"
                />
              </span>
              {hit.path.includes("/") && (
                <span className="min-w-0 flex-1 truncate text-right text-small text-faint">
                  {hit.path.slice(0, hit.path.lastIndexOf("/"))}
                </span>
              )}
            </li>
          ))}
          {newNote !== null && (
            <li
              id={`switcher-row-${hits.length}`}
              role="option"
              aria-selected={selected === hits.length}
              className={row(hits.length)}
              onMouseMove={() => select(hits.length)}
              onClick={(event) =>
                switcher.create(event.ctrlKey || event.metaKey)
              }
            >
              <span className="text-muted">Create</span>
              <span className="min-w-0 truncate">{newNote}</span>
              <span className="ml-auto shrink-0 text-small text-faint">
                Shift+Enter
              </span>
            </li>
          )}
        </ul>
      )}
    </dialog>
  );
}
