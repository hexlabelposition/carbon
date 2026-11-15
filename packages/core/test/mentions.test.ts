import { describe, expect, test } from "bun:test";
import { contentHash, Vault } from "../src/index";
import { findMentions, mentionQuery } from "../src/links/mentions";
import { createMemoryPlatform } from "./fakes";

/** The text of each mention found. */
const found = (text: string, title: string) =>
  findMentions(text, title).map((m) => text.slice(m.start, m.end));

describe("unlinked mentions", () => {
  describe("mentionQuery", () => {
    test("asks for the title as a phrase in the body", () => {
      expect(mentionQuery("Green tea")).toBe('body : ("green tea")');
    });

    test("in every spelling of look-alike letters", () => {
      expect(mentionQuery("Ёлка")).toBe('body : ("елка" OR "ёлка")');
    });

    test("is null for a title without words", () => {
      expect(mentionQuery("---")).toBeNull();
    });
  });

  describe("findMentions", () => {
    test("finds the title as whole words, in any case", () => {
      expect(found("Carbon is new. carbonate, CARBON!", "Carbon")).toEqual([
        "Carbon",
        "CARBON",
      ]);
    });

    test("compares as the index does", () => {
      expect(found("Новая Ёлка и cafe", "новая елка")).toEqual(["Новая Ёлка"]);
      expect(found("un cafe ici", "Café")).toEqual(["cafe"]);
    });

    test("takes any run of spaces for one, not a line break", () => {
      expect(found("a car  rental, a car\nrental", "Car rental")).toEqual([
        "car  rental",
      ]);
    });

    test("matches a title with punctuation as written", () => {
      expect(found("See C-301 notes and C 301 notes", "C-301 notes")).toEqual([
        "C-301 notes",
      ]);
    });

    test("leaves out links, code, addresses and frontmatter", () => {
      const text = [
        "---",
        "about: Carbon",
        "---",
        "[[Carbon]] [Carbon](Carbon.md) `Carbon` https://carbon.dev/Carbon",
        "",
        "```",
        "Carbon",
        "```",
        "",
        "Plain Carbon here.",
      ].join("\n");
      const mentions = findMentions(text, "Carbon");
      expect(mentions.map((m) => m.start)).toEqual([
        text.lastIndexOf("Carbon here"),
      ]);
    });

    test("gives the line around a mention, with where it is", () => {
      const text = "# Title\n\nWe use Carbon daily.\nNext line";
      const [mention] = findMentions(text, "Carbon");
      expect(mention.snippet).toBe("We use Carbon daily.");
      const { start, end } = mention.snippetMatch;
      expect(mention.snippet.slice(start, end)).toBe("Carbon");
    });

    test("cuts a long line short around the mention", () => {
      const text = `${"a".repeat(100)} Carbon ${"b".repeat(100)}`;
      const [mention] = findMentions(text, "Carbon");
      expect(mention.snippet.startsWith("…")).toBe(true);
      expect(mention.snippet.endsWith("…")).toBe(true);
      expect(mention.snippet.length).toBeLessThan(140);
      const { start, end } = mention.snippetMatch;
      expect(mention.snippet.slice(start, end)).toBe("Carbon");
    });
  });

  describe("in a vault", () => {
    async function open(files: Record<string, string>) {
      const root = "/v";
      const platform = createMemoryPlatform(
        Object.fromEntries(
          Object.entries(files).map(([path, text]) => [
            `${root}/${path}`,
            text,
          ]),
        ),
      );
      const vault = await Vault.open(root, platform);
      await vault.indexed();
      return vault;
    }

    test("lists mentions in other notes, by note, then in order", async () => {
      const vault = await open({
        "Carbon.md": "Carbon mentions itself.",
        "b.md": "Carbon here, and Carbon there.",
        "a.md": "[[Carbon]] is linked, but Carbon is not.",
        "c.md": "Nothing about it.",
      });
      const mentions = await vault.links.unlinked("Carbon.md");
      expect(mentions.map((m) => [m.source, m.start])).toEqual([
        ["a.md", 26],
        ["b.md", 0],
        ["b.md", 17],
      ]);
      expect(mentions[0].sourceTitle).toBe("a");
      vault.close();
    });

    test("turns a mention into a link", async () => {
      const vault = await open({ "Carbon.md": "", "a.md": "Use carbon now." });
      const [mention] = await vault.links.unlinked("Carbon.md");
      await vault.links.linkMention("a.md", mention, "Carbon.md");

      expect(await vault.notes.read("a.md")).toBe("Use [[Carbon|carbon]] now.");
      await vault.indexed();
      expect(await vault.links.unlinked("Carbon.md")).toEqual([]);
      expect(
        (await vault.links.backlinks("Carbon.md")).map((b) => b.source),
      ).toEqual(["a.md"]);
      vault.close();
    });

    test("links by the title as written when it matches exactly", async () => {
      const vault = await open({ "Carbon.md": "", "a.md": "Use Carbon." });
      const [mention] = await vault.links.unlinked("Carbon.md");
      await vault.links.linkMention("a.md", mention, "Carbon.md");
      expect(await vault.notes.read("a.md")).toBe("Use [[Carbon]].");
      vault.close();
    });

    test("links by path when the title finds another note", async () => {
      const vault = await open({
        "Idea.md": "",
        "deep/Idea.md": "",
        "a.md": "An Idea.",
      });
      const mentions = await vault.links.unlinked("deep/Idea.md");
      await vault.links.linkMention("a.md", mentions[0], "deep/Idea.md");
      expect(await vault.notes.read("a.md")).toBe("An [[deep/Idea|Idea]].");
      vault.close();
    });

    test("refuses a mention that is not there any more", async () => {
      const vault = await open({ "Carbon.md": "", "a.md": "Use Carbon." });
      const [mention] = await vault.links.unlinked("Carbon.md");
      await vault.notes.write("a.md", "Changed", contentHash("Use Carbon."));
      await expect(
        vault.links.linkMention("a.md", mention, "Carbon.md"),
      ).rejects.toThrow("not there any more");
      expect(await vault.notes.read("a.md")).toBe("Changed");
      vault.close();
    });
  });
});
