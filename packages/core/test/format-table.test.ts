import { describe, expect, test } from "bun:test";
import { formatTable, splitRow, textWidth } from "../src/parser/format-table";
import { applyChanges, formatNote } from "../src/parser/format-note";

describe("textWidth", () => {
  test("one column a character, two for wide ones and emoji", () => {
    expect(textWidth("abc")).toBe(3);
    expect(textWidth("Привет")).toBe(6);
    expect(textWidth("日本")).toBe(4);
    expect(textWidth("✅ ok")).toBe(5);
    // An accent made of two code points, and a family of emoji, are one.
    expect(textWidth("é")).toBe(1);
    expect(textWidth("👨‍👩‍👧")).toBe(2);
  });
});

describe("splitRow", () => {
  test("with pipes at the ends or without, trimmed", () => {
    expect(splitRow("| a | b |")).toEqual(["a", "b"]);
    expect(splitRow("a|b")).toEqual(["a", "b"]);
    expect(splitRow("|  | b |")).toEqual(["", "b"]);
  });

  test("an escaped pipe stays in its cell, in code too", () => {
    expect(splitRow("| a \\| b | `x \\| y` |")).toEqual([
      "a \\| b",
      "`x \\| y`",
    ]);
  });
});

describe("formatTable", () => {
  test("lines up the pipes, each column as wide as its widest cell", () => {
    expect(
      formatTable(["|Name|Age|", "|-|-|", "|Alice|30|", "|Bob|4|"]),
    ).toEqual([
      "| Name  | Age |",
      "| ----- | --- |",
      "| Alice | 30  |",
      "| Bob   | 4   |",
    ]);
  });

  test("pads each cell as its column aligns, the colons kept", () => {
    expect(
      formatTable([
        "| a | b | c |",
        "|:-|:-:|-:|",
        "| x | y | z |",
        "| long | long | long |",
      ]),
    ).toEqual([
      "| a    |  b   |    c |",
      "| :--- | :--: | ---: |",
      "| x    |  y   |    z |",
      "| long | long | long |",
    ]);
  });

  test("counts wide characters as two columns", () => {
    expect(
      formatTable(["| 名前 | x |", "| --- | --- |", "| ab | y |"]),
    ).toEqual(["| 名前 | x   |", "| ---- | --- |", "| ab   | y   |"]);
  });

  test("fills short rows, keeps the cells of long ones", () => {
    expect(formatTable(["a | b", "--- | ---", "1", "1 | 2 | 3"])).toEqual([
      "| a   | b   |     |",
      "| --- | --- | --- |",
      "| 1   |     |     |",
      "| 1   | 2   | 3   |",
    ]);
  });

  test("not a table without a delimiter row", () => {
    expect(formatTable(["| a |", "| b |"])).toBeNull();
  });
});

describe("formatNote with tables", () => {
  const format = (text: string) => applyChanges(text, formatNote(text));

  test("lays out a table, the rest as it was", () => {
    expect(format("Text\n\n|a|bb|\n|-|-|\n|ccc|d|\n\nMore\n")).toBe(
      "Text\n\n| a   | bb  |\n| --- | --- |\n| ccc | d   |\n\nMore\n",
    );
  });

  test("leaves a table that is laid out already", () => {
    const text = "| a   | b   |\n| --- | --- |\n| 1   | 2   |\n";
    expect(formatNote(text)).toEqual([]);
  });

  test("a table at the end, with the line break added after it", () => {
    expect(format("|a|b|\n|-|-|\n|1|2|")).toBe(
      "| a   | b   |\n| --- | --- |\n| 1   | 2   |\n",
    );
  });

  test("next to a heading, both tidied", () => {
    expect(format("# Title\n|a|b|\n|-|-|\n")).toBe(
      "# Title\n\n| a   | b   |\n| --- | --- |\n",
    );
  });

  test("keeps the line breaks of the note in a table", () => {
    expect(format("|a|b|\r\n|-|-|\r\n")).toBe(
      "| a   | b   |\r\n| --- | --- |\r\n",
    );
  });

  test("leaves tables in quotes and in code blocks", () => {
    const text = "> |a|b|\n> |-|-|\n\n```\n|a|b|\n|-|-|\n```\n";
    expect(format(text)).toBe(text);
  });
});
