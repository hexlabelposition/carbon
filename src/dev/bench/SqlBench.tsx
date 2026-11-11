import { useState } from "react";
import { openDatabase, pickVaultFolder, tauriPlatform } from "../../platform";
import {
  backlinks,
  createTables,
  dropTables,
  insertNotes,
  loadNotes,
  median,
  reindexOne,
  searchFts,
} from "./sql-bench";

/** Rows per INSERT. A batch of 1 is slow, so it runs on a sample. */
const BATCHES = [1, 50, 200, 1000];
const SAMPLE = 100;
const QUERIES = [
  "index",
  "graph editor",
  "заметка",
  "пои*",
  '"local plan"',
  "nosuchword",
];

/**
 * Temporary M0 measurement (C-008): is FTS5 available in the `sql` plugin,
 * and how fast are bulk inserts and queries for a 10k-note vault.
 */
export function SqlBench() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");

  async function run() {
    const root = await pickVaultFolder();
    if (root === null) return;
    const lines: string[] = [];
    const print = (line = "") => {
      lines.push(line);
      setLog(lines.join("\n"));
    };
    const ms = (n: number) => `${n.toFixed(n < 10 ? 2 : 0)} ms`.padStart(10);
    setRunning(true);
    try {
      const db = await openDatabase("bench.db");
      try {
        const [{ version }] = await db.select<{ version: string }[]>(
          "SELECT sqlite_version() AS version",
        );
        const options = await db.select<{ compile_options: string }[]>(
          "PRAGMA compile_options",
        );
        const fts5 = options.some((o) => o.compile_options === "ENABLE_FTS5");
        print(
          `SQLite ${version}, ENABLE_FTS5 compile option: ${fts5 ? "yes" : "no"}`,
        );

        await createTables(db);
        print("FTS5 table created: yes");

        const notes = await loadNotes(tauriPlatform.fs, root);
        const chars = notes.reduce((sum, n) => sum + n.body.length, 0);
        print(`${notes.length} notes, ${chars} chars, from ${root}`);

        for (const journal of ["delete", "wal"]) {
          const [{ journal_mode }] = await db.select<
            { journal_mode: string }[]
          >(`PRAGMA journal_mode = ${journal}`);
          print();
          print(`journal_mode = ${journal_mode}`);
          print(
            "rows per INSERT   notes   links   calls       time    per note   10k notes",
          );
          for (const batch of BATCHES) {
            await createTables(db);
            const subset = batch === 1 ? notes.slice(0, SAMPLE) : notes;
            const r = await insertNotes(db, subset, batch);
            const perNote = r.ms / r.notes;
            print(
              `${String(batch).padStart(15)} ${String(r.notes).padStart(7)} ${String(r.links).padStart(7)} ` +
                `${String(r.calls).padStart(7)} ${ms(r.ms)} ${ms(perNote)} ${ms(perNote * 10_000)}`,
            );
          }
        }

        // The tables now hold the whole vault (last run: WAL, largest batch).
        print();
        print("queries on the full index, median of 7");
        for (const query of QUERIES) {
          const hits = await searchFts(db, query);
          const time = await median(7, () => searchFts(db, query));
          print(
            `  search ${query.padEnd(14)} ${ms(time)}, ${hits.length} hits`,
          );
        }
        const target = notes[Math.floor(notes.length / 2)];
        const found = await backlinks(db, target.title);
        print(
          `  backlinks              ${ms(await median(7, () => backlinks(db, target.title)))}, ${found.length} rows`,
        );
        print(
          `  reindex one note       ${ms(await median(7, () => reindexOne(db, target)))}`,
        );

        print();
        print("done");
      } finally {
        await dropTables(db).catch(() => {});
        await db.select("PRAGMA journal_mode = delete").catch(() => {});
        await db.execute("VACUUM").catch(() => {});
        await db.close();
      }
    } catch (error) {
      print(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
        SQL benchmark
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
