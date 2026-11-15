import { appCacheFolder, tauriPlatform } from "../platform";
import { joinPath, parentOf } from "../features/vault/paths";

/** Where the files of the test vault live in the repository. */
const SOURCE = "/fixtures/test-vault/";

/**
 * Every file of the test vault, by its path in the repository, as an
 * address the dev server serves it at. Only the dev build imports this
 * module, so the files never go into a release.
 */
const FILES = import.meta.glob<string>("/fixtures/test-vault/**/*", {
  query: "?url",
  import: "default",
  eager: true,
});

/**
 * Makes the test vault afresh in the app cache folder, a copy of
 * `fixtures/test-vault`, and resolves with its path. What was changed in
 * it the last time is gone.
 */
export async function prepareTestVault(): Promise<string> {
  const { fs } = tauriPlatform;
  const root = joinPath(await appCacheFolder(), "test-vault");
  if (await fs.exists(root)) await fs.remove(root, { recursive: true });
  await fs.mkdir(root);

  for (const [source, url] of Object.entries(FILES)) {
    const target = joinPath(root, source.slice(SOURCE.length));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not read ${source} of the test vault`);
    }
    await fs.mkdir(parentOf(target));
    await fs.writeBytesAtomic(
      target,
      new Uint8Array(await response.arrayBuffer()),
    );
  }
  return root;
}
