import { useMemo, useRef, useState } from "react";
import type { Heading, OutlineLink } from "../editor/outline";

export interface Outline {
  /** The headings of the shown note; empty while no editor is open. */
  headings: readonly Heading[];
  /** The heading the cursor is under: its index, -1 if none. */
  current: number;
  /** Give it to the editor of the note. The same object on every render. */
  link: OutlineLink;
  /** Goes to a heading in the editor, by its index. */
  reveal(index: number): void;
}

/** The outline of the note that is shown, fed by its editor. */
export function useOutline(): Outline {
  const [headings, setHeadings] = useState<readonly Heading[]>([]);
  const [current, setCurrent] = useState(-1);
  const revealer = useRef<((index: number) => void) | null>(null);

  const link = useMemo<OutlineLink>(
    () => ({
      headings: setHeadings,
      current: setCurrent,
      connect(reveal) {
        revealer.current = reveal;
        return () => {
          if (revealer.current === reveal) revealer.current = null;
        };
      },
    }),
    [],
  );
  const reveal = useMemo(
    () => (index: number) => revealer.current?.(index),
    [],
  );

  return { headings, current, link, reveal };
}
