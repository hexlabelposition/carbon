/**
 * Markdown samples with the inline tags they hold: the label of each tag,
 * without "#", as written and in order. Shared by the parser tests and,
 * later, the editor tests (ARCHITECTURE.md, 11).
 */
export interface TagSample {
  name: string;
  markdown: string;
  tags: string[];
}

export const tagSamples: TagSample[] = [
  // What is a tag.
  { name: "a tag", markdown: "Some #idea here", tags: ["idea"] },
  { name: "at the start of a line", markdown: "#idea", tags: ["idea"] },
  { name: "nested", markdown: "#area/topic/sub", tags: ["area/topic/sub"] },
  {
    name: "letters of any script",
    markdown: "#ідея #проект/план #日本",
    tags: ["ідея", "проект/план", "日本"],
  },
  {
    name: "digits, dashes and underscores",
    markdown: "#year-2026 #to_do #v2",
    tags: ["year-2026", "to_do", "v2"],
  },
  {
    name: "on a later line of a paragraph",
    markdown: "First line\n#second",
    tags: ["second"],
  },
  { name: "in a heading", markdown: "# Plans #work", tags: ["work"] },
  { name: "in a list item", markdown: "- buy milk #home", tags: ["home"] },
  { name: "in a quote", markdown: "> said #quote", tags: ["quote"] },
  {
    name: "in a table cell",
    markdown: "| a | b |\n| - | - |\n| #x | y |",
    tags: ["x"],
  },
  { name: "with emphasis around", markdown: "**#bold** tag", tags: [] },
  { name: "the same tag twice", markdown: "#a and #a", tags: ["a", "a"] },

  // Where a tag ends.
  {
    name: "before punctuation",
    markdown: "#idea, #next.",
    tags: ["idea", "next"],
  },
  { name: "a slash at the end", markdown: "#a/b/ then", tags: ["a/b"] },
  { name: "a double slash", markdown: "#a//b", tags: ["a"] },

  // What is no tag.
  { name: "a heading", markdown: "# Heading", tags: [] },
  { name: "a lone hash", markdown: "# and #", tags: [] },
  { name: "only digits", markdown: "#2026 #1", tags: [] },
  { name: "only marks", markdown: "#-_ #/a", tags: [] },
  { name: "inside a word", markdown: "C#sharp a#b", tags: [] },
  { name: "after punctuation", markdown: "(#x) [#y]", tags: [] },
  { name: "in inline code", markdown: "`#code` here", tags: [] },
  { name: "in a code block", markdown: "```\n#code\n```", tags: [] },
  { name: "in a web address", markdown: "https://a.dev/#frag", tags: [] },
  { name: "in a wiki link", markdown: "[[Note#Heading]]", tags: [] },
  { name: "in a Markdown link", markdown: "[#x](a.md#y)", tags: [] },
];
