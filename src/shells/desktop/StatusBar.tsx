import type { ReactNode } from "react";

interface StatusBarProps {
  /** Left side: where the user is. */
  children: ReactNode;
  /** Right side: small actions. */
  actions?: ReactNode;
}

/** The bottom row of the desktop layout. Layout only. */
export function StatusBar({ children, actions }: StatusBarProps) {
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-panel px-2 text-small text-faint">
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {actions}
    </footer>
  );
}

interface StatusButtonProps {
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** A quiet text button for the status bar. */
export function StatusButton({
  pressed,
  onClick,
  children,
}: StatusButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-5 shrink-0 rounded-sm px-1.5 hover:bg-raise hover:text-fg ${
        pressed ? "bg-selected text-fg" : ""
      }`}
    >
      {children}
    </button>
  );
}
