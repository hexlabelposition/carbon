import { Fragment } from "react";

/**
 * Keys such as "Ctrl+O", each in a box: below the watermark and in the
 * command palette. A "+" that is itself the key, as in "Ctrl++", stays
 * a key.
 */
export function Shortcut({ text }: { text: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-small text-faint">
      {text.split(/\+(?=.)/).map((key, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <kbd className="min-w-5 rounded-sm border border-line-strong bg-panel px-1 text-center font-sans">
            {key}
          </kbd>
        </Fragment>
      ))}
    </span>
  );
}
