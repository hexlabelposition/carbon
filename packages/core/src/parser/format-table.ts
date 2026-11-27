/** How a column of a table aligns its cells, as its delimiter row says. */
type Align = "none" | "left" | "center" | "right";

/** A cell of the delimiter row: dashes, a colon at either end or both. */
const DELIMITER = /^:?-+:?$/;

/** Splits text into what a reader sees as one character each. */
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * East Asian wide and full-width characters, which take two columns of
 * a monospace font, as `string-width` counts them for Prettier.
 */
const WIDE =
  /[ᄀ-ᅟ⌚⌛〈〉⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏ꥠ-꥿가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦\u{1F300}-\u{1F64F}\u{1F900}-\u{1F9FF}\u{20000}-\u{3FFFD}]/u;

/** A character drawn as a picture, an emoji: two columns wide. */
const PICTURE = /\p{Extended_Pictographic}/u;

/**
 * How many columns of a monospace font `text` takes: two for a wide
 * character or an emoji, one for any other, however many code points it
 * is made of (an accent, a flag, a family of emoji).
 */
export function textWidth(text: string): number {
  let width = 0;
  for (const { segment } of graphemes.segment(text)) {
    width += WIDE.test(segment) || PICTURE.test(segment) ? 2 : 1;
  }
  return width;
}

/**
 * The cells of a row of a table, trimmed: split at each `|` not escaped
 * by a backslash, as GFM splits them, in code spans too. The pipes at its
 * ends, if it has them, start and end the row.
 */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\" && i + 1 < line.length) {
      cell += char + line[i + 1];
      i++;
    } else if (char === "|") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  const trimmed = line.trim();
  if (trimmed.startsWith("|")) cells.shift();
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) cells.pop();
  return cells.map((text) => text.trim());
}

function alignOf(cell: string): Align {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return "none";
}

/** `text` padded with spaces to `width` columns, as its column aligns. */
function pad(text: string, width: number, align: Align): string {
  const room = width - textWidth(text);
  if (room <= 0) return text;
  if (align === "right") return " ".repeat(room) + text;
  if (align === "center") {
    const before = Math.floor(room / 2);
    return " ".repeat(before) + text + " ".repeat(room - before);
  }
  return text + " ".repeat(room);
}

/** The cell of the delimiter row of a column `width` wide. */
function delimiter(width: number, align: Align): string {
  if (align === "center") return `:${"-".repeat(width - 2)}:`;
  if (align === "left") return `:${"-".repeat(width - 1)}`;
  if (align === "right") return `${"-".repeat(width - 1)}:`;
  return "-".repeat(width);
}

/**
 * The lines of a GFM table laid out as Prettier lays them out: a pipe at
 * each end of every row and one space inside each, each column as wide
 * as its widest cell (at least three, for the dashes), the cells padded
 * as their column aligns, and the delimiter row filled with dashes. A row
 * with fewer cells than the widest one gets empty cells; one with more
 * keeps them, as columns of their own, so no text is lost. Indentation
 * before the table goes. `null` if the second line is not a delimiter
 * row: then it is not a table.
 */
export function formatTable(lines: readonly string[]): string[] | null {
  if (lines.length < 2) return null;
  const rows = lines.map(splitRow);
  const delimiters = rows[1];
  if (delimiters.length === 0 || !delimiters.every((c) => DELIMITER.test(c))) {
    return null;
  }
  const columns = Math.max(...rows.map((row) => row.length));
  const aligns = Array.from({ length: columns }, (_, i) =>
    alignOf(delimiters[i] ?? ""),
  );
  const widths = Array.from({ length: columns }, (_, i) =>
    Math.max(
      3,
      ...rows.map((row, index) =>
        // The delimiter row has no text: its dashes fill the column.
        index === 1 ? 0 : textWidth(row[i] ?? ""),
      ),
    ),
  );
  return rows.map((row, index) => {
    const cells = widths.map((width, i) =>
      index === 1
        ? delimiter(width, aligns[i])
        : pad(row[i] ?? "", width, aligns[i]),
    );
    return `| ${cells.join(" | ")} |`;
  });
}
