import { describe, expect, test } from "bun:test";
import { GFM, parser } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { wikiLink } from "../src/index";
import { wikiLinkSamples } from "./corpus/wiki-links";

const markdown = parser.configure([GFM, wikiLink]);

/** The wiki links of a text, each part as the text of its node. */
function wikiLinks(text: string) {
  const found: ReturnType<typeof describeLink>[] = [];
  markdown.parse(text).iterate({
    enter(node) {
      if (node.name !== "WikiLink") return;
      found.push(describeLink(text, node.node));
      return false;
    },
  });
  return found;
}

function describeLink(text: string, node: SyntaxNode) {
  const part = (name: string) => {
    const child = node.getChild(name);
    return child === null ? null : text.slice(child.from, child.to);
  };
  return {
    text: text.slice(node.from, node.to),
    target: part("WikiLinkTarget"),
    fragment: part("WikiLinkFragment"),
    alias: part("WikiLinkAlias"),
  };
}

describe("wikiLink", () => {
  test.each(wikiLinkSamples.map((s) => [s.name, s] as const))(
    "%s",
    (_, sample) => {
      expect(wikiLinks(sample.markdown)).toEqual(sample.links);
    },
  );

  test("marks every bracket, hash and pipe", () => {
    const text = "[[Note#Heading|alias]]";
    const marks: string[] = [];
    markdown.parse(text).iterate({
      enter(node) {
        if (node.name === "WikiLinkMark") {
          marks.push(text.slice(node.from, node.to));
        }
      },
    });
    expect(marks).toEqual(["[[", "#", "|", "]]"]);
  });

  test("leaves Markdown links and images alone", () => {
    const tree = markdown.parse(
      "[text](Note.md), [ref][1] and ![alt](a.png)\n\n[1]: x",
    );
    const names: string[] = [];
    tree.iterate({ enter: (node) => void names.push(node.name) });
    expect(names).toContain("Link");
    expect(names).toContain("Image");
    expect(names).not.toContain("WikiLink");
  });
});
