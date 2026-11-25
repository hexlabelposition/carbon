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
