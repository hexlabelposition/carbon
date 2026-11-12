import { Database } from "bun:sqlite";
import type { SqlDatabase, SqlDatabases, SqlValue } from "../../src/index";

/**
 * `SqlDatabases` on Bun's SQLite, in memory: real SQL, no disk. A name
 * opened again gets the same data, as a file would; `close` only ends the
 * handle it is called on.
 */
export class MemorySqlDatabases implements SqlDatabases {
  private readonly files = new Map<string, Database>();
  /** Names in the order they were opened, for tests. */
  readonly opened: string[] = [];

  async open(name: string): Promise<SqlDatabase> {
    this.opened.push(name);
    let file = this.files.get(name);
    if (file === undefined) {
      file = new Database(":memory:");
      this.files.set(name, file);
    }
    return new MemorySqlDatabase(file);
  }

  /** The database behind a name, to look at or damage in tests. */
  raw(name: string): Database | undefined {
    return this.files.get(name);
  }
}

class MemorySqlDatabase implements SqlDatabase {
  private closed = false;

  constructor(private readonly file: Database) {}

  async execute(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.check();
    this.file.query(sql).run(...params);
  }

  async select<Row>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<Row[]> {
    this.check();
    return this.file.query(sql).all(...params) as Row[];
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  private check() {
    if (this.closed) throw new Error("The database is closed");
  }
}
