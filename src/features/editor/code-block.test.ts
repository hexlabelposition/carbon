import { describe, expect, test } from "bun:test";
import {
  characterCount,
  codeKind,
  highlightTarget,
  parseCodeInfo,
  readCodeLine,
  summarizeCode,
} from "./code-block";

const numbers = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b);

describe("parseCodeInfo", () => {
  test("a language alone", () => {
    const info = parseCodeInfo("ts");
    expect(info.language).toBe("ts");
    expect(info.file).toBe("");
    expect(info.diff).toBe(false);
  });

  test("the file after the language, in every way it is written", () => {
    for (const text of [
      "ts src/app.ts",
      'ts title="src/app.ts"',
      "ts title='src/app.ts'",
      'ts filename="src/app.ts"',
      "ts:src/app.ts",
    ]) {
      const info = parseCodeInfo(text);
      expect([info.language, info.file]).toEqual(["ts", "src/app.ts"]);
    }
  });

  test("a file alone", () => {
    const info = parseCodeInfo("docker-compose.yml");
    expect([info.language, info.file]).toEqual(["", "docker-compose.yml"]);
  });

  test("lines to highlight, add and remove, in any order", () => {
    const info = parseCodeInfo("ts del={2} src/app.ts {1,3-4} ins={5-6}");
    expect(info.file).toBe("src/app.ts");
    expect(numbers(info.highlight)).toEqual([1, 3, 4]);
    expect(numbers(info.added)).toEqual([5, 6]);
    expect(numbers(info.removed)).toEqual([2]);
  });

  test("a range written backwards is its first line, 0 is no line", () => {
    const info = parseCodeInfo("ts {5-2,0}");
    expect(numbers(info.highlight)).toEqual([5]);
  });

  test("diff: alone, with a file or after a language", () => {
    expect(parseCodeInfo("diff")).toMatchObject({
      language: "diff",
      diff: true,
    });
    expect(parseCodeInfo("diff src/app.ts")).toMatchObject({
      language: "",
      file: "src/app.ts",
      diff: true,
    });
    expect(parseCodeInfo("ts diff")).toMatchObject({
      language: "ts",
      diff: true,
    });
  });

  test("an empty fence", () => {
    expect(parseCodeInfo("")).toMatchObject({ language: "", file: "" });
  });
});

describe("codeKind and highlightTarget", () => {
  test("a known language", () => {
    expect(codeKind(parseCodeInfo("typescript"))).toEqual({
      ext: "ts",
      name: "TypeScript",
    });
  });

  test("the extension of the file when no language is named", () => {
    const info = parseCodeInfo("docker-compose.yml");
    expect(codeKind(info)).toEqual({ ext: "yml", name: "YAML" });
    expect(highlightTarget(info)).toEqual({ file: "docker-compose.yml" });
  });

  test("a diff of a file reads as the language of the file", () => {
    const info = parseCodeInfo("diff cmd/main.go");
    expect(codeKind(info)).toEqual({ ext: "go", name: "Go" });
    expect(highlightTarget(info)).toEqual({ file: "main.go" });
  });

  test("a Dockerfile", () => {
    expect(codeKind(parseCodeInfo("deploy/Dockerfile")).ext).toBe("dockerfile");
  });

  test("an unknown language keeps its name, nothing reads as text", () => {
    expect(codeKind(parseCodeInfo("zig"))).toEqual({ ext: "zig", name: "Zig" });
    expect(codeKind(parseCodeInfo(""))).toEqual({ ext: "txt", name: "Text" });
    expect(highlightTarget(parseCodeInfo(""))).toBeNull();
  });

  test("names of the object prototype are no languages", () => {
    expect(codeKind(parseCodeInfo("constructor")).name).toBe("Constructor");
  });
});

describe("readCodeLine", () => {
  const plain = parseCodeInfo("ts");
  const diff = parseCodeInfo("diff src/app.ts");

  test("a plain line has no mark", () => {
    expect(readCodeLine("const a = 1", 1, plain)).toEqual({
      mark: null,
      prefix: 0,
      noteFrom: null,
    });
  });

  test("notes at the end of a line, after any comment mark", () => {
    const line = "const a = 1 // [!code ++]";
    expect(readCodeLine(line, 1, plain)).toEqual({
      mark: "added",
      prefix: 0,
      noteFrom: "const a = 1".length,
    });
    expect(readCodeLine("x = 1 # [!code --]", 1, plain).mark).toBe("removed");
    expect(readCodeLine("<b/> <!-- [!code hl] -->", 1, plain).mark).toBe(
      "highlight",
    );
    expect(readCodeLine("a /* [!code highlight] */", 1, plain).mark).toBe(
      "highlight",
    );
  });

  test("a note in the middle of a line is code", () => {
    expect(readCodeLine("// [!code ++] here", 1, plain).mark).toBeNull();
  });

  test("diff prefixes", () => {
    expect(readCodeLine("+added", 1, diff)).toMatchObject({
      mark: "added",
      prefix: 1,
    });
    expect(readCodeLine("-removed", 1, diff)).toMatchObject({
      mark: "removed",
      prefix: 1,
    });
    expect(readCodeLine(" kept", 1, diff)).toMatchObject({
      mark: null,
      prefix: 1,
    });
    expect(readCodeLine("@@ -1,2 +1,3 @@", 1, diff).mark).toBe("meta");
    expect(readCodeLine("--- a/app.ts", 1, diff).mark).toBe("meta");
  });

  test("outside a diff, a leading minus is code", () => {
    expect(readCodeLine("-x", 1, plain).mark).toBeNull();
  });

  test("lines marked by number", () => {
    const info = parseCodeInfo("ts {1} ins={2} del={3}");
    expect(readCodeLine("a", 1, info).mark).toBe("highlight");
    expect(readCodeLine("b", 2, info).mark).toBe("added");
    expect(readCodeLine("c", 3, info).mark).toBe("removed");
    expect(readCodeLine("d", 4, info).mark).toBeNull();
  });
});

describe("summarizeCode", () => {
  test("the code after the change, without marks and notes", () => {
    const info = parseCodeInfo("diff src/app.ts");
    const summary = summarizeCode(
      ["@@ -1 +1 @@", " a", "-b", "+c // [!code ++]", "+d"],
      info,
    );
    expect(summary).toEqual({
      code: "a\nc\nd",
      lines: 5,
      added: 2,
      removed: 1,
    });
  });

  test("a block with no marks is copied as it is", () => {
    const summary = summarizeCode(["a", "  b"], parseCodeInfo("ts"));
    expect(summary).toEqual({ code: "a\n  b", lines: 2, added: 0, removed: 0 });
  });
});

describe("counts", () => {
  test("characters as people count them: an emoji is one", () => {
    expect(characterCount("aб😀")).toBe(3);
  });
});
