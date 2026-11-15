import { CarbonMark } from "../../features/brand/CarbonLogo";

/**
 * Room to leave at the left end of the top row, under the mark: a square
 * as tall as the row.
 */
export const APP_MARK_ROOM = "pl-12";

/**
 * The Carbon mark in the top left corner of the window, over the top row
 * of the layout, as the window buttons are in the top right one. The row
 * drags the window there too. The element at the left end of that row
 * leaves `APP_MARK_ROOM` free for it.
 */
export function AppMark() {
  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 z-40 flex size-12 items-center justify-center border-b border-line bg-panel"
    >
      {/* The drag region is the element under the pointer: not the mark. */}
      <CarbonMark className="pointer-events-none h-4.5 w-auto" />
    </div>
  );
}
