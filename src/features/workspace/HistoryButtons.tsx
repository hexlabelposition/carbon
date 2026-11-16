import type { ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";

interface HistoryButtonsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

/**
 * Back and forward through what a pane has shown, at the start of the bar
 * above a note or an image. Alt+Left and Alt+Right do the same.
 */
export function HistoryButtons({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: HistoryButtonsProps) {
  const t = useT();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ArrowButton
        label={t("tabs.back")}
        shortcut="Alt+←"
        disabled={!canGoBack}
        onClick={onBack}
      >
        <path d="M10 4l-4 4 4 4" />
      </ArrowButton>
      <ArrowButton
        label={t("tabs.forward")}
        shortcut="Alt+→"
        disabled={!canGoForward}
        onClick={onForward}
      >
        <path d="M6 4l4 4-4 4" />
      </ArrowButton>
    </div>
  );
}

interface ArrowButtonProps {
  label: string;
  shortcut: string;
  disabled: boolean;
  onClick: () => void;
  /** The `<path>` of the arrow. */
  children: ReactNode;
}

function ArrowButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: ArrowButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        className="flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-100 hover:bg-selected hover:text-fg disabled:text-faint disabled:opacity-50 disabled:hover:bg-transparent"
        onClick={onClick}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </svg>
      </button>
    </Tooltip>
  );
}
