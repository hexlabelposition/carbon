import { VaultError } from "@carbon/core";
import { describe, log } from "../log/log";
import { t as currentT, type MessageKey, type Translate } from "./i18n";

const windows = /Windows/.test(navigator.userAgent);

/**
 * The errors of the system that people meet, by the number Rust gives as
 * "(os error N)". The numbers mean other things on Windows than on Linux
 * and macOS.
 */
const SYSTEM_ERRORS: Readonly<Record<number, MessageKey>> = windows
  ? {
      2: "error.system.notFound",
      3: "error.system.notFound",
      5: "error.system.accessDenied",
      19: "error.system.readOnly",
      32: "error.system.busy",
      33: "error.system.busy",
      80: "error.system.exists",
      112: "error.system.diskFull",
      145: "error.system.notEmpty",
      183: "error.system.exists",
      206: "error.system.nameTooLong",
    }
  : {
      1: "error.system.accessDenied",
      2: "error.system.notFound",
      5: "error.system.io",
      13: "error.system.accessDenied",
      16: "error.system.busy",
      17: "error.system.exists",
      28: "error.system.diskFull",
      30: "error.system.readOnly",
      36: "error.system.nameTooLong",
      39: "error.system.notEmpty",
      63: "error.system.nameTooLong",
      66: "error.system.notEmpty",
    };

/** The text of an error of the system, if it is one people meet. */
function systemText(message: string, t: Translate): string | null {
  const code = /\(os error (\d+)\)/.exec(message)?.[1];
  const key = code === undefined ? undefined : SYSTEM_ERRORS[Number(code)];
  return key === undefined ? null : t(key);
}

// What was written already: the same failure is shown again on every draw.
const loggedObjects = new WeakSet<object>();
const loggedTexts = new Set<string>();

/** Writes a failure the user is shown to the log, once, in full. */
function logShown(reason: unknown) {
  if (typeof reason === "object" && reason !== null) {
    if (loggedObjects.has(reason)) return;
    loggedObjects.add(reason);
  } else {
    const text = String(reason);
    if (loggedTexts.has(text)) return;
    if (loggedTexts.size > 100) loggedTexts.clear();
    loggedTexts.add(text);
  }
  log.warn("Shown to the user", reason);
}

/**
 * What went wrong, to show the user, in the language of the interface
 * (C-606, C-614): an error of the core by its code; one of the system,
 * such as a file that is gone or a full disk, by its number; any other as
 * it says itself. The failure itself, in full, goes to the log. `t` is
 * the language of a component; without it, the language now.
 */
export function errorText(reason: unknown, t: Translate = currentT): string {
  logShown(reason);
  if (reason instanceof VaultError) {
    const key: MessageKey = `error.${reason.code}`;
    return t(key, { subject: reason.subject });
  }
  return systemText(describe(reason), t) ?? messageOf(reason);
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
