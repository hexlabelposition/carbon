import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Key, Session } from "./webdriver";

/*
 * The main flows of Carbon, in the real app: WebKitGTK, the Tauri plugins
 * and the file system (C-609). `bun run e2e` runs them: it starts the dev
 * server, the driver and the app with a profile of its own, so the user's
 * vaults and settings are never touched. They run only through it.
 */

const DRIVER = process.env.CARBON_E2E_DRIVER ?? "http://127.0.0.1:4444";
const APP = process.env.CARBON_E2E_APP;
const CACHE = process.env.CARBON_E2E_CACHE;
const ARTIFACTS = process.env.CARBON_E2E_ARTIFACTS;

if (APP === undefined || CACHE === undefined) {
  throw new Error("Run the end-to-end tests with `bun run e2e`");
}

/** Where "Open test vault" makes its copy of `fixtures/test-vault`. */
const VAULT = join(CACHE, "io.github.hexlabelposition.carbon", "test-vault");

let app: Session;

/**
 * A test of one flow. When it fails, a screenshot of the window is saved
 * next to the log, named after the test.
 */
function flow(name: string, run: () => Promise<void>) {
  test(name, async () => {
    try {
      await run();
    } catch (error) {
      if (ARTIFACTS !== undefined) {
        await mkdir(ARTIFACTS, { recursive: true });
        const file = join(ARTIFACTS, `${name.replace(/\W+/g, "-")}.png`);
        await writeFile(file, await app.screenshot()).catch(() => undefined);
      }
      throw error;
    }
  });
}

/** The text of the note shown now, as the editor has it. */
function editorText(): Promise<string> {
  return app.execute<string>(
    "return document.querySelector('.cm-content')?.innerText ?? ''",
  );
}

/** The name of the note shown now, as its title field has it. */
function noteName(): Promise<string> {
  return app.execute<string>(
    "return document.querySelector('textarea[aria-label=\"Note name\"]')?.value ?? ''",
  );
}

/** Waits for the note named `name` to be shown. */
async function waitForNote(name: string): Promise<void> {
  await app.waitFor(
    async () => (await noteName()) === name,
    `the note "${name}"`,
  );
}

/** Waits for the editor to show `text`. */
async function waitForText(text: string): Promise<void> {
  await app.waitFor(
    async () => (await editorText()).includes(text),
    `the editor to show "${text}"`,
  );
}

/** Waits for the file at `path` in the vault to hold `text`. */
async function waitForFile(path: string, text: string): Promise<void> {
  const file = join(VAULT, path);
  await app.waitFor(
    async () =>
      existsSync(file) && (await readFile(file, "utf8")).includes(text),
    `${path} to hold "${text}"`,
  );
}

/** Opens a note by clicking it in the file tree. */
async function openFromTree(path: string): Promise<void> {
  const selector = `[role="tree"] [data-path=${JSON.stringify(path)}]`;
  await (await app.find(selector)).click();
}

beforeAll(async () => {
  app = await Session.start(DRIVER, APP);
  // The interface in English, whatever the system speaks: the tests find
  // what they press by its text.
  await app.execute(
    "localStorage.setItem('carbon.language', 'en'); location.reload();",
  );
  await (await app.find('[aria-label="Dev tools"]', 30_000)).click();
  await (await app.button("Open test vault")).click();
  await app.find('[role="tree"] [data-path="Start here.md"]', 30_000);
});

afterAll(async () => {
  await app?.end();
});

describe("Carbon", () => {
  flow("opens the test vault from the start screen", async () => {
    const items = await app.all('[role="tree"] [role="treeitem"]');
    expect(items.length).toBeGreaterThan(5);
  });

  flow("opens a note from the file tree", async () => {
    await openFromTree("Links.md");
    await waitForNote("Links");
    await waitForText("Wiki links");
  });

  flow("creates a note and saves what is typed", async () => {
    await app.press(Key.Control, "n");
    const name = await app.find('input[aria-label="Name of the new note"]');
    await name.type("E2E note");
    await app.press(Key.Enter);
    await waitForNote("E2E note");
    await waitForFile("E2E note.md", "");
    await (await app.find(".cm-content")).click();
    await app.typeText("Typed by the end-to-end test");
    await waitForFile("E2E note.md", "Typed by the end-to-end test");
  });

  flow("opens a note with the quick switcher", async () => {
    await app.press(Key.Control, "o");
    const field = await app.find('input[aria-label="Find or create a note"]');
    await field.type("Formatting");
    await app.find('[role="listbox"] [role="option"]');
    await app.press(Key.Enter);
    await waitForNote("Formatting");
  });

  flow("finds a note by its text", async () => {
    await app.press(Key.Control, Key.Shift, "f");
    const field = await app.find('input[aria-label="Search notes"]');
    await field.type("Page Up and Page Down");
    await app.find('[role="listbox"] [role="option"]');
    await app.press(Key.Enter);
    await waitForNote("Long note");
  });

  flow("shows a change made to the note on disk", async () => {
    await openFromTree("Empty note.md");
    await waitForNote("Empty note");
    await writeFile(join(VAULT, "Empty note.md"), "Written by another program");
    await waitForText("Written by another program");
  });

  flow("opens and closes the settings", async () => {
    await app.press(Key.Control, ",");
    await app.find('[role="dialog"] [role="tablist"]');
    await app.press(Key.Escape);
    // Only the settings: the dev tools stay in the page, hidden.
    await app.waitFor(
      async () =>
        (await app.all('[role="dialog"] [role="tablist"]')).length === 0,
      "the settings to close",
    );
  });
});
