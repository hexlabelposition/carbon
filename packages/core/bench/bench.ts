// Measures the core against the performance budgets (ARCHITECTURE.md,
// section 1) on a vault made by the generator, held in memory:
//
//   bun gen:vault <dir> && bun packages/core/bench/bench.ts <dir>
//
// It runs the whole `Vault` as the app does, but on the in-memory platform
// of the tests: SQLite is Bun's, files are in memory, parsing runs on this
// thread. So it measures the work of the core, not the WebView bridge or
// the plugins of the app, which add to every number here (C-602).

import {
  contentHash,
  Vault,
  type NoteFile,
  type NoteParser,
  type ParsedFile,
} from "../src/index";
import { createMemoryPlatform, type MemoryPlatform } from "../test/fakes";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: bun packages/core/bench/bench.ts <vault dir>");
  process.exit(1);
}

const ROOT = "/v";

/**
 * The notes of the vault at `folder`, by their path under `ROOT`. Hidden
 * files and folders are left out, as by the vault tree.
 */
async function readVault(folder: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for await (const path of new Bun.Glob("**/*.md").scan({ cwd: folder })) {
    files[`${ROOT}/${path}`] = await Bun.file(`${folder}/${path}`).text();
  }
  return files;
}

interface Result {
  name: string;
  ms: number;
  budget?: number;
}
const results: Result[] = [];

/** Times `run` once. */
async function once(
  name: string,
  run: () => Promise<unknown>,
  budget?: number,
) {
  const start = performance.now();
  await run();
  results.push({ name, ms: performance.now() - start, budget });
}

/** The median time of `run`, after one run to warm up. */
async function median(
  name: string,
  run: () => Promise<unknown>,
  budget?: number,
  runs = 15,
) {
  await run();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  results.push({ name, ms: times[Math.floor(times.length / 2)], budget });
}

/**
 * Parse workers sharing out each batch, as the app does
 * (src/workers/worker-parser.ts): what the first index costs when parsing
 * is off the thread that writes.
 */
function workerParser(count: number): NoteParser & { stop(): void } {
  const workers = Array.from(
    { length: count },
    () => new Worker(new URL("./parse-worker.ts", import.meta.url)),
  );
  let nextId = 0;
  const pending = new Map<number, (parsed: ParsedFile[]) => void>();
  for (const worker of workers) {
    worker.onmessage = ({
      data,
    }: MessageEvent<{ id: number; parsed: ParsedFile[] }>) => {
      pending.get(data.id)?.(data.parsed);
      pending.delete(data.id);
    };
  }
  const send = (worker: Worker, files: NoteFile[]) =>
    new Promise<ParsedFile[]>((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      worker.postMessage({ id, files });
    });
  return {
    async parse(files) {
      const size = Math.ceil(files.length / count);
      const parts = await Promise.all(
        workers.map((worker, i) =>
          send(worker, files.slice(i * size, (i + 1) * size)),
        ),
      );
      return parts.flat();
    },
    stop: () => workers.forEach((worker) => worker.terminate()),
  };
}

async function openVault(platform: MemoryPlatform): Promise<Vault> {
  const vault = await Vault.open(ROOT, platform, { changeDelayMs: 5 });
  await vault.indexed();
  return vault;
}

const files = await readVault(dir);
const paths = Object.keys(files).map((path) => path.slice(ROOT.length + 1));
const platform = createMemoryPlatform(files);
await platform.fs.mkdir(ROOT);
console.log(`${paths.length} notes from ${dir}\n`);

let vault!: Vault;
await once(
  "First index (open, parse, write)",
  async () => {
    vault = await openVault(platform);
  },
  10_000,
);
vault.close();

// The same first index with four parse workers, on a fresh index.
const workers = workerParser(4);
const withWorkers = { ...createMemoryPlatform(files), parser: workers };
await withWorkers.fs.mkdir(ROOT);
await once(
  "First index, 4 parse workers",
  async () => (await openVault(withWorkers)).close(),
  10_000,
);
workers.stop();

await once(
  "Start with the index built (open, scan)",
  async () => {
    vault = await openVault(platform);
  },
  1_000,
);

const some = paths[Math.floor(paths.length / 2)];
for (const query of ["note", "graph index", "заметка", "path:project note"]) {
  await median(`Search "${query}"`, () => vault.search.query(query), 50);
}
await median(`Search "tag:area"`, () => vault.search.query("tag:area"), 50);
for (const query of ["n", "note 12", "projct", "грф"]) {
  await median(
    `Quick switcher "${query}"`,
    () => vault.search.titles(query),
    16,
  );
}
await median("Tags with counts", () => vault.tags.all());
await median("Tag tree", () => vault.tags.tree());
await median("Tag suggestions", () => vault.tags.suggestions(some, []));
await median("Notes of a tag", () => vault.tags.notes("area"));
await median("Backlinks of one note", () => vault.links.backlinks(some));
await median("Unresolved links", () => vault.links.unresolved());
await median("Aliases (for [[)", () => vault.links.aliases());

let edit = 0;
await median(
  "Reindex after saving one note",
  async () => {
    const text = await vault.notes.read(some);
    await vault.notes.write(
      some,
      `${text}\nEdit ${edit++} #idea [[x]]`,
      contentHash(text),
    );
    await vault.indexed();
  },
  50,
);
vault.close();

const width = Math.max(...results.map((r) => r.name.length));
for (const { name, ms, budget } of results) {
  const time = `${ms.toFixed(1)} ms`.padStart(11);
  const verdict =
    budget === undefined
      ? ""
      : ms <= budget
        ? `  within ${budget} ms`
        : `  OVER ${budget} ms`;
  console.log(`${name.padEnd(width)}  ${time}${verdict}`);
}
