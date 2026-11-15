import { describe, expect, test } from "bun:test";
import { markdownParser, parseNote } from "../src/index";
import { tagSamples } from "./corpus/tags";

/** The labels of the tags of a text, as written, in order. */
function labels(text: string): string[] {
  const found: string[] = [];
  markdownParser.parse(text).iterate({
    enter(node) {
      if (node.name === "HashtagLabel") {
        found.push(text.slice(node.from, node.to));
      }
    },
  });
  return found;
}

describe("hashtag", () => {
  test.each(tagSamples.map((s) => [s.name, s] as const))("%s", (_, sample) => {
    expect(labels(sample.markdown)).toEqual(sample.tags);
  });

  test("marks the hash and covers the whole tag", () => {
    const text = "x #area/topic y";
    const nodes: [string, string][] = [];
    markdownParser.parse(text).iterate({
      enter(node) {
        if (node.name.startsWith("Hashtag")) {
          nodes.push([node.name, text.slice(node.from, node.to)]);
        }
      },
    });
    expect(nodes).toEqual([
      ["Hashtag", "#area/topic"],
      ["HashtagMark", "#"],
      ["HashtagLabel", "area/topic"],
    ]);
  });
});

describe("parseNote tags", () => {
  test("are the inline tags, once each, in order", () => {
    expect(parseNote("a.md", "#b then #a, #b/c and #b").tags).toEqual([
      "b",
      "a",
      "b/c",
    ]);
  });

  test("differing only in case are one, as first written", () => {
    expect(parseNote("a.md", "#Work #work #Ёлка #ёлка").tags).toEqual([
      "Work",
      "Ёлка",
    ]);
  });

  test("leave the frontmatter out", () => {
    expect(parseNote("a.md", "---\nx: #y\n---\n#z").tags).toEqual(["z"]);
  });

  test("stay in the plain text, to be searched", () => {
    expect(parseNote("a.md", "Some #idea").plainText).toBe("Some #idea");
  });
});
