import type { ReactNode } from "react";
import { BOOKMARK } from "../bookmarks/bookmark-icon";

/** The icons of the items of the menus, drawn on 16 by 16 as the toolbar. */
export const menuIcons = {
  // An arrow going back round to the left.
  undo: <path d="M5 3 2.5 5.5 5 8M2.5 5.5h7a4 4 0 0 1 0 8H6" />,
  redo: <path d="M11 3l2.5 2.5L11 8M13.5 5.5h-7a4 4 0 0 0 0 8H10" />,
  // Scissors.
  cut: (
    <>
      <circle cx="4.25" cy="11.75" r="2" />
      <circle cx="11.75" cy="11.75" r="2" />
      <path d="M5.6 10.3 12 1.75M10.4 10.3 4 1.75" />
    </>
  ),
  // Two pages, one over the other.
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.5" />
      <path d="M3.5 10.5h-.5A1 1 0 0 1 2 9.5V3a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1v.5" />
    </>
  ),
  // A clipboard.
  paste: (
    <>
      <path d="M5.5 2.75H4a1 1 0 0 0-1 1v9.75a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3.75a1 1 0 0 0-1-1h-1.5" />
      <rect x="5.5" y="1.5" width="5" height="2.5" rx="0.75" />
    </>
  ),
  // A frame of dashes round the text.
  selectAll: (
    <>
      <path d="M2 4.5V3a1 1 0 0 1 1-1h1.5M11.5 2H13a1 1 0 0 1 1 1v1.5M14 11.5V13a1 1 0 0 1-1 1h-1.5M4.5 14H3a1 1 0 0 1-1-1v-1.5M7 2h2M7 14h2M2 7v2M14 7v2" />
      <path d="M5.5 6h5M5.5 8h5M5.5 10h3" />
    </>
  ),
  // An arrow out of a box: to another app.
  openLink: (
    <path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
  ),
  // Two links of a chain.
  link: (
    <path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2.1-2.1a2.75 2.75 0 0 0-3.9-3.9l-.6.6M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2.1 2.1a2.75 2.75 0 0 0 3.9 3.9l.6-.6" />
  ),
  // An envelope.
  email: (
    <>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="m2 4 6 5 6-5" />
    </>
  ),
  // The brackets of code.
  code: <path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" />,
  // A line of text with the cursor at its end.
  codeLine: <path d="M2 8h8.5M13 4.5v7M2 4.5h4M2 11.5h6" />,
  // A tab: a page with the corner of a new one beside it.
  newTab: (
    <>
      <rect x="1.5" y="3.5" width="10" height="10" rx="1.5" />
      <path d="M4.5 1.5h9a1 1 0 0 1 1 1v9M6.5 6.5v4M4.5 8.5h4" />
    </>
  ),
  newNote: (
    <>
      <path d="M8.5 14.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5h5l3.5 3.5v3" />
      <path d="M9 1.5V5h3.5M12.5 10.5v4M10.5 12.5h4" />
    </>
  ),
  newFolder: (
    <path d="M7.5 13H3a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13a1.5 1.5 0 0 1 1.5 1.5v2M12.5 9.5v5M10 12h5" />
  ),
  bookmark: <path d={BOOKMARK} />,
  // An arrow up to a line: to the top of the tree.
  moveToRoot: <path d="M3 2.5h10M8 14V6M4.75 9.25 8 6l3.25 3.25" />,
  // An arrow from one box into another.
  moveAcross: (
    <path d="M1.5 8h8M7 5.25 9.75 8 7 10.75M6 3V2.5a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V13" />
  ),
  // A folder open, with an arrow out of it.
  fileManager: (
    <path d="M1.5 12V4A1.5 1.5 0 0 1 3 2.5h2.5L7 4h4.5A1.5 1.5 0 0 1 13 5.5V7M1.5 12l2-4.5a1 1 0 0 1 .9-.5h9.6l-2.2 5.4a1 1 0 0 1-.9.6H2.5a1 1 0 0 1-1-1z" />
  ),
  // A pencil.
  rename: (
    <path d="M10.75 2.25a1.77 1.77 0 0 1 2.5 2.5L5 13l-3.25.75L2.5 10.5zM9.5 3.5 12 6" />
  ),
  delete: (
    <>
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.75 9.5a1 1 0 0 0 1 .9h4.5a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.75 7v4.5M9.25 7v4.5" />
    </>
  ),
  noteWidth: (
    <path d="M2 3v10M14 3v10M4.5 8h7M6 6.5 4.5 8 6 9.5M10 6.5 11.5 8 10 9.5" />
  ),
  noteBorders: <path d="M3 2v12M13 2v12M5.5 5h5M5.5 8h5M5.5 11h3" />,
  lineNumbers: (
    <path d="M2.5 3.5h1v4M2.5 7.5h2M2.5 10h2l-2 3h2M7 4.5h6.5M7 8h6.5M7 11.5h6.5" />
  ),
  inlineTitle: <path d="M3.5 3.5h9M8 3.5v9M5.5 12.5h5" />,
  // A tick in a circle: saved.
  saveStatus: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8.25 7.25 10l3.25-3.75" />
    </>
  ),
  // Words as dashes of their lengths, on two lines.
  wordCount: <path d="M2 5.5h4M8 5.5h6M2 10.5h7M11 10.5h3" />,
  // A letter and the cursor after it.
  characterCount: <path d="M2.5 13 6 3.5 9.5 13M3.75 9.5h4.5M12.5 3v10" />,
  // Arrows back and forward.
  history: <path d="M6.5 4.5 3 8l3.5 3.5M3 8h4M9.5 4.5 13 8l-3.5 3.5M13 8H9" />,
  // A folder and the way to it.
  folderPath: (
    <path d="M1.5 5a1 1 0 0 1 1-1h2.75l1.25 1.25H10a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1zM13 6.5l1.5 1.75L13 10" />
  ),
  // A page with its name on top.
  noteName: (
    <path d="M4 1.5h5.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM5.5 7.5h5M5.5 10h3" />
  ),
  // A wand, with sparks by its tip, as the format button.
  formatNote: (
    <path d="M2.5 13.5l7.25-7.25M8.5 5l2.5 2.5M11.5 1.75v2M10.5 2.75h2M13.75 5.5v2M12.75 6.5h2M5 2v1.5M4.25 2.75h1.5" />
  ),
  // A keyboard, as the button of the formatting bar.
  formatBar: (
    <>
      <rect x="1.75" y="3.75" width="12.5" height="8.5" rx="1.5" />
      <path d="M4.25 6.5h.01M6.75 6.5h.01M9.25 6.5h.01M11.75 6.5h.01M5.5 8.5h.01M8 8.5h.01M10.5 8.5h.01M5.75 10.25h4.5" />
    </>
  ),
  // An open book: how the note is shown.
  noteMode: (
    <path d="M8 4.5C6.5 3.5 4.5 3 2 3v9.5c2.5 0 4.5.5 6 1.5 1.5-1 3.5-1.5 6-1.5V3c-2.5 0-4.5.5-6 1.5zM8 4.5V14" />
  ),
  // A clock.
  readingTime: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.75V8l2.25 1.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type MenuIcon = keyof typeof menuIcons;
