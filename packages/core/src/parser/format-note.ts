import { findFrontmatter } from "./frontmatter";
import type { TextChange } from "./frontmatter-edit";
import { formatTable } from "./format-table";
import { markdownParser } from "./parse-note";

/** A line of only spaces and tabs, or of nothing. */
const BLANK = /^[ \t]*$/;

/**
 * The changes that tidy up the layout of a note, smallest first to last,
 * none if it is tidy already:
 *
 * - No blank lines at its start, nor right below the frontmatter.
 * - One blank line above and below every heading, none above one at the
 *   start; more blank lines there become one.
 * - It ends in one line break: blank lines at the end go, and a note
 *   without a line break at its end gets one. An empty note stays empty.
 * - Every table is laid out as Prettier lays it out (`formatTable`): its
 *   pipes in line, each column as wide as its widest cell.
 *
 * Only the headings and tables of the note itself count, not those in a
 * list or a quote: a blank line there would change the list or need the
 * quote mark, and the rows of a table there start with its marks. Code blocks are never touched, as the grammar of the editor
 * finds them (ADR-012). Changes go by whole lines, so a cursor or a
 * selection away from them keeps its place. Line breaks are kept as the
 * note writes them, `\r\n` too.
 */
export function formatNote(text: string): TextChange[] {
  const frontmatter = findFrontmatter(text);
  const start = frontmatter === null ? 0 : frontmatter.block.length;
  const body = text.slice(start);
  const lineBreak = body.includes("\r\n") ? "\r\n" : "\n";
  const lines = splitLines(body);
  if (lines.every((line) => BLANK.test(line.text))) {
    // Nothing but blank lines below the frontmatter, or in the note: they
    // go, and the frontmatter ends in its own line break.
    return body === "" ? [] : [{ from: start, to: text.length, insert: "" }];
  }

  // The headings and tables of the note itself, by the lines they take.
  const headingStarts = new Set<number>();
  const headingEnds = new Set<number>();
  const tables: { first: number; last: number }[] = [];
  // Parsed with "\n" for "\r\n": a "\r" at its end keeps a line from
  // being the delimiter row of a table. Found by line, which the two
  // texts have alike.
  const plain = body.replace(/\r\n/g, "\n");
  const plainLines = plain === body ? lines : splitLines(plain);
  const tree = markdownParser.parse(plain);
  for (
    let node = tree.topNode.firstChild;
    node !== null;
    node = node.nextSibling
  ) {
    const first = lineAt(plainLines, node.from);
    const last = lineAt(plainLines, Math.max(node.from, node.to - 1));
    if (node.name === "Table") tables.push({ first, last });
    if (!/^(ATX|Setext)Heading\d$/.test(node.name)) continue;
    headingStarts.add(first);
    headingEnds.add(last);
  }

  const changes: TextChange[] = [];
  // Each table, as a whole, if its layout changes. Only the text of its
  // lines: the breaks between them stay.
  for (const { first, last } of tables) {
    const rows = lines.slice(first, last + 1);
    const laidOut = formatTable(rows.map((line) => line.text));
    if (laidOut === null) continue;
    if (laidOut.every((text, i) => text === rows[i].text)) continue;
    const insert = laidOut
      .map((text, i) => (i === 0 ? "" : rows[i].breakBefore) + text)
      .join("");
    changes.push({
      from: start + rows[0].from,
      to: start + rows[rows.length - 1].end,
      insert,
    });
  }
  const first = lines.findIndex((line) => !BLANK.test(line.text));
  let last = lines.length - 1;
  while (BLANK.test(lines[last].text)) last--;
  if (first > 0) {
    // Blank lines at the start go.
    changes.push({ from: start, to: start + lines[first].from, insert: "" });
  }
  // Between the first and the last line with text: each run of blank
  // lines, or the place where one is missing, next to a heading.
  for (let i = first; i < last; i++) {
    let next = i + 1;
    while (BLANK.test(lines[next].text)) next++;
    const blanks = next - i - 1;
    const wanted = headingEnds.has(i) || headingStarts.has(next) ? 1 : blanks;
    if (wanted === blanks) {
      i = next - 1;
      continue;
    }
    const from = start + lines[i].end;
    const to = start + lines[next].from - lineBreakAt(lines, next).length;
    changes.push({ from, to, insert: lineBreak.repeat(wanted) });
    i = next - 1;
  }
  // The end: the last line with text, then one line break.
  const end = start + lines[last].end;
  const tail = text.slice(end);
  if (tail !== lineBreak) {
    changes.push({ from: end, to: text.length, insert: lineBreak });
  }
  // In order: a table ends where the blank lines after it start.
  return changes.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** Applies the changes of `formatNote`, which come in order. */
export function applyChanges(text: string, changes: TextChange[]): string {
  let result = "";
  let at = 0;
  for (const change of changes) {
    result += text.slice(at, change.from) + change.insert;
    at = change.to;
  }
  return result + text.slice(at);
}

interface Line {
  /** Where it starts in the text, and where it ends, before its break. */
  from: number;
  end: number;
  text: string;
  /** The line break before it: "" for the first line. */
  breakBefore: string;
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  const pattern = /\r?\n/g;
  let from = 0;
  let breakBefore = "";
  for (let match = pattern.exec(text); match !== null;) {
    lines.push({
      from,
      end: match.index,
      text: text.slice(from, match.index),
      breakBefore,
    });
    breakBefore = match[0];
    from = match.index + match[0].length;
    match = pattern.exec(text);
  }
  lines.push({ from, end: text.length, text: text.slice(from), breakBefore });
  return lines;
}

/** The line break before line `index`. */
function lineBreakAt(lines: Line[], index: number): string {
  return lines[index].breakBefore;
}

/** The index of the line that holds `offset`. */
function lineAt(lines: Line[], offset: number): number {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (lines[middle].from <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}
