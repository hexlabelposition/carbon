import type { TextRange } from "@carbon/core";
import type { ReactNode } from "react";

interface HighlightedProps {
  text: string;
  /** The parts of `text` to mark, in order, not overlapping. */
  ranges: readonly TextRange[];
  /** How a marked part looks. */
  className: string;
}

/** `text` with the parts at `ranges` marked, as matches of a search. */
export function Highlighted({ text, ranges, className }: HighlightedProps) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const { start, end } of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className={className}>
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
