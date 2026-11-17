import { describe, expect, test } from "bun:test";
import {
  IndexStore,
  parseNote,
  Vault,
  type IndexEntry,
  type NoteGraph,
} from "../src/index";
import { createMemoryPlatform } from "./fakes";

const note = (path: string, text = ""): IndexEntry => ({
  note: parseNote(path, text),
  stamp: { mtime: 1, size: text.length, hash: "h" },
});

async function openStore(...entries: IndexEntry[]) {
  const store = await IndexStore.open(createMemoryPlatform(), "/v");
  await store.replaceNotes(entries);
  return store;
}

/** A graph as node paths, missing ones with "?", and "a>b*count" edges. */
const shape = ({ nodes, edges }: NoteGraph) => ({
  nodes: nodes.map((node) => (node.missing ? `${node.path}?` : node.path)),
  edges: edges.map((edge) => `${edge.source}>${edge.target}*${edge.count}`),
});

describe("graph of the vault", () => {
  test("every note, and an edge for each note a note links to", async () => {
    const store = await openStore(
      note("b.md", "[[a]] and [[c]] and [[a#Part]]"),
      note("a.md", "[[dir/c]]"),
      note("dir/c.md", "[up](../a.md)"),
      note("lonely.md"),
    );
    const graph = await store.graph(false);
    expect(graph.nodes).toEqual([
      { path: "a.md", title: "a", missing: false },
      { path: "b.md", title: "b", missing: false },
      { path: "dir/c.md", title: "c", missing: false },
      { path: "lonely.md", title: "lonely", missing: false },
    ]);
    expect(shape(graph).edges).toEqual([
      "a.md>dir/c.md*1",
      "b.md>a.md*2",
      "b.md>dir/c.md*1",
      "dir/c.md>a.md*1",
    ]);
  });

  test("no edge from a note to itself", async () => {
    const store = await openStore(note("Self.md", "[[Self]] [[#Part]]"));
    expect(shape(await store.graph(false))).toEqual({
      nodes: ["Self.md"],
      edges: [],
    });
  });

  test("links that find no note only when asked for", async () => {
    const store = await openStore(
      note("b.md", "[[Missing]] [[Other/Note]]"),
      note("a.md", "[[missing#Part]] [m](Missing.md) [[a]]"),
    );
    expect(shape(await store.graph(false))).toEqual({
      nodes: ["a.md", "b.md"],
      edges: [],
    });
    const graph = await store.graph(true);
    expect(shape(graph)).toEqual({
      nodes: ["Other/Note.md?", "a.md", "b.md", "missing.md?"],
      edges: ["a.md>missing.md*2", "b.md>Other/Note.md*1", "b.md>missing.md*1"],
    });
    expect(graph.nodes[3]).toEqual({
      path: "missing.md",
      title: "missing",
      missing: true,
    });
  });

  test("a missing note is spelled as the list of unresolved links has it", async () => {
    const store = await openStore(
      note("b.md", "[[IDEA]]"),
      note("a.md", "[[idea]]"),
    );
    const [unresolved] = await store.unresolved();
    expect(unresolved.path).toBe("idea.md");
    expect(shape(await store.graph(true)).nodes).toContain("idea.md?");
    expect(shape(await store.localGraph("b.md", 1, true)).nodes).toEqual([
      "b.md",
      "idea.md?",
    ]);
  });

  test("links to files that are not notes are not missing notes", async () => {
    const store = await openStore(
      note("a.md", "[[file.pdf]] [doc](file.pdf) [up](../../x.md) [[n]]"),
    );
    expect(shape(await store.graph(true))).toEqual({
      nodes: ["a.md", "n.md?"],
      edges: ["a.md>n.md*1"],
    });
  });

  test("follows the notes as they change", async () => {
    const store = await openStore(note("a.md", "[[b]]"), note("b.md"));
    await store.replaceNotes([note("a.md", "[[c]]"), note("c.md")]);
    await store.removeNotes(["b.md"]);
    expect(shape(await store.graph(false))).toEqual({
      nodes: ["a.md", "c.md"],
      edges: ["a.md>c.md*1"],
    });
  });
});

