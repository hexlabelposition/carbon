import { useEffect, useRef, useState } from "react";

interface NameInputProps {
  label: string;
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/** A moment after the field appears, in milliseconds: see `NameInput`. */
const SETTLING = 300;

/**
 * The field a name is typed into. Enter or leaving it keeps the name.
 *
 * Started from the menu of the right button, it appears as the menu goes,
 * and the menu then gives the focus back to where it was before, such as
 * the editor. A loss of focus in its first moment is that: the field takes
 * the focus back instead of ending.
 */
export function NameInput({
  label,
  initial,
  onCommit,
  onCancel,
}: NameInputProps) {
  const [text, setText] = useState(initial);
  /** Enter is followed by a blur; only the first of them counts. */
  const done = useRef(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const finish = (action: () => void) => {
    if (done.current) return;
    done.current = true;
    action();
  };

  return (
    <input
      aria-label={label}
      autoFocus
      autoComplete="off"
      spellCheck={false}
      className="h-5 min-w-0 flex-1 rounded-sm border border-line-strong bg-bg px-1 outline-none"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const field = event.currentTarget;
        if (performance.now() - shownAt.current < SETTLING) {
          requestAnimationFrame(() => field.focus());
          return;
        }
        finish(() => onCommit(text));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(() => onCommit(text));
        else if (event.key === "Escape") finish(onCancel);
      }}
    />
  );
}
