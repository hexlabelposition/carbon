import type { IndexStatus } from "@carbon/core";
import { preference } from "../settings/preference";

/**
 * Whether to say so when the vault took longer than it should to open,
 * with a way to see where the time went. On by default.
 */
export const slowStartNoticePreference = preference<boolean>(
  "carbon.startup.slowNotice",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/**
 * A start slower than this, in milliseconds from opening the vault to
 * its being ready, is told of: three times the budget of a start with the
 * index built (ARCHITECTURE.md, section 1), so a busy disk now and then
 * does not raise it.
 */
export const SLOW_START = 3000;

/**
 * How long the vault took to open, if that was slow: from `openedAt`
 * (`performance.now()`, `null` when not known: from the start of the app
 * then) to the end of the startup scan. A scan that indexed most of the
 * notes anew, as the first one, is slow by nature and is not told of.
 */
export function slowStart(
  status: Extract<IndexStatus, { state: "ready" }>,
  openedAt: number | null,
): number | null {
  if (status.indexed * 2 > status.notes) return null;
  const ready = status.doneAt - performance.timeOrigin;
  const took = ready - (openedAt ?? 0);
  return took > SLOW_START ? took : null;
}
