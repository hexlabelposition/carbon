import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  searchKeymap,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  runScopeHandlers,
  type Panel,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * Find and replace in the note, with CodeMirror's search and a panel of
 * our own above the text:
 *
 * - Ctrl+F: find; Ctrl+H: replace. On a Mac, Cmd takes the place of Ctrl.
 * - Enter / Shift+Enter, F3 / Shift+F3, Ctrl+G / Ctrl+Shift+G: the next /
 *   previous match. Typing in the find field goes to the first match from
 *   the selection on.
 * - In the replace field, Enter replaces the match and goes to the next,
 *   Ctrl+Enter replaces all.
 * - Escape closes the panel and puts the focus back in the text.
 *
 * Matches are highlighted in the text, and the panel counts them.
 */
export const findReplace = [
  search({ top: true, createPanel: (view) => new FindPanel(view) }),
  keymap.of([
    ...searchKeymap,
    { key: "Mod-h", run: openReplace, preventDefault: true },
  ]),
  EditorView.theme({
    ".cm-panels": {
      backgroundColor: "var(--cb-panel)",
      color: "var(--cb-fg)",
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
    },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--cb-line)" },
    ".cb-find": {
      display: "grid",
      gridTemplateColumns: "minmax(0, 320px) auto",
      gap: "4px 8px",
      padding: "6px 8px",
      alignItems: "center",
    },
    ".cb-find-row": { display: "flex", alignItems: "center", gap: "2px" },
    ".cb-find input": {
      boxSizing: "border-box",
      width: "100%",
      height: "24px",
      padding: "0 6px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "4px",
      backgroundColor: "var(--cb-bg)",
      color: "var(--cb-fg)",
      font: "inherit",
      outline: "none",
    },
    ".cb-find input:focus": { borderColor: "var(--cb-fg)" },
    ".cb-find input[aria-invalid=true]": { borderColor: "var(--cb-danger)" },
    ".cb-find button": {
      height: "24px",
      minWidth: "24px",
      padding: "0 6px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: "transparent",
      color: "var(--cb-muted)",
      font: "inherit",
      cursor: "pointer",
    },
    ".cb-find button:hover": {
      backgroundColor: "var(--cb-raise)",
      color: "var(--cb-fg)",
    },
    ".cb-find button[aria-pressed=true]": {
      backgroundColor: "var(--cb-selected)",
      color: "var(--cb-fg)",
    },
    ".cb-find button:disabled": {
      color: "var(--cb-faint)",
      backgroundColor: "transparent",
      cursor: "default",
    },
    ".cb-find-count": {
      minWidth: "72px",
      padding: "0 6px",
      color: "var(--cb-faint)",
      whiteSpace: "nowrap",
    },
    ".cm-searchMatch": {
      backgroundColor: "var(--cb-highlight)",
      borderRadius: "2px",
    },
    ".cm-searchMatch-selected": {
      outline: "1px solid var(--cb-fg)",
    },
  }),
];

/** Matches counted at most: past that, the count says "1000+". */
const COUNT_LIMIT = 1000;

/** Opens the panel with the focus in the replace field. */
export function openReplace(view: EditorView): boolean {
  openSearchPanel(view);
  // The panel is made by the dispatch above, so it is there now.
  const field = view.dom.querySelector<HTMLInputElement>(".cb-find-replace");
  field?.focus();
  field?.select();
  return true;
}

class FindPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  private readonly find: HTMLInputElement;
  private readonly replace: HTMLInputElement;
  private readonly count: HTMLElement;
  private readonly toggles: Record<Toggle, HTMLButtonElement>;
  private readonly needQuery: HTMLButtonElement[];
  /**
   * Where typing in the find field looks for the first match from: the
   * selection, so typing on keeps to the match it is at.
   */
  private origin: number;

  constructor(private readonly view: EditorView) {
    const query = getSearchQuery(view.state);
    this.origin = view.state.selection.main.from;

    this.find = input({
      "aria-label": "Find",
      placeholder: "Find",
      // `openSearchPanel` focuses the field with this attribute.
      "main-field": "true",
    });
    this.find.value = query.search;
    this.find.addEventListener("input", () => this.commit(true));
    this.find.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(view);
    });

    this.replace = input({
      "aria-label": "Replace",
      placeholder: "Replace",
      class: "cb-find-replace",
    });
    this.replace.value = query.replace;
    this.replace.addEventListener("input", () => this.commit(false));
    this.replace.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      (event.ctrlKey || event.metaKey ? replaceAll : replaceNext)(view);
    });

    this.toggles = {
      caseSensitive: toggle("Aa", "Match case", query.caseSensitive),
      wholeWord: toggle("W", "Whole word", query.wholeWord),
      regexp: toggle(".*", "Regular expression", query.regexp),
    };
    for (const button of Object.values(this.toggles)) {
      button.addEventListener("click", () => {
        const on = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(on));
        this.commit(true);
      });
    }

    this.count = el("span", { class: "cb-find-count", "aria-live": "polite" });
    const previous = button("↑", "Previous match (Shift+Enter)", () =>
      findPrevious(view),
    );
    const next = button("↓", "Next match (Enter)", () => findNext(view));
    const replaceOne = button("Replace", "Replace (Enter)", () =>
      replaceNext(view),
    );
    const replaceEvery = button("Replace all", "Replace all (Ctrl+Enter)", () =>
      replaceAll(view),
    );
    this.needQuery = [previous, next, replaceOne, replaceEvery];
    const close = button("×", "Close (Escape)", () => closeSearchPanel(view));

    this.dom = el(
      "div",
      { class: "cb-find", role: "search", "aria-label": "Find in note" },
      [
        this.find,
        el("div", { class: "cb-find-row" }, [
          ...Object.values(this.toggles),
          this.count,
          previous,
          next,
          close,
        ]),
        this.replace,
        el("div", { class: "cb-find-row" }, [replaceOne, replaceEvery]),
      ],
    );
    // Escape, F3 and Ctrl+G work in the panel as in the text.
    this.dom.addEventListener("keydown", (event) => {
      if (runScopeHandlers(view, event, "search-panel")) event.preventDefault();
    });
    this.showCount(view.state);
  }

  mount() {
    this.find.select();
  }

  update(update: ViewUpdate) {
    const query = getSearchQuery(update.state);
    const queryChanged = !query.eq(getSearchQuery(update.startState));
    if (queryChanged) this.show(query);
    if (update.selectionSet) this.origin = update.state.selection.main.from;
    if (queryChanged || update.docChanged || update.selectionSet) {
      this.showCount(update.state);
    }
  }

  /** Puts a query set from outside, such as by Ctrl+F on a word, in the fields. */
  private show(query: SearchQuery) {
    if (this.find.value !== query.search) this.find.value = query.search;
    if (this.replace.value !== query.replace) {
      this.replace.value = query.replace;
    }
    for (const [name, button] of entries(this.toggles)) {
      button.setAttribute("aria-pressed", String(query[name]));
    }
  }

  /**
   * Makes the fields the search query. With `go`, also selects the first
   * match from `origin`, so the text follows what is typed.
   */
  private commit(go: boolean) {
    const pressed = (name: Toggle) =>
      this.toggles[name].getAttribute("aria-pressed") === "true";
    const query = new SearchQuery({
      search: this.find.value,
      replace: this.replace.value,
      caseSensitive: pressed("caseSensitive"),
      wholeWord: pressed("wholeWord"),
      regexp: pressed("regexp"),
    });
    const { state } = this.view;
    if (query.eq(getSearchQuery(state))) return;
    const match =
      go && query.valid ? firstMatch(state, query, this.origin) : null;
    this.view.dispatch({
      effects: [
        setSearchQuery.of(query),
        ...(match === null
          ? []
          : [EditorView.scrollIntoView(match.from, { y: "center" })]),
      ],
      selection:
        match === null ? undefined : { anchor: match.from, head: match.to },
    });
  }

  private showCount(state: EditorState) {
    const query = getSearchQuery(state);
    this.find.setAttribute(
      "aria-invalid",
      String(query.search !== "" && !query.valid),
    );
    const { total, current } = query.valid
      ? countMatches(state, query)
      : { total: 0, current: null };
    for (const button of this.needQuery) button.disabled = total === 0;
    this.count.textContent =
      query.search === ""
        ? ""
        : !query.valid
          ? "Invalid"
          : total === 0
            ? "No matches"
            : `${current ?? "?"} of ${total >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : total}`;
  }
}

type Toggle = "caseSensitive" | "wholeWord" | "regexp";

/** The first match at or after `from`, or else the first of all. */
function firstMatch(
  state: EditorState,
  query: SearchQuery,
  from: number,
): { from: number; to: number } | null {
  const after = query.getCursor(state, from).next();
  if (!after.done) return after.value;
  const any = query.getCursor(state).next();
  return any.done ? null : any.value;
}

/**
 * How many matches the note has, up to `COUNT_LIMIT`, and which of them
 * is selected, counting from 1: `null` if none is.
 */
function countMatches(
  state: EditorState,
  query: SearchQuery,
): { total: number; current: number | null } {
  const { from, to } = state.selection.main;
  const cursor = query.getCursor(state);
  let total = 0;
  let current: number | null = null;
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    total++;
    if (next.value.from === from && next.value.to === to) current = total;
    if (total >= COUNT_LIMIT) break;
  }
  return { total, current };
}

function el(
  tag: string,
  attributes: Record<string, string>,
  children: Node[] = [],
): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

function input(attributes: Record<string, string>): HTMLInputElement {
  return el("input", {
    type: "text",
    spellcheck: "false",
    autocomplete: "off",
    ...attributes,
  }) as HTMLInputElement;
}

function button(
  label: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const element = el("button", {
    type: "button",
    title,
    "aria-label": title,
  }) as HTMLButtonElement;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function toggle(
  label: string,
  title: string,
  pressed: boolean,
): HTMLButtonElement {
  const element = button(label, title, () => {});
  element.setAttribute("aria-pressed", String(pressed));
  return element;
}

function entries<K extends string, V>(record: Record<K, V>): [K, V][] {
  return Object.entries(record) as [K, V][];
}