describe("local graph", () => {
  // a - b - c - d in a chain, the links going either way; e alone.
  const chain = () =>
    openStore(
      note("a.md", "[[b]]"),
      note("c.md", "[[b]] [[d]] [[gone]]"),
      note("b.md", "[[nowhere]]"),
      note("d.md", "[[far]]"),
      note("e.md"),
    );

  test("the notes at most depth links away, either way", async () => {
    const store = await chain();
    expect(shape(await store.localGraph("b.md", 1, false))).toEqual({
      nodes: ["a.md", "b.md", "c.md"],
      edges: ["a.md>b.md*1", "c.md>b.md*1"],
    });
    expect(shape(await store.localGraph("a.md", 2, false)).nodes).toEqual([
      "a.md",
      "b.md",
      "c.md",
    ]);
    expect(shape(await store.localGraph("a.md", 10, false))).toEqual({
      nodes: ["a.md", "b.md", "c.md", "d.md"],
      edges: ["a.md>b.md*1", "c.md>b.md*1", "c.md>d.md*1"],
    });
  });

  test("depth 0 is the note alone", async () => {
    const store = await chain();
    expect(shape(await store.localGraph("c.md", 0, true))).toEqual({
      nodes: ["c.md"],
      edges: [],
    });
  });

  test("keeps every edge between the notes it has", async () => {
    // a and c are both one link from b, and link to each other.
    const store = await openStore(
      note("b.md", "[[a]] [[c]]"),
      note("a.md", "[[c]]"),
      note("c.md"),
      note("x.md", "[[c]]"),
    );
    expect(shape(await store.localGraph("b.md", 1, false))).toEqual({
      nodes: ["a.md", "b.md", "c.md"],
      edges: ["a.md>c.md*1", "b.md>a.md*1", "b.md>c.md*1"],
    });
  });

  test("missing notes one link further than the notes that miss them", async () => {
    const store = await chain();
    expect(shape(await store.localGraph("b.md", 1, true))).toEqual({
      nodes: ["a.md", "b.md", "c.md", "nowhere.md?"],
      edges: ["a.md>b.md*1", "b.md>nowhere.md*1", "c.md>b.md*1"],
    });
    expect(shape(await store.localGraph("b.md", 2, true)).nodes).toEqual([
      "a.md",
      "b.md",
      "c.md",
      "d.md",
      "gone.md?",
      "nowhere.md?",
    ]);
  });

  test("empty for a note that is not indexed", async () => {
    const store = await chain();
    expect(await store.localGraph("nope.md", 2, true)).toEqual({
      nodes: [],
      edges: [],
    });
  });

  test("reaches past the size of one query", async () => {
    const hub = Array.from({ length: 1200 }, (_, i) => `[[n${i}]]`).join(" ");
    const store = await openStore(
      note("hub.md", hub),
      ...Array.from({ length: 1200 }, (_, i) =>
        note(`n${i}.md`, `[[leaf${i}]]`),
      ),
      ...Array.from({ length: 1200 }, (_, i) => note(`leaf${i}.md`)),
    );
    const graph = await store.localGraph("hub.md", 2, false);
    expect(graph.nodes).toHaveLength(2401);
    expect(graph.edges).toHaveLength(2400);
  });
});

describe("vault.graph", () => {
  async function openVault(files: Record<string, string>) {
    const platform = createMemoryPlatform(
      Object.fromEntries(
        Object.entries(files).map(([path, text]) => [`/v/${path}`, text]),
      ),
    );
    await platform.fs.mkdir("/v");
    const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
    await vault.indexed();
    return vault;
  }

  test("gives the global and the local graph, and sees saves", async () => {
    const vault = await openVault({
      "a.md": "[[b]] [[ghost]]",
      "b.md": "[[c]]",
      "c.md": "",
    });
    expect(shape(await vault.graph.global())).toEqual({
      nodes: ["a.md", "b.md", "c.md"],
      edges: ["a.md>b.md*1", "b.md>c.md*1"],
    });
    expect(shape(await vault.graph.global({ missing: true })).nodes).toEqual([
      "a.md",
      "b.md",
      "c.md",
      "ghost.md?",
    ]);
    expect(shape(await vault.graph.local("a.md")).nodes).toEqual([
      "a.md",
      "b.md",
    ]);
    expect(shape(await vault.graph.local("a.md", 2)).nodes).toEqual([
      "a.md",
      "b.md",
      "c.md",
    ]);

    await vault.notes.write("d.md", "[[a]]", null);
    await vault.indexed();
    expect(shape(await vault.graph.local("a.md")).nodes).toEqual([
      "a.md",
      "b.md",
      "d.md",
    ]);
    vault.close();
  });

  test("rejects a depth that is not a whole number of 0 or more", async () => {
    const vault = await openVault({ "a.md": "" });
    for (const depth of [-1, 1.5, Number.NaN, Infinity]) {
      expect(vault.graph.local("a.md", depth)).rejects.toThrow(/depth/);
    }
    vault.close();
  });
});

describe("graph of the notes with a tag", () => {
  const tagged = () =>
    openStore(
      note("a.md", "#area/topic [[b]] [[c]] [[gone]]"),
      note("b.md", "---\ntags: [Area]\n---\n[[a]]"),
      note("c.md", "#other [[a]]"),
      note("d.md", "#areas [[a]]"),
    );

  test("only those notes, with nested tags, and the links between them", async () => {
    const store = await tagged();
    expect(shape(await store.graph(false, "area"))).toEqual({
      nodes: ["a.md", "b.md"],
      edges: ["a.md>b.md*1", "b.md>a.md*1"],
    });
  });

  test("ignores case and a # in front", async () => {
    const store = await tagged();
    expect(shape(await store.graph(false, "#AREA/topic")).nodes).toEqual([
      "a.md",
    ]);
  });

  test("with the missing notes they link to", async () => {
    const store = await tagged();
    expect(shape(await store.graph(true, "area")).nodes).toEqual([
      "a.md",
      "b.md",
      "gone.md?",
    ]);
  });

  test("empty for a tag no note has", async () => {
    const store = await tagged();
    expect(await store.graph(true, "nope")).toEqual({ nodes: [], edges: [] });
  });

  test("vault.graph.global takes the tag, a blank one being none", async () => {
    const platform = createMemoryPlatform({
      "/v/a.md": "#x [[b]]",
      "/v/b.md": "#x",
      "/v/c.md": "[[a]]",
    });
    await platform.fs.mkdir("/v");
    const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
    await vault.indexed();
    expect(shape(await vault.graph.global({ tag: "x" })).nodes).toEqual([
      "a.md",
      "b.md",
    ]);
    expect(shape(await vault.graph.global({ tag: "  " })).nodes).toHaveLength(
      3,
    );
    vault.close();
  });
});
