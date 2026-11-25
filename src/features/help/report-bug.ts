/** Where bugs of Carbon are reported and ideas are suggested. */
const ISSUES = "https://github.com/hexlabelposition/carbon/issues";

/** The system the app runs on, for a bug report. */
function systemName(): string {
  const agent = navigator.userAgent;
  if (/Windows/.test(agent)) return "Windows";
  if (/Mac/.test(agent)) return "macOS";
  if (/Linux/.test(agent)) return "Linux";
  return "an unknown system";
}

/**
 * The page of a new issue, with a text to fill in: what happened, and the
 * version and system it happened on. In English, as the issues are. It
 * asks for the log file and warns what the file may hold, so a log is
 * looked over before it is posted where anyone can read it.
 */
export function newIssueUrl(version: string): string {
  const body = [
    "**What happened**",
    "",
    "",
    "**What you expected**",
    "",
    "",
    "**Steps to reproduce**",
    "",
    "1. ",
    "",
    "---",
    `Carbon ${version} on ${systemName()}`,
    "",
    "The log file helps to find the cause: in Settings, General, Help," +
      " open the folder of the app log and attach `carbon.log`. It may" +
      " hold names of notes and folders: look it over before you attach it.",
  ].join("\n");
  return `${ISSUES}/new?body=${encodeURIComponent(body)}`;
}
