import { Menu } from "@base-ui/react/menu";
import type { ReactNode } from "react";
import { Shortcut } from "../commands/Shortcut";
import { useT, type MessageKey } from "../i18n/i18n";
import { useShortcutLabel } from "../shortcuts/shortcuts";
import { Tooltip } from "../ui/Tooltip";
import type { NoteMode } from "./use-note-mode";

/** The shapes of the icon of each mode, drawn on 16 by 16. */
const icons: Record<NoteMode, ReactNode> = {
  // Code brackets.
  source: (
    <path d="M5 4.5 1.5 8 5 11.5M11 4.5 14.5 8 11 11.5M9.25 2.75l-2.5 10.5" />
  ),
  // A pencil.
  live: (
    <path d="M10.5 2.75l2.75 2.75L5.5 13.25H2.75V10.5zM8.75 4.5l2.75 2.75" />
  ),
  // An open book.
  reading: (
    <path d="M8 4.25C6.5 3.1 4.5 2.75 1.75 2.75v9.75c2.75 0 4.75.35 6.25 1.5 1.5-1.15 3.5-1.5 6.25-1.5V2.75C11.5 2.75 9.5 3.1 8 4.25zM8 4.25V14" />
  ),
};

const labels: Record<NoteMode, MessageKey> = {
  source: "editor.source",
  live: "editor.live",
  reading: "editor.read",
};

const MODES: readonly NoteMode[] = ["source", "live", "reading"];

function Icon({ mode, className }: { mode: NoteMode; className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[mode]}
    </svg>
  );
}

const item =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 whitespace-nowrap outline-none select-none data-highlighted:bg-raise";

/**
 * The mode of the note, in the bar above it: a button with the icon of
 * the mode it is in, and a menu of the three to choose another.
 */
export function NoteModeMenu({
  mode,
  onChange,
}: {
  mode: NoteMode;
  onChange: (mode: NoteMode) => void;
}) {
  const t = useT();
  const shortcuts: Record<NoteMode, string | undefined> = {
    source: useShortcutLabel("editor.sourceMode"),
    live: undefined,
    reading: useShortcutLabel("editor.readingMode"),
  };

  return (
    <Menu.Root>
      <Tooltip label={t("editor.mode")}>
        <Menu.Trigger
          aria-label={`${t("editor.mode")}: ${t(labels[mode])}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-100 hover:bg-selected hover:text-fg data-popup-open:bg-selected data-popup-open:text-fg"
        >
          <Icon mode={mode} className="size-5" />
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 outline-none"
        >
          <Menu.Popup
            // Not back to the button: closed by Escape, base-ui would draw
            // its focus ring on it.
            finalFocus={false}
            className="w-max min-w-56 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none"
          >
            <Menu.RadioGroup
              value={mode}
              onValueChange={(value: NoteMode) => onChange(value)}
            >
              {MODES.map((value) => (
                <Menu.RadioItem key={value} value={value} className={item}>
                  <Icon mode={value} className="size-4.5 shrink-0 text-muted" />
                  <span className="flex-1">{t(labels[value])}</span>
                  {shortcuts[value] !== undefined && (
                    <Shortcut text={shortcuts[value]} />
                  )}
                  {/* As wide whether checked or not, so the items line up. */}
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <svg
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </Menu.RadioItemIndicator>
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
