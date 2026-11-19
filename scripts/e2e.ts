/**
 * Runs the end-to-end tests of the main flows in the real app (C-609):
 *
 * 1. the Vite dev server on port 1420, unless one runs already: the debug
 *    build of the app loads its interface from there;
 * 2. the debug build of the app, with `cargo build`;
 * 3. `tauri-driver`, with a profile of its own in a temporary folder, so
 *    the user's vaults and settings are never touched;
 * 4. the tests, with `bun test`.
 *
 * Linux only, as `tauri-driver` on top of WebKitWebDriver. Only what this
 * script started is stopped at the end. A failure keeps the temporary
 * folder, with the screenshots and the log of the app.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEV_URL = "http://localhost:1420";
const DRIVER_PORT = 4444;
const DRIVER_URL = `http://127.0.0.1:${DRIVER_PORT}`;
const APP = join(ROOT, "tauri", "target", "debug", "carbon");

const started: ChildProcess[] = [];

async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(url: string, what: string, timeout = 60_000) {
  const until = Date.now() + timeout;
  while (!(await reachable(url))) {
    if (Date.now() > until) throw new Error(`${what} did not start`);
    await new Promise((done) => setTimeout(done, 250));
  }
}

/** `tauri-driver` on the PATH, or where `cargo install` puts it. */
function driverPath(): string {
  const fromEnv = process.env.TAURI_DRIVER;
  if (fromEnv !== undefined) return fromEnv;
  const found = spawnSync("which", ["tauri-driver"], { encoding: "utf8" });
  if (found.status === 0) return found.stdout.trim();
  const cargo = join(homedir(), ".cargo", "bin", "tauri-driver");
  if (existsSync(cargo)) return cargo;
  throw new Error(
    "tauri-driver is missing: `cargo install tauri-driver --locked`, and WebKitWebDriver (webkitgtk-webdriver, or webkit2gtk-driver before Ubuntu 26.04)",
  );
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { cwd: ROOT, env, stdio: "inherit" });
  started.push(child);
  return child;
}

/** Stops what this script started, and waits for it to be gone. */
async function stopStarted(): Promise<void> {
  await Promise.all(
    started.map(
      (child) =>
        new Promise<void>((done) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            done();
            return;
          }
          child.once("exit", () => done());
          child.kill();
        }),
    ),
  );
}

/** The profile of this run, removed at the end when every test passed. */
let profile: string | null = null;

async function main(): Promise<number> {
  if (process.platform !== "linux") {
    console.error("The end-to-end tests run on Linux only");
    return 1;
  }
  const driver = driverPath();

  if (await reachable(DEV_URL)) {
    console.log(`Using the dev server at ${DEV_URL}`);
  } else {
    start("bun", ["run", "dev"], process.env);
    await waitUntil(DEV_URL, "The dev server");
  }

  const build = spawnSync(
    "cargo",
    ["build", "--manifest-path", join(ROOT, "tauri", "Cargo.toml")],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (build.status !== 0) return build.status ?? 1;

  profile = await mkdtemp(join(tmpdir(), "carbon-e2e-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_CONFIG_HOME: join(profile, "config"),
    XDG_DATA_HOME: join(profile, "data"),
    XDG_CACHE_HOME: join(profile, "cache"),
  };
  start(driver, ["--port", String(DRIVER_PORT)], env);
  await waitUntil(`${DRIVER_URL}/status`, "tauri-driver", 20_000);

  const tests = spawnSync(
    "bun",
    ["test", "--timeout", "120000", "./e2e/main-flows.e2e.ts"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...env,
        CARBON_E2E_DRIVER: DRIVER_URL,
        CARBON_E2E_APP: APP,
        CARBON_E2E_CACHE: env.XDG_CACHE_HOME,
        CARBON_E2E_ARTIFACTS: join(profile, "screenshots"),
      },
    },
  );
  return tests.status ?? 1;
}

let code = 1;
try {
  code = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  // The app writes to its profile until it is gone: stop it first.
  await stopStarted();
  if (profile !== null) {
    if (code === 0) await rm(profile, { recursive: true, force: true });
    else console.error(`Kept the profile, screenshots and log in ${profile}`);
  }
}
process.exit(code);
