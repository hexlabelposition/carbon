import { CarbonMark } from "../../features/brand/CarbonLogo";

/**
 * The Carbon mark in the top left corner of the window, over the top row
 * of the layout, as the window buttons are in the top right one. The row
 * drags the window there too. The element at the left end of that row
 * leaves `APP_MARK_ROOM` free for it; a line at the right side of the mark
 * sets it off from the tabs that start there.
 */
export function AppMark() {
  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 z-40 flex size-bar items-center justify-center border-r border-b border-line bg-panel"
    >
      {/* The drag region is the element under the pointer: not the mark. */}
      <CarbonMark className="pointer-events-none h-5.5 w-auto" />
    </div>
  );
}
