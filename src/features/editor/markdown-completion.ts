import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { languages } from "@codemirror/language-data";
import { CALLOUT_TYPES } from "./live-preview-callout";

/** Aliases and file extensions this short are offered too: "ts", "py". */
const SHORT = 4;

/**
 * The languages a code block can name, each by its name in lower case
 * ("typescript"), and by its short aliases and file extensions ("ts"),
 * with the name it is known by beside it; a short one only for the first
 * language that has it. A fence finds a language by any of them
 * (`codeLanguage`). Made once, the first time it is asked for.
 */
let languageOptions: Completion[] | null = null;
function codeLanguages(): Completion[] {
  if (languageOptions !== null) return languageOptions;
  const taken = new Set<string>();
  languageOptions = languages.flatMap((language) => {
    const name = language.name.toLowerCase().replaceAll(" ", "-");
    const short = [...language.alias, ...language.extensions].filter(
      (label) => label.length <= SHORT && /^[\w+#-]+$/.test(label),
    );
    const labels = [name, ...short].filter((label) => {
      if (taken.has(label)) return false;
      taken.add(label);
      return true;
    });
    return labels.map((label) => ({
      label,
      detail: language.name,
      // The name first, its short forms after, when both match as well.
      boost: label === name ? 1 : 0,
    }));
  });
  return languageOptions;
}

/**
 * Suggests the language of a code block after the "```" or "~~~" that
 * opens it: once a letter is typed, or all of them with Ctrl+Space; the
 * list narrows while the name is typed.
 */
export function suggestCodeLanguages(
  context: CompletionContext,
): CompletionResult | null {
  const typed = context.matchBefore(/^ {0,3}(?:`{3,}|~{3,})[\w+#.-]*/);
  if (typed === null) return null;
  const fence = /^ {0,3}(?:`{3,}|~{3,})/.exec(typed.text)?.[0] ?? "";
  const from = typed.from + fence.length;
  // A bare fence closes a block as often as it opens one: only asked.
  if (from === context.pos && !context.explicit) return null;
  return {
    from,
    options: codeLanguages(),
    validFor: /^[\w+#.-]*$/,
  };
}

/**
 * Suggests the type of a callout after "> [!": once a letter is typed, or
 * all of them with Ctrl+Space. Picking one closes the "]" and leaves room
 * for the title.
 */
export function suggestCalloutTypes(
  context: CompletionContext,
): CompletionResult | null {
  const typed = context.matchBefore(/^ {0,3}(?:> ?)+\[![\w-]*/);
  if (typed === null) return null;
  const from = typed.from + typed.text.indexOf("[!") + 2;
  if (from === context.pos && !context.explicit) return null;
  const closed = context.state.sliceDoc(context.pos, context.pos + 1) === "]";
  return {
    from,
    // "]" is written only if it is not there yet.
    options: CALLOUT_TYPES.map((type) => ({
      label: type,
      apply: closed ? type : `${type}] `,
    })),
    validFor: /^[\w-]*$/,
  };
}
