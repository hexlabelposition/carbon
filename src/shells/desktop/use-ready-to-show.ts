import { useEffect, useState } from "react";

/**
 * Whether the interface may show: two frames after `ready`, once the
 * layout has settled (the panels measured, the commands listed), so it
 * fades in whole instead of in steps. Once shown, it stays shown.
 */
export function useReadyToShow(ready: boolean): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ready || shown) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setShown(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, shown]);
  return shown;
}
