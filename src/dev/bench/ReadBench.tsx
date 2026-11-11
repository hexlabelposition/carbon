import { useState } from "react";
import { pickVaultFolder, tauriPlatform } from "../../platform";
import { readAll, scanMarkdown } from "./read-bench";

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const SCAN_CONCURRENCY = 16;

/**
 * Temporary M0 measurement (C-007): how long it takes to read every note of
 * a vault through the `fs` plugin, and which concurrency is best.
 */
export function ReadBench() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");

  async function run() {
    const root = await pickVaultFolder();
    if (root === null) return;
    const lines: string[] = [];
    const print = (line: string) => {
      lines.push(line);
      setLog(lines.join("\n"));
    };
    setRunning(true);
    try {
      const fs = tauriPlatform.fs;
      const ms = (n: number) => `${n.toFixed(0)} ms`.padStart(9);

      let start = performance.now();
      const paths = await scanMarkdown(fs, root, SCAN_CONCURRENCY);
      print(`${root}`);
      print(
        `scan (list folders, ${SCAN_CONCURRENCY} at a time): ${ms(performance.now() - start)}, ${paths.length} notes`,
      );

      // The first pass also fills the OS page cache, so it is reported apart.
      const first = await readAll(fs, paths, 16);
      print(
        `first read (16 at a time):                ${ms(first.ms)}, ${first.chars} chars`,
      );

      start = performance.now();
      await scanMarkdown(fs, root, SCAN_CONCURRENCY);
      print(
        `scan again:                               ${ms(performance.now() - start)}`,
      );

      print("");
      print("concurrency       time   per note");
      // Two rounds, in opposite orders, to even out warm-up effects.
      for (const levels of [LEVELS, [...LEVELS].reverse()]) {
        for (const level of levels) {
          const { ms: time, chars } = await readAll(fs, paths, level);
          if (chars !== first.chars)
            throw new Error(`Read ${chars} chars, expected ${first.chars}`);
          print(
            `${String(level).padStart(11)} ${ms(time)} ${(time / paths.length).toFixed(3).padStart(7)} ms`,
          );
        }
        print("");
      }
      print("done");
    } catch (error) {
      print(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
        Read benchmark
      </h2>
      <div>
        <button
          type="button"
          className="h-6.5 rounded-sm border border-line-strong bg-panel px-3 disabled:text-faint"
          disabled={running}
          onClick={run}
        >
          {running ? "Measuring…" : "Pick a vault and measure"}
        </button>
      </div>
      {log && (
        <pre className="overflow-auto rounded-md border border-line bg-code px-3 py-2 font-mono text-small select-text">
          {log}
        </pre>
      )}
    </section>
  );
}
