/** A value SQLite stores and returns: the index needs no others. */
export type SqlValue = string | number | null;

/**
 * An SQLite database. Every call is its own transaction: the Tauri `sql`
 * plugin has no transaction API and spreads calls over a connection pool
 * (ARCHITECTURE.md, section 7).
 */
export interface SqlDatabase {
  /** Runs one statement that returns no rows. `?` takes `params` in order. */
  execute(sql: string, params?: readonly SqlValue[]): Promise<void>;
  /** Runs one query and returns its rows as objects keyed by column. */
  select<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;
  close(): Promise<void>;
}

/** Where the core keeps its databases. */
export interface SqlDatabases {
  /**
   * Opens the database file `name` in the app cache directory, and creates
   * it if it does not exist. The cache directory is outside every vault,
   * so sync tools never see the database (ARCHITECTURE.md, section 4.1).
   */
  open(name: string): Promise<SqlDatabase>;
}
