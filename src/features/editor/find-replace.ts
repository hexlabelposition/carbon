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
import { t } from "../i18n/i18n";
import { scrollParentOf } from "./glide";

/**
 * Find and replace in the note, with CodeMirror's search and a panel of
 * our own: a box in the top right corner of the note, as in VS Code, that
 * stays there while the note scrolls. The arrow at its left shows and
 * hides the replace row.
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
    // CodeMirror keeps its panels in a bar above the text. The box is
    // fixed to the corner of the note instead, so the bar stays empty.
    ".cm-panels, .cm-panels.cm-panels-top": {
      backgroundColor: "transparent",
      border: "none",
    },
    ".cb-find": {
      position: "fixed",
      zIndex: "20",
      boxSizing: "border-box",
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr) auto",
      gap: "4px",
      width: "min(440px, var(--cb-find-room, 440px))",
      padding: "4px 6px 4px 2px",
      border: "1px solid var(--cb-line)",
      borderRadius: "8px",
      backgroundColor: "var(--cb-panel)",
      boxShadow: "0 4px 16px rgb(0 0 0 / 0.12)",
      color: "var(--cb-fg)",
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
      alignItems: "center",
    },
    // The replace row, while it is hidden.
    ".cb-find:not(.cb-find-expanded) .cb-find-replace-row": {
      display: "none",
    },
    ".cb-find-row": { display: "flex", alignItems: "center", gap: "2px" },
    // The arrow that shows the replace row: as tall as both rows.
    ".cb-find button.cb-find-expand": {
      gridRow: "1 / span 2",
      alignSelf: "stretch",
      height: "auto",
      minWidth: "20px",
      padding: "0",
    },
    ".cb-find:not(.cb-find-expanded) .cb-find-expand": { gridRow: "1" },
    ".cb-find-expand svg": { transition: "transform 100ms" },
    ".cb-find-expanded .cb-find-expand svg": { transform: "rotate(90deg)" },
    // The find field with the toggles inside it, as one field.
    ".cb-find-field": {
      display: "flex",
      alignItems: "center",
      gap: "1px",
      boxSizing: "border-box",
      height: "26px",
      paddingRight: "2px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "4px",
      backgroundColor: "var(--cb-bg)",
    },
    ".cb-find-field:focus-within": { borderColor: "var(--cb-fg)" },
    ".cb-find-field[data-invalid=true]": { borderColor: "var(--cb-danger)" },
    ".cb-find input": {
      boxSizing: "border-box",
      width: "100%",
      minWidth: "0",
      height: "26px",
      padding: "0 6px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "4px",
      backgroundColor: "var(--cb-bg)",
      color: "var(--cb-fg)",
      font: "inherit",
      outline: "none",
    },
    ".cb-find input:focus": { borderColor: "var(--cb-fg)" },
    ".cb-find-field input, .cb-find-field input:focus": {
      flex: "1",
      height: "24px",
      border: "none",
      backgroundColor: "transparent",
    },
    ".cb-find button": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: "24px",
      minWidth: "24px",
      padding: "0 6px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: "transparent",
      color: "var(--cb-muted)",
      font: "inherit",
      whiteSpace: "nowrap",
      cursor: "pointer",
    },
    ".cb-find-field button": {
      height: "20px",
      minWidth: "20px",
      padding: "0 4px",
      fontSize: "12px",
    },
    ".cb-find button svg": { width: "16px", height: "16px" },
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
      minWidth: "64px",
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

/** The open panel of each editor, so Ctrl+H can show its replace row. */
const panels = new WeakMap<EditorView, FindPanel>();

/** Room between the box and the edges of the note, in pixels. */
const EDGE = 12;
/** The scrollbar of the note is drawn over its right edge. */
const SCROLLBAR = 12;

/** Opens the panel with the replace row shown and the focus in it. */
export function openReplace(view: EditorView): boolean {
  openSearchPanel(view);
  // The panel is made by the dispatch above, so it is there now.
  panels.get(view)?.expand(true, true);
  return true;
}

class FindPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  private readonly find: HTMLInputElement;
  private readonly replace: HTMLInputElement;
  private readonly count: HTMLElement;
  private readonly field: HTMLElement;
  private readonly expander: HTMLButtonElement;
  private readonly toggles: Record<Toggle, HTMLButtonElement>;
  private readonly needQuery: HTMLButtonElement[];
  /**
   * Where typing in the find field looks for the first match from: the
   * selection, so typing on keeps to the match it is at.
   */
  private origin: number;
  /** Keeps the box in the corner of the note as the layout changes. */
  private placing: ResizeObserver | null = null;
  private readonly place = () => this.placeInCorner();

  constructor(private readonly view: EditorView) {
    const query = getSearchQuery(view.state);
    this.origin = view.state.selection.main.from;

    this.find = input({
      "aria-label": t("find.find"),
      placeholder: t("find.find"),
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
      "aria-label": t("find.replace"),
      placeholder: t("find.replace"),
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
      caseSensitive: toggle("Aa", t("find.matchCase"), query.caseSensitive),
      wholeWord: toggle("W", t("find.wholeWord"), query.wholeWord),
      regexp: toggle(".*", t("find.regexp"), query.regexp),
    };
    for (const button of Object.values(this.toggles)) {
      button.addEventListener("click", () => {
        const on = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(on));
        this.commit(true);
      });
    }

    this.count = el("span", { class: "cb-find-count", "aria-live": "polite" });
    const previous = button(ARROW_UP, t("find.previous"), () =>
      findPrevious(view),
    );
    const next = button(ARROW_DOWN, t("find.next"), () => findNext(view));
    const replaceOne = textButton(
      t("find.replace"),
      t("find.replaceHint"),
      () => replaceNext(view),
    );
    const replaceEvery = textButton(
      t("find.replaceAll"),
      t("find.replaceAllHint"),
      () => replaceAll(view),
    );
    this.needQuery = [previous, next, replaceOne, replaceEvery];
    const close = button(CLOSE, t("common.closeEscape"), () =>
      closeSearchPanel(view),
    );
    this.expander = button(CHEVRON, t("find.toggleReplace"), () =>
      this.expand(!this.expanded, false),
    );
    this.expander.classList.add("cb-find-expand");
    this.expander.setAttribute("aria-expanded", "false");

    this.field = el("div", { class: "cb-find-field" }, [
      this.find,
      ...Object.values(this.toggles),
    ]);
    this.dom = el(
      "div",
      { class: "cb-find", role: "search", "aria-label": t("find.label") },
      [
        this.expander,
        this.field,
        el("div", { class: "cb-find-row" }, [
          this.count,
          previous,
          next,
          close,
        ]),
        el("div", { class: "cb-find-replace-row" }, [this.replace]),
        el("div", { class: "cb-find-row cb-find-replace-row" }, [
          replaceOne,
          replaceEvery,
        ]),
      ],
    );
    panels.set(view, this);
    // Escape, F3 and Ctrl+G work in the panel as in the text.
    this.dom.addEventListener("keydown", (event) => {
      if (runScopeHandlers(view, event, "search-panel")) event.preventDefault();
    });
    this.showCount(view.state);
  }

  mount() {
    this.find.select();
    this.placeInCorner();
    const scroller = scrollParentOf(this.view.dom);
    // The note grows, shrinks and moves with the panels around it and
    // the alerts above it; all of these change the size of its scroll.
    this.placing = new ResizeObserver(this.place);
    if (scroller !== null) this.placing.observe(scroller);
    window.addEventListener("resize", this.place);
  }

  destroy() {
    this.placing?.disconnect();
    window.removeEventListener("resize", this.place);
    if (panels.get(this.view) === this) panels.delete(this.view);
  }

  private get expanded(): boolean {
    return this.dom.classList.contains("cb-find-expanded");
  }

  /** Shows or hides the replace row; `focus` puts the focus in it. */
  expand(on: boolean, focus: boolean) {
    this.dom.classList.toggle("cb-find-expanded", on);
    this.expander.setAttribute("aria-expanded", String(on));
    if (on && focus) {
      this.replace.focus();
      this.replace.select();
    } else if (!on && this.dom.contains(document.activeElement)) {
      this.find.focus();
    }
  }

  /**
   * Fixed to the top right corner of the area the note scrolls in, not to
   * the text: it stays in place while the note scrolls under it.
   */
  private placeInCorner() {
    const scroller = scrollParentOf(this.view.dom);
    if (scroller === null) return;
    const area = scroller.getBoundingClientRect();
    const { style } = this.dom;
    style.top = `${area.top + EDGE}px`;
    style.right = `${window.innerWidth - area.right + EDGE + SCROLLBAR}px`;
    style.setProperty(
      "--cb-find-room",
      `${Math.max(0, area.width - 2 * EDGE - SCROLLBAR)}px`,
    );
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
    const invalid = String(query.search !== "" && !query.valid);
    this.find.setAttribute("aria-invalid", invalid);
    this.field.dataset.invalid = invalid;
    const { total, current } = query.valid
      ? countMatches(state, query)
      : { total: 0, current: null };
    for (const button of this.needQuery) button.disabled = total === 0;
    this.count.textContent =
      query.search === ""
        ? ""
        : !query.valid
          ? t("find.invalid")
          : total === 0
            ? t("find.none")
            : t("find.count", {
                current: current ?? "?",
                total: total >= COUNT_LIMIT ? `${COUNT_LIMIT}+` : total,
              });
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

/** The icons of the buttons: 16 by 16 outlines, as elsewhere in the app. */
const ARROW_UP = '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>';
const ARROW_DOWN = '<path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/>';
const CLOSE = '<path d="M4 4l8 8M12 4l-8 8"/>';
const CHEVRON = '<path d="M6 3.5 10.5 8 6 12.5"/>';

/** A button with an icon; its title says what it does. */
function button(
  icon: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const element = textButton("", title, onClick);
  element.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.25" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    icon +
    "</svg>";
  return element;
}

function textButton(
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
  const element = textButton(label, title, () => {});
  element.setAttribute("aria-pressed", String(pressed));
  return element;
}

function entries<K extends string, V>(record: Record<K, V>): [K, V][] {
  return Object.entries(record) as [K, V][];
}
