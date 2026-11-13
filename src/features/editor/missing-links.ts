import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { linkHost } from "./link-completion";

/** How long typing must pause before the links are looked up again. */
const LOOKUP_DELAY_MS = 300;

const setMissing = StateEffect.define<ReadonlySet<string>>();

/** The targets of wiki links that find no note, as written. */
const missingField = StateField.define<ReadonlySet<string>>({
  create: () => new Set(),
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setMissing)) return effect.value;
    }
    return value;
  },
});

/** True if the wiki link to `target`, as written, finds no note. */
export function isMissing(state: EditorState, target: string): boolean {
  return state.field(missingField, false)?.has(target) ?? false;
}

/** True if the update changed which links find no note. */
export function missingChanged(update: ViewUpdate): boolean {
  return (
    update.startState.field(missingField, false) !==
    update.state.field(missingField, false)
  );
}

/**
 * Keeps track of the wiki links of the note that find no note, for live
 * preview to show them apart. They are looked up when typing pauses, and
 * again whenever the index takes in a change, such as a new note.
 */
export const missingLinks = [
  missingField,
  ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | undefined;
      private asked = 0;
      private readonly stop: () => void;

      constructor(private readonly view: EditorView) {
        const host = view.state.facet(linkHost);
        this.stop = host?.onIndexChange(() => this.lookUp()) ?? (() => {});
        this.lookUp();
      }

      update(update: ViewUpdate) {
        const reparsed =
          update.docChanged ||
          // Parsing a long note finishes in the background.
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (!reparsed) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.lookUp(), LOOKUP_DELAY_MS);
      }

      destroy() {
        clearTimeout(this.timer);
        this.stop();
        // An answer that comes in later is for a closed editor.
        this.asked = -1;
      }

      private lookUp() {
        const host = this.view.state.facet(linkHost);
        if (host === null || this.asked < 0) return;
        const request = ++this.asked;
        const targets = wikiTargets(this.view.state);
        host.missing(targets).then(
          (missing) => {
            // Only the latest answer counts.
            if (request !== this.asked) return;
            const current = this.view.state.field(missingField);
            if (sameSet(current, missing)) return;
            this.view.dispatch({ effects: setMissing.of(missing) });
          },
          () => {
            // Without an index nothing is known to be missing.
          },
        );
      }
    },
  ),
];

/** The targets of the wiki links in the note, as written, each once. */
function wikiTargets(state: EditorState): string[] {
  const targets = new Set<string>();
  syntaxTree(state).iterate({
    enter({ name, node }) {
      if (name !== "WikiLink") return;
      const target = node.getChild("WikiLinkTarget");
      if (target !== null) {
        const text = state.sliceDoc(target.from, target.to).trim();
        if (text !== "") targets.add(text);
      }
      return false;
    },
  });
  return [...targets];
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}
