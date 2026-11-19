import { VaultError } from "@carbon/core";
import { t as currentT, type MessageKey, type Translate } from "./i18n";

/**
 * What went wrong, to show the user: an error of the core in the language
 * of the interface, by its code (C-614); any other error, such as one of
 * the file system, as it says itself. `t` is the language of a component;
 * without it, the language the interface is in now.
 */
export function errorText(reason: unknown, t: Translate = currentT): string {
  if (reason instanceof VaultError) {
    const key: MessageKey = `error.${reason.code}`;
    return t(key, { subject: reason.subject });
  }
  return reason instanceof Error ? reason.message : String(reason);
}
