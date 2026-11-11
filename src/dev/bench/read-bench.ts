import type { FileSystem } from "@carbon/core";

/** Runs `fn` over `items` with at most `concurrency` calls in flight. */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

/** Absolute paths of every `.md` file under `root`. Hidden folders are skipped. */
export async function scanMarkdown(
  fs: FileSystem,
  root: string,
  concurrency: number,
): Promise<string[]> {
  const files: string[] = [];
  let level = [root];
  while (level.length > 0) {
    const listed = await mapPool(level, concurrency, async (dir) => ({
      dir,
      entries: await fs.list(dir),
    }));
    level = [];
    for (const { dir, entries } of listed) {
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const path = `${dir}/${entry.name}`;
        if (entry.kind === "dir") level.push(path);
        else if (entry.name.endsWith(".md")) files.push(path);
      }
    }
  }
  return files;
}

export interface ReadResult {
  concurrency: number;
  ms: number;
  /** Total length of the text read, in UTF-16 units. A sanity check, not a size. */
  chars: number;
}

export async function readAll(
  fs: FileSystem,
  paths: readonly string[],
  concurrency: number,
): Promise<ReadResult> {
  const start = performance.now();
  const lengths = await mapPool(
    paths,
    concurrency,
    async (path) => (await fs.readText(path)).length,
  );
  const ms = performance.now() - start;
  return { concurrency, ms, chars: lengths.reduce((a, b) => a + b, 0) };
}
