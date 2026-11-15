import { oneOf, preference } from "../settings/preference";
import { en, type Message } from "./en";
import { ru } from "./ru";

/** The languages of the interface. */
export type Language = "en" | "ru";
/** What the user chose: a language, or the one of the system. */
export type LanguageSetting = "system" | Language;

export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = [
  "system",
  "en",
  "ru",
];

/** The language setting: the settings dialog sets it. */
export const languagePreference = preference<LanguageSetting>(
  "carbon.language",
  "system",
  oneOf(LANGUAGE_SETTINGS),
);

/** A key of a text of the interface. */
export type MessageKey = keyof typeof en;
/** Values put into a text in place of `{name}`; `count` also picks a plural. */
export type MessageParams = Record<string, string | number>;

const MESSAGES: Record<Language, Record<MessageKey, Message>> = { en, ru };

/** The language of the system, if it is one the interface has; else English. */
function systemLanguage(): Language {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "ru" || base === "en") return base;
  }
  return "en";
}

/** The language the interface is in now. */
export function currentLanguage(): Language {
  const setting = languagePreference.get();
  return setting === "system" ? systemLanguage() : setting;
}

const pluralRules = new Map<Language, Intl.PluralRules>();

function format(language: Language, key: MessageKey, params?: MessageParams) {
  const message = MESSAGES[language][key];
  let text: string;
  if (typeof message === "string") {
    text = message;
  } else {
    const count = Number(params?.count ?? 0);
    let rules = pluralRules.get(language);
    if (rules === undefined) {
      rules = new Intl.PluralRules(language);
      pluralRules.set(language, rules);
    }
    const form = rules.select(count) as keyof typeof message;
    text = message[form] ?? message.other;
  }
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? value.toLocaleString(language) : value;
  });
}

/** Translates into a given language. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

const translators: Record<Language, Translate> = {
  en: (key, params) => format("en", key, params),
  ru: (key, params) => format("ru", key, params),
};

/**
 * A text of the interface in the language it is in now. For code outside
 * components, such as the widgets of the editor; a component uses `useT`,
 * so it is drawn again when the language changes.
 */
export const t: Translate = (key, params) =>
  translators[currentLanguage()](key, params);

/** The language of the interface, kept up to date in a component. */
export function useLanguage(): Language {
  const setting = languagePreference.use();
  return setting === "system" ? systemLanguage() : setting;
}

/**
 * `t` for a component: it is drawn again when the language changes. The
 * function changes with the language, so it can be a dependency of a memo.
 */
export function useT(): Translate {
  return translators[useLanguage()];
}
