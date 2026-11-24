/** How many moves of the layout are under way now. */
let moving = 0;

/**
 * The layout starts to move under the note, as a side panel that slides
 * or whose edge is dragged: the note column changes width every frame.
 * While any move is under way the root element has `data-layout-moving`,
 * which hides the text cursor of the editor (`index.css`): it is drawn a
 * frame after the text it follows, and would jump about meanwhile.
 * Returns the function that ends this move; calling it again does nothing.
 */
export function startLayoutMotion(): () => void {
  moving++;
  update();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    // Shown again two frames on: the editor sees the last change of size
    // in the frame after it, and moves the cursor in the one after that.
    // At once, the cursor would show for a frame where it was, then jump.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        moving--;
        update();
      }),
    );
  };
}

function update(): void {
  const root = document.documentElement;
  if (moving > 0) root.dataset.layoutMoving = "";
  else delete root.dataset.layoutMoving;
}
