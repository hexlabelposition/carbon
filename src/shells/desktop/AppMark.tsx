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
 * leaves `APP_MARK_ROOM` free for it. With `edge` a line at its right
 * side: the top of the toolbar's edge, which stands under it.
 */
export function AppMark({ edge = false }: { edge?: boolean }) {
  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 z-40 flex size-12 items-center justify-center border-b border-line bg-panel"
    >
      {/* The line at the right side moves with the edge of the toolbar as
          it slides open and shut: in from the left edge of the window, out
          to it, in the time and the easing of SlidePanel. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-px bg-line transition-transform duration-200 ease-out motion-reduce:transition-none ${
          edge ? "translate-x-[calc(3rem-1px)]" : "-translate-x-px"
        }`}
      />
      {/* Over the line, on the color of the corner: the line passes behind
          the mark, not across it. The drag region is the element under the
          pointer: not the mark. */}
      <span className="pointer-events-none relative bg-panel px-0.5">
        <CarbonMark className="block h-4.5 w-auto" />
      </span>
    </div>
  );
}
