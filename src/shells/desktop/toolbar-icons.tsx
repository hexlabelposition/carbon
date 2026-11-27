import type { ReactNode } from "react";
import { BOOKMARK } from "../../features/bookmarks/bookmark-icon";

/** The icons of the toolbar buttons, drawn on 16 by 16. */
export const toolbarIcons = {
  files: (
    <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" />
  ),
  // The tree of the files: a folder at the top, two notes nested in it.
  fileTree: (
    <>
      <rect x="1.5" y="1.5" width="5" height="4" rx="1" />
      <rect x="9.5" y="6" width="5" height="3.5" rx="1" />
      <rect x="9.5" y="11" width="5" height="3.5" rx="1" />
      <path d="M4 5.5v7.25h5.5M4 7.75h5.5" />
    </>
  ),
  tags: (
    <>
      <path d="M1.5 2.5v4.6a1 1 0 0 0 .3.7l6.4 6.4a1 1 0 0 0 1.4 0l4.1-4.1a1 1 0 0 0 0-1.4L7.3 2.3a1 1 0 0 0-.7-.3H2a.5.5 0 0 0-.5.5z" />
      <circle cx="4.75" cy="5.25" r="1" />
    </>
  ),
  bookmarks: <path d={BOOKMARK} />,
  // A page with a pencil across its corner.
  drafts: (
    <>
      <path d="M8.5 14.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5h5l3.5 3.5v2" />
      <path d="M9 1.5V5h3.5M13.25 8.75l1 1-4.5 4.5-1.5.5.5-1.5z" />
    </>
  ),
  trash: (
    <>
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.75 9.5a1 1 0 0 0 1 .9h4.5a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.75 7v4.5M9.25 7v4.5" />
    </>
  ),
  note: (
    <>
      <path d="M4 1.5h5l3.5 3.5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" />
      <path d="M9 1.5V5h3.5M6 8.5h4M6 11h4" />
    </>
  ),
  // A die showing three.
  randomNote: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <circle cx="5.25" cy="5.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10.75" cy="10.75" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Three notes and the links between them.
  graph: (
    <>
      <circle cx="4" cy="4.5" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="6.5" cy="12" r="2" />
      <path d="M5.95 4.95l4.1.6M10.6 7.45l-2.7 3.1M4.8 6.35l.95 3.8" />
    </>
  ),
  commands: (
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M4.5 6l2 2-2 2M8.5 10h3" />
    </>
  ),
  settings: (
    <>
      <path d="M2 4.5h2M7.5 4.5H14M2 11.5h6.5M12 11.5h2" />
      <circle cx="5.75" cy="4.5" r="1.75" />
      <circle cx="10.25" cy="11.5" r="1.75" />
    </>
  ),
  // The headings of a note as a list: a dot before each, the two under
  // the first set in.
  outline: (
    <>
      <path d="M5 4h8.5M8 8h5.5M8 12h5.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="2.75" cy="4" r="1" />
        <circle cx="5.75" cy="8" r="1" />
        <circle cx="5.75" cy="12" r="1" />
      </g>
    </>
  ),
  // An arrow coming into a note from outside it: the notes that link here.
  backlinks: (
    <path d="M7.5 2.5h4.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H7.5M2 8h7.5M7 5.5 9.5 8 7 10.5" />
  ),
  // A safe: its door, the dial on it and its feet.
  vault: (
    <>
      <rect x="2" y="2" width="12" height="10.5" rx="1.5" />
      <circle cx="8" cy="7.25" r="2.25" />
      <path d="M8 5v.75M4.5 12.5v1.5M11.5 12.5v1.5" />
    </>
  ),
  closeVault: (
    <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10.5 5l3 3-3 3M13.5 8H6" />
  ),
  openVault: (
    <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" />
  ),
} satisfies Record<string, ReactNode>;
