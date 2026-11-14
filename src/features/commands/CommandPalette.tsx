import { useEffect, useRef, type KeyboardEvent } from "react";
import { Highlighted } from "../search/Highlighted";
import type { CommandPalette as Palette } from "./use-command-palette";

/**
 * The command palette dialog. The arrow keys choose a command, Enter runs
 * it, Escape or a click outside closes the palette.
 */
export function CommandPalette({ palette }: { palette: Palette }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { query, setQuery, items, selected, select, run } = palette;

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

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = items.length;
    if (event.key === "ArrowDown" && count > 0) select((selected + 1) % count);
    else if (event.key === "ArrowUp" && count > 0) {
      select((selected - 1 + count) % count);
    } else if (event.key === "Enter" && count > 0) run(items[selected].command);
    else return;
    event.preventDefault();
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Command palette"
      className="mx-auto mt-[15vh] w-full max-w-[560px] overflow-hidden rounded-lg border border-line bg-bg text-ui text-fg shadow-dialog backdrop:bg-backdrop/40"
      onCancel={(event) => {
        event.preventDefault();
        palette.close();
      }}
      // A click on the backdrop lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) palette.close();
      }}
    >
      <input
        autoFocus
        type="text"
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls="palette-list"
        aria-activedescendant={
          items.length > 0 ? `palette-row-${selected}` : undefined
        }
        aria-label="Run a command"
        placeholder="Run a command"
        spellCheck={false}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full border-b border-line bg-bg px-3 outline-none"
      />
      {items.length === 0 ? (
        <p className="px-3 py-2 text-small text-faint">No commands found</p>
      ) : (
        <ul
          id="palette-list"
          ref={list}
          role="listbox"
          aria-label="Commands"
          className="max-h-[50vh] overflow-auto py-1"
        >
          {items.map(({ command, matches }, index) => (
            <li
              key={command.id}
              id={`palette-row-${index}`}
              role="option"
              aria-selected={index === selected}
              className={`flex w-full items-baseline gap-2 px-3 py-1 ${
                index === selected ? "bg-selected" : "hover:bg-raise"
              }`}
              onMouseMove={() => select(index)}
              onClick={() => run(command)}
            >
              <span className="min-w-0 flex-1 truncate">
                <Highlighted
                  text={command.title}
                  ranges={matches}
                  className="bg-transparent font-semibold text-fg"
                />
              </span>
              {command.shortcut !== undefined && (
                <kbd className="shrink-0 font-sans text-small text-faint">
                  {command.shortcut}
                </kbd>
              )}
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
