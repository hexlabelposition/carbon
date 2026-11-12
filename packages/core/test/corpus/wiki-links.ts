/**
 * Markdown samples with the wiki links they hold, as written: the parts are
 * the exact text of each node, `null` where a part has no node. Shared by
 * the parser tests and, later, the editor tests (ARCHITECTURE.md, 11).
 */
export interface WikiLinkSample {
  name: string;
  markdown: string;
  links: {
    text: string;
    target: string | null;
    fragment: string | null;
    alias: string | null;
  }[];
}

const link = (
  text: string,
  target: string | null,
  fragment: string | null = null,
  alias: string | null = null,
) => ({ text, target, fragment, alias });

export const wikiLinkSamples: WikiLinkSample[] = [
  // What is a link.
  {
    name: "a note",
    markdown: "See [[Note]].",
    links: [link("[[Note]]", "Note")],
  },
  {
    name: "a note in a folder",
    markdown: "[[projects/Carbon]]",
    links: [link("[[projects/Carbon]]", "projects/Carbon")],
  },
  {
    name: "an alias",
    markdown: "[[Note|the note]]",
    links: [link("[[Note|the note]]", "Note", null, "the note")],
  },
  {
    name: "a heading",
    markdown: "[[Note#Some heading]]",
    links: [link("[[Note#Some heading]]", "Note", "Some heading")],
  },
  {
    name: "a heading and an alias",
    markdown: "[[Note#Heading|alias]]",
    links: [link("[[Note#Heading|alias]]", "Note", "Heading", "alias")],
  },
  {
    name: "a nested heading",
    markdown: "[[Note#One#Two]]",
    links: [link("[[Note#One#Two]]", "Note", "One#Two")],
  },
  {
    name: "a heading of the same note",
    markdown: "[[#Heading]]",
    links: [link("[[#Heading]]", null, "Heading")],
  },
  {
    name: "an empty heading after a note",
    markdown: "[[Note#]]",
    links: [link("[[Note#]]", "Note")],
  },
  {
    name: "spaces kept as written",
    markdown: "[[ Note | alias ]]",
    links: [link("[[ Note | alias ]]", " Note ", null, " alias ")],
  },
  {
    name: "an alias with brackets, pipes and hashes",
    markdown: "[[Note|a [b] | #c]]",
    links: [link("[[Note|a [b] | #c]]", "Note", null, "a [b] | #c")],
  },
  {
    name: "an escaped pipe",
    markdown: "[[Note\\|alias]]",
    links: [link("[[Note\\|alias]]", "Note", null, "alias")],
  },
  {
    name: "several links",
    markdown: "[[A]] and [[B|b]], then [[C#c]]",
    links: [
      link("[[A]]", "A"),
      link("[[B|b]]", "B", null, "b"),
      link("[[C#c]]", "C", "c"),
    ],
  },
  {
    name: "a link in brackets",
    markdown: "[[[Note]]]",
    links: [link("[[Note]]", "Note")],
  },
  {
    name: "a link in emphasis",
    markdown: "**[[Note]]**",
    links: [link("[[Note]]", "Note")],
  },
  {
    name: "a link in a heading",
    markdown: "## About [[Note]]",
    links: [link("[[Note]]", "Note")],
  },
  {
    name: "a link in a list and a quote",
    markdown: "- [[A]]\n\n> [[B]]",
    links: [link("[[A]]", "A"), link("[[B]]", "B")],
  },
  {
    name: "a link with an alias in a table",
    markdown: "| Note |\n| --- |\n| [[Note\\|alias]] |",
    links: [link("[[Note\\|alias]]", "Note", null, "alias")],
  },
  {
    name: "an image is still an image",
    markdown: "![alt](a.png) ![[Note]]",
    links: [link("[[Note]]", "Note")],
  },
  {
    name: "an embed keeps its link",
    markdown: "![[Picture.png]]",
    links: [link("[[Picture.png]]", "Picture.png")],
  },

  // What is not.
  { name: "empty", markdown: "[[]]", links: [] },
  { name: "spaces only", markdown: "[[  ]]", links: [] },
  { name: "an alias only", markdown: "[[|alias]]", links: [] },
  { name: "a hash only", markdown: "[[#]]", links: [] },
  { name: "not closed", markdown: "[[Note", links: [] },
  { name: "closed by one bracket", markdown: "[[Note]", links: [] },
  { name: "across lines", markdown: "[[No\nte]]", links: [] },
  { name: "a bracket in the target", markdown: "[[a [b]] c]]", links: [] },
  { name: "escaped", markdown: "\\[[Note]]", links: [] },
  { name: "in inline code", markdown: "`[[Note]]`", links: [] },
  { name: "in a code block", markdown: "```\n[[Note]]\n```", links: [] },
];
