/**
 * What the first line of a code block says about it, and what each of its
 * lines marks. Plain text in, plain data out: live preview draws it
 * (`live-preview-code.ts`), the note on disk stays plain Markdown.
 *
 * The opening fence can name a language, a file, lines to highlight and
 * lines added or removed, in any order:
 *
 *     ```ts src/app.ts {3} ins={5-6} del={4}
 *     ```ts title="src/app.ts"
 *     ```ts:src/app.ts
 *     ```docker-compose.yml          the language from the extension
 *     ```diff src/app.ts             lines start with "+", "-" or " "
 *     ```ts diff src/app.ts          the same, highlighted as TypeScript
 *
 * A line can also mark itself with a note at its end, as Shiki writes it:
 * `// [!code ++]`, `// [!code --]` or `// [!code highlight]`, after any
 * of the usual comment marks (`//`, `#`, `--`, `;`, `<!-- -->`, `/* *\/`).
 */
export interface CodeInfo {
  /** The language as written, in lower case, or "" if none is named. */
  language: string;
  /** The file, as "src/app.ts", or "" if none is named. */
  file: string;
  /** Lines start with "+", "-" or " ", as in a unified diff. */
  diff: boolean;
  /** Numbers of the lines to highlight, counted from 1. */
  highlight: ReadonlySet<number>;
  /** Numbers of the lines added. */
  added: ReadonlySet<number>;
  /** Numbers of the lines removed. */
  removed: ReadonlySet<number>;
}

/** "1,3-5" as the set {1, 3, 4, 5}. */
function lineNumbers(list: string, into: Set<number>): void {
  for (const part of list.split(",")) {
    const [from, to] = part.trim().split("-").map(Number);
    if (!Number.isInteger(from) || from < 1) continue;
    const last = Number.isInteger(to) && to >= from ? to : from;
    // A typo as {1-100000} must not hang the editor.
    for (let n = from; n <= Math.min(last, from + 10_000); n++) into.add(n);
  }
}

const RANGES = /\b(ins|add|del|rm|hl|mark)=\{([\d,\s-]*)\}/g;
const HIGHLIGHT = /\{([\d,\s-]*)\}/g;
const TITLE = /\b(?:title|filename|file)=(?:"([^"]*)"|'([^']*)')/;

/** Reads the text after the opening fence: "ts src/app.ts {3}". */
export function parseCodeInfo(text: string): CodeInfo {
  const highlight = new Set<number>();
  const added = new Set<number>();
  const removed = new Set<number>();
  const sets: Record<string, Set<number>> = {
    ins: added,
    add: added,
    del: removed,
    rm: removed,
    hl: highlight,
    mark: highlight,
  };
  let file = "";
  let rest = text
    .replace(RANGES, (_, key: string, list: string) => {
      lineNumbers(list, sets[key]);
      return " ";
    })
    .replace(HIGHLIGHT, (_, list: string) => {
      lineNumbers(list, highlight);
      return " ";
    })
    .replace(TITLE, (_, double?: string, single?: string) => {
      file = double ?? single ?? "";
      return " ";
    });
  let diff = false;
  const words = rest
    .trim()
    .split(/\s+/)
    .filter((word) => {
      if (word.toLowerCase() !== "diff") return true;
      diff = true;
      return false;
    });
  rest = words[0] ?? "";
  let language = "";
  const colon = rest.indexOf(":");
  if (file === "" && colon > 0) {
    language = rest.slice(0, colon);
    file = rest.slice(colon + 1);
  } else if (file === "" && /[./]/.test(rest)) {
    file = rest;
  } else {
    language = rest;
    if (file === "" && words[1] !== undefined) file = words[1];
  }
  // "```diff" alone is a diff of no language in particular.
  if (diff && language === "" && file === "") language = "diff";
  return {
    language: language.toLowerCase(),
    file,
    diff,
    highlight,
    added,
    removed,
  };
}

/** The extension of a file, or of a language name, and how it reads. */
export interface CodeKind {
  /** As shown on the badge, without the dot: "ts", "yml". */
  ext: string;
  /** As people call it: "TypeScript". */
  name: string;
}

/** Extensions and the names of their languages. */
const NAMES: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cjs: "JavaScript",
  cpp: "C++",
  cs: "C#",
  css: "CSS",
  diff: "Diff",
  dockerfile: "Dockerfile",
  go: "Go",
  graphql: "GraphQL",
  h: "C",
  html: "HTML",
  ini: "INI",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  kt: "Kotlin",
  md: "Markdown",
  mjs: "JavaScript",
  mts: "TypeScript",
  patch: "Diff",
  php: "PHP",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  scss: "SCSS",
  sh: "Shell",
  sql: "SQL",
  svg: "SVG",
  swift: "Swift",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TSX",
  txt: "Text",
  vue: "Vue",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  zsh: "Zsh",
};

