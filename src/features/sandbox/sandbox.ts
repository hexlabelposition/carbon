import type { FileSystem } from "@carbon/core";
import type { Language } from "../i18n/i18n";
import { joinPath, parentOf } from "../vault/paths";

/** Where the notes of the sandbox live in the source, by language. */
const SOURCE = "/src/features/sandbox/vault/";

/**
 * Every file of the sandbox, by its path in the source, as an address the
 * app serves it at: they go into the build with the rest of the app.
 */
const FILES = import.meta.glob<string>("/src/features/sandbox/vault/**/*", {
  query: "?url",
  import: "default",
  eager: true,
});

/** The name of the sandbox vault, as its folder is named: in each language. */
const NAMES: Record<Language, string> = {
  en: "Sandbox",
  ru: "Песочница",
};

/**
 * Makes the sandbox afresh in `cacheFolder`, a copy of the sample notes in
 * `language`, and resolves with its path. What was changed in it the last
 * time is gone. It lives under `sandbox/` there, the folder the app lets
 * its commands reach (`tauri/src/lib.rs`).
 */
export async function prepareSandbox(
  fs: FileSystem,
  cacheFolder: string,
  language: Language,
): Promise<string> {
  const root = joinPath(joinPath(cacheFolder, "sandbox"), NAMES[language]);
  if (await fs.exists(root)) await fs.remove(root, { recursive: true });
  await fs.mkdir(root);

  const prefix = `${SOURCE}${language}/`;
  for (const [source, url] of Object.entries(FILES)) {
    if (!source.startsWith(prefix)) continue;
    const target = joinPath(root, source.slice(prefix.length));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not read ${source} of the sandbox`);
    }
    await fs.mkdir(parentOf(target));
    await fs.writeBytesAtomic(
      target,
      new Uint8Array(await response.arrayBuffer()),
    );
  }
  return root;
}
