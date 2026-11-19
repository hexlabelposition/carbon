import { Fragment } from "react";

/**
 * Keys such as "Ctrl+O", each in a box: below the watermark and in the
 * command palette. A "+" that is itself the key, as in "Ctrl++", stays
 * a key.
 */
export function Shortcut({
  text,
  danger = false,
}: {
  text: string;
  /** Marked red: the keys are wrong, as two shortcuts sharing them. */
  danger?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 text-small ${
        danger ? "text-danger" : "text-faint"
      }`}
    >
      {text.split(/\+(?=.)/).map((key, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <kbd
            className={`min-w-5 rounded-sm border px-1 text-center font-sans ${
              danger
                ? "border-danger/60 bg-danger/10"
                : "border-line-strong bg-panel"
            }`}
          >
            {key}
          </kbd>
        </Fragment>
      ))}
    </span>
  );
}
