import Database from "@tauri-apps/plugin-sql";

export type { Database };

/**
 * Opens (and creates if needed) an SQLite database in the app config
 * directory. Raw SQL access is only for the index store and measurements.
 */
export function openDatabase(fileName: string): Promise<Database> {
  return Database.load(`sqlite:${fileName}`);
}
