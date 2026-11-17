import type { MessageKey } from "../i18n/i18n";
import { oneOf, preference } from "../settings/preference";

/** Where deleting moves notes, files and folders (ADR-031). */
export type DeleteTo = "vault" | "system";

export const DELETE_TO: readonly { value: DeleteTo; label: MessageKey }[] = [
  { value: "vault", label: "settings.deleteTo.vault" },
  { value: "system", label: "settings.deleteTo.system" },
];

/**
 * The trash of the vault until another is chosen: deleted notes can be
 * restored from inside Carbon, on any system.
 */
export const deleteToPreference = preference<DeleteTo>(
  "carbon.deleteTo",
  "vault",
  oneOf(DELETE_TO.map((option) => option.value)),
);
