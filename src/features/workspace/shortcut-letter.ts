/**
 * The Latin letter a key press stands for in a shortcut such as Ctrl+O,
 * or `null` if it is not a letter key.
 *
 * The letter the layout types, if it is a Latin one: Ctrl+O is where O is
 * on AZERTY or Dvorak. With a layout of another script, such as Russian,
 * the key types "щ" there, so the key is taken by its place on a US
 * keyboard instead, as other apps do.
 */
export function shortcutLetter(event: {
  key: string;
  code: string;
}): string | null {
  const key = event.key.toLowerCase();
  if (/^[a-z]$/.test(key)) return key;
  return /^Key([A-Z])$/.exec(event.code)?.[1].toLowerCase() ?? null;
}
