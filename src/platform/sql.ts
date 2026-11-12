import type { SqlDatabase, SqlDatabases } from "@carbon/core";
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
      select: (sql, params = []) => db.select(sql, [...params]),
      async close() {
        await db.close();
      },
    };
    return database;
  },
};
