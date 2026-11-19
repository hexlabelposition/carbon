import { useEffect, useRef, type KeyboardEvent } from "react";
import { useT } from "../i18n/i18n";
import { Highlighted } from "../search/Highlighted";
import { SCROLLBAR_ROOM, ScrollArea } from "../ui/ScrollArea";
import { Shortcut } from "./Shortcut";
import type { CommandPalette as Palette } from "./use-command-palette";
import { AppDialog } from "../dialogs/AppDialog";

/**
 * The command palette dialog. The arrow keys choose a command, Enter runs
 * it, Escape or a click outside closes the palette.
 */
export function CommandPalette({ palette }: { palette: Palette }) {
  const t = useT();
  const list = useRef<HTMLUListElement>(null);
  const { query, setQuery, items, selected, select, run } = palette;

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
    <AppDialog
      aria-label={t("palette.label")}
      onClose={palette.close}
      className="fixed inset-x-0 top-[15vh] mx-auto w-full max-w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
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
        aria-label={t("palette.placeholder")}
        placeholder={t("palette.placeholder")}
        spellCheck={false}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full border-b border-line bg-bg px-3 outline-none"
      />
      {items.length === 0 ? (
        <p className="px-3 py-2 text-small text-faint">{t("palette.empty")}</p>
      ) : (
        <ScrollArea className="max-h-[50vh]">
          <ul
            id="palette-list"
            ref={list}
            role="listbox"
            aria-label={t("palette.commands")}
            className={`py-1 ${SCROLLBAR_ROOM}`}
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
                  <Shortcut text={command.shortcut} />
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </AppDialog>
  );
}