/** Language names as written after the fence, and their extensions. */
const EXTENSIONS: Record<string, string> = {
  "c#": "cs",
  "c++": "cpp",
  csharp: "cs",
  console: "sh",
  docker: "dockerfile",
  golang: "go",
  javascript: "js",
  kotlin: "kt",
  markdown: "md",
  plain: "txt",
  plaintext: "txt",
  python: "py",
  ruby: "rb",
  rust: "rs",
  shell: "sh",
  text: "txt",
  typescript: "ts",
};

/** The extension of a path, as "ts", or "dockerfile" for a Dockerfile. */
export function extensionOf(path: string): string {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  if (name === "dockerfile" || name.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : "";
}

/**
 * The badge and the name of a block. A diff of a file reads as the
 * language of the file; with neither a language nor a file, as text.
 */
export function codeKind(info: CodeInfo): CodeKind {
  const named =
    info.language === "diff" && info.file !== "" ? "" : info.language;
  const ext =
    (Object.hasOwn(NAMES, named) ? named : undefined) ??
    (Object.hasOwn(EXTENSIONS, named) ? EXTENSIONS[named] : undefined) ??
    (info.file !== "" ? extensionOf(info.file) : "");
  const shown = ext || named || "txt";
  const name =
    (Object.hasOwn(NAMES, shown) ? NAMES[shown] : undefined) ??
    (named === "" ? NAMES.txt : named[0].toUpperCase() + named.slice(1));
  return { ext: shown, name };
}

/**
 * The language to highlight a block with, as a name or a file name for
 * `@codemirror/language-data`: the language named, or the one of the file
 * for "```diff src/app.ts" and "```docker-compose.yml".
 */
export function highlightTarget(
  info: CodeInfo,
): { name: string } | { file: string } | null {
  if (info.language !== "" && !(info.language === "diff" && info.file)) {
    return { name: info.language };
  }
  if (info.file !== "") return { file: info.file.split("/").pop() ?? "" };
  return null;
}

/** How a line of a block is marked. */
export type LineMark = "added" | "removed" | "highlight" | "meta" | null;

export interface CodeLine {
  mark: LineMark;
  /** How many characters at its start are diff marks, to be hidden. */
  prefix: number;
  /**
   * Where a `[!code ...]` note starts, with the spaces before it; it runs
   * to the end of the line. Null if there is none.
   */
  noteFrom: number | null;
}

const NOTE =
  /\s*(?:\/\/|#|--|;|<!--|\/\*)\s*\[!code\s+(\+\+|--|highlight|hl)\]\s*(?:-->|\*\/)?\s*$/;

/** The header lines of a unified diff, shown as they are. */
const DIFF_HEADER = /^(?:diff --git |index |\+\+\+ |--- |@@)/;

/**
 * Reads line `number` of a block (from 1, the line after the fence),
 * without the indentation of the block.
 */
export function readCodeLine(
  text: string,
  number: number,
  info: CodeInfo,
): CodeLine {
  let mark: LineMark = null;
  let prefix = 0;
  if (info.diff) {
    if (DIFF_HEADER.test(text)) mark = "meta";
    else if (text.startsWith("+")) [mark, prefix] = ["added", 1];
    else if (text.startsWith("-")) [mark, prefix] = ["removed", 1];
    else if (text.startsWith(" ")) prefix = 1;
  }
  const note = mark === "meta" ? null : NOTE.exec(text.slice(prefix));
  if (note !== null) {
    mark =
      note[1] === "++" ? "added" : note[1] === "--" ? "removed" : "highlight";
  } else if (mark === null) {
    if (info.added.has(number)) mark = "added";
    else if (info.removed.has(number)) mark = "removed";
    else if (info.highlight.has(number)) mark = "highlight";
  }
  return {
    mark,
    prefix,
    noteFrom: note === null ? null : prefix + note.index,
  };
}

export interface CodeSummary {
  /** The code as it is after the change: no removed lines, no marks. */
  code: string;
  lines: number;
  added: number;
  removed: number;
}

/** The code of a block to copy and count, from its lines. */
export function summarizeCode(lines: string[], info: CodeInfo): CodeSummary {
  const kept: string[] = [];
  let added = 0;
  let removed = 0;
  lines.forEach((text, index) => {
    const line = readCodeLine(text, index + 1, info);
    if (line.mark === "added") added++;
    if (line.mark === "removed") removed++;
    if (line.mark === "removed" || line.mark === "meta") return;
    kept.push(text.slice(line.prefix, line.noteFrom ?? text.length));
  });
  return { code: kept.join("\n"), lines: lines.length, added, removed };
}

/** The number of characters as people count them: an emoji is one. */
export function characterCount(text: string): number {
  return [...text].length;
}
