import type { SqlDatabase, SqlDatabases } from "@carbon/core";
import { invoke } from "@tauri-apps/api/core";
import { appCacheDir } from "@tauri-apps/api/path";
import { mkdir } from "@tauri-apps/plugin-fs";
import Database from "@tauri-apps/plugin-sql";
import { toCorePath } from "./paths";

export type { Database };

/**
 * Opens (and creates if needed) an SQLite database in the app config
 * directory. Raw SQL access for the measurements in the dev panel.
 */
export function openDatabase(fileName: string): Promise<Database> {
  return Database.load(`sqlite:${fileName}`);
}

/**
 * `SqlDatabases` on the `sql` plugin, in the app cache directory. The
 * plugin puts a relative name in the config directory, so the path given
 * is absolute.
 */
export const tauriSqlDatabases: SqlDatabases = {
  async open(name) {
    const folder = toCorePath(await appCacheDir());
    // The plugin creates the file, not the folder it goes in.
    await mkdir(folder, { recursive: true });
    const db = await Database.load(`sqlite:${folder}/${name}`);
    const database: SqlDatabase = {
      async execute(sql, params = []) {
        await db.execute(sql, [...params]);
      },
      // The plugin has no transactions: a command of ours runs the batch on
      // the pool of the plugin, found by the string it was loaded with.
      async batch(statements) {
        if (statements.length === 0) return;
        try {
          await invoke("sql_batch", { db: db.path, statements });
        } catch (reason) {
          // A command rejects with a plain string, the core expects an `Error`.
          throw new Error(String(reason), { cause: reason });
        }
      },
      select: (sql, params = []) => db.select(sql, [...params]),
      async close() {
        await db.close();
      },
    };
    return database;
  },
};
