import { shortcutLetter } from "../workspace/shortcut-letter";

/**
 * A combination of keys as it is stored and compared: modifiers, then the
 * key, joined by "+", such as "Mod+Shift+F". "Mod" is Ctrl, or Cmd on a
 * Mac; "Ctrl" is written only on a Mac, where it is another key.
 */
export type Binding = string;

/** Keys that are not letters, by their place on a US keyboard. */
const CODE_KEYS: Readonly<Record<string, string>> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Tab: "Tab",
  Enter: "Enter",
  Space: "Space",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

interface KeyPress {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * The key of a press, without its modifiers: a letter as `shortcutLetter`
 * finds it, so Ctrl+O works on any layout; any other key by its place, as
 * "`" for the key left of 1, which types "ё" on a Russian layout. `null`
 * for a modifier alone and for keys a shortcut does not use.
 */
function keyOf(press: KeyPress): string | null {
  const letter = shortcutLetter(press);
  if (letter !== null) return letter.toUpperCase();
  const { code } = press;
  if (/^Digit\d$/.test(code)) return code.slice("Digit".length);
  if (/^F\d{1,2}$/.test(code)) return code;
  return CODE_KEYS[code] ?? null;
}

/**
 * The binding a key press makes, or `null` if it makes none: a modifier
 * alone, or the Windows key elsewhere than on a Mac.
 */
export function bindingOf(press: KeyPress, mac: boolean): Binding | null {
  const key = keyOf(press);
  if (key === null) return null;
  if (!mac && press.metaKey) return null;
  const parts: string[] = [];
  if (mac ? press.metaKey : press.ctrlKey) parts.push("Mod");
  if (mac && press.ctrlKey) parts.push("Ctrl");
  if (press.altKey) parts.push("Alt");
  if (press.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

/**
 * Whether a binding may be a shortcut of the app: with Ctrl, Cmd or Alt,
 * or a function key. Without them the key would be taken from typing.
 */
export function canBind(binding: Binding): boolean {
  const parts = binding.split("+");
  const key = parts[parts.length - 1];
  return (
    /^F\d{1,2}$/.test(key) ||
    parts.some((part) => part === "Mod" || part === "Ctrl" || part === "Alt")
  );
}
