import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightTarget, parseCodeInfo } from "./code-block";

/**
 * The language a code block is highlighted with, from the first word of
 * its opening fence (the Markdown package passes no more): the language
 * named, or the one of the file, so "```docker-compose.yml" reads as YAML
 * and "```ts:src/app.ts" as TypeScript. "```diff src/app.ts" is
 * highlighted as a diff; "```ts diff src/app.ts" as TypeScript. The
 * language is loaded when a block first uses it.
 */
export function codeLanguage(info: string): LanguageDescription | null {
  const target = highlightTarget(parseCodeInfo(info));
  if (target === null) return null;
  return "name" in target
    ? LanguageDescription.matchLanguageName(languages, target.name, true)
    : LanguageDescription.matchFilename(languages, target.file);
}
