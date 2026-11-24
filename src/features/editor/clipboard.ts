import { createContext, useContext } from "react";

/** The text of the system clipboard, for cut, copy and paste in a menu. */
export interface TextClipboard {
  /** The text on the clipboard; "" if it holds none. */
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

/** The one of the page, for a browser pointed at the dev server. */
const pageClipboard: TextClipboard = {
  readText: () => navigator.clipboard.readText().catch(() => ""),
  writeText: (text) => navigator.clipboard.writeText(text),
};

/** The clipboard the app gives the editor; the page's without one. */
export const ClipboardContext = createContext<TextClipboard>(pageClipboard);

export function useClipboard(): TextClipboard {
  return useContext(ClipboardContext);
}
