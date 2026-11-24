/**
 * Makes a release, as bumpp would:
 *
 *   bun run release [patch|minor|major|X.Y.Z] [--yes] [--dry-run]
 *
 * 1. checks that the work is on main, committed, and level with origin;
 * 2. asks for the new version, unless it is given;
 * 3. writes it to `package.json` (the app reads it from there, see
 *    `tauri/tauri.conf.json`), `tauri/Cargo.toml` and `tauri/Cargo.lock`;
 * 4. commits "chore: release vX.Y.Z", tags it with a signed annotated tag
 *    of the same message, and pushes both at once.
 *
 * The tag starts `release.yml`, which builds the packages and puts them on
 * the draft release written by hand for the tag. Commit and tag are signed
 * as the global git config says.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  package: join(ROOT, "package.json"),
  cargo: join(ROOT, "tauri", "Cargo.toml"),
  lock: join(ROOT, "tauri", "Cargo.lock"),
};
const BRANCH = "main";
const REMOTE = "origin";

type Bump = "patch" | "minor" | "major";
const BUMPS: Bump[] = ["patch", "minor", "major"];

function fail(message: string): never {
  console.error(`\x1b[31m✗\x1b[0m ${message}`);
  process.exit(1);
}

/** Asks on the terminal; the answer, trimmed. */
async function ask(question: string): Promise<string> {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await terminal.question(`${question} `);
  terminal.close();
  return answer.trim();
}

/** Runs git; its output, trimmed. Stops the release if it fails. */
function git(...args: string[]): string {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`git ${args.join(" ")}\n${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/** Runs git with its output on the terminal: for what may ask a passphrase. */
function gitShown(...args: string[]): void {
  const result = spawnSync("git", args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) fail(`git ${args.join(" ")} failed`);
}

function parse(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match === null
    ? null
    : [Number(match[1]), Number(match[2]), Number(match[3])];
}

function bump(version: string, kind: Bump): string {
  const parts = parse(version);
  if (parts === null) fail(`The current version "${version}" is not X.Y.Z`);
  const [major, minor, patch] = parts;
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** True if `a` comes after `b`. */
function newer(a: string, b: string): boolean {
  const x = parse(a);
  const y = parse(b);
  if (x === null || y === null) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** Replaces the one match of `pattern` in `file`; stops if there is none. */
function replaceIn(file: string, pattern: RegExp, to: string, dry: boolean) {
  const text = readFileSync(file, "utf8");
  if (!pattern.test(text)) fail(`No version found in ${file}`);
  if (!dry) writeFileSync(file, text.replace(pattern, to));
}

const args = process.argv.slice(2);
const yes = args.includes("--yes") || args.includes("-y");
const dry = args.includes("--dry-run");
const wanted = args.find((arg) => !arg.startsWith("-"));

// 1. The state of the repository.
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== BRANCH) fail(`On "${branch}": a release is made from ${BRANCH}`);
if (git("status", "--porcelain") !== "") {
  fail("There are uncommitted changes: commit or stash them first");
}
git("fetch", "--quiet", "--tags", REMOTE, BRANCH);
const behind = git("rev-list", "--count", `HEAD..${REMOTE}/${BRANCH}`);
if (behind !== "0") fail(`${BRANCH} is ${behind} commits behind ${REMOTE}`);

// 2. The new version.
const current = (
  JSON.parse(readFileSync(FILES.package, "utf8")) as { version: string }
).version;
let next: string;
if (wanted === undefined) {
  console.log(`Current version: ${current}\n`);
  BUMPS.forEach((kind, i) =>
    console.log(`  ${i + 1}. ${kind.padEnd(6)} ${bump(current, kind)}`),
  );
  const answer = await ask("\nVersion (1-3 or X.Y.Z) [1]:");
  const picked = BUMPS[Number(answer || "1") - 1];
  next = picked === undefined ? answer : bump(current, picked);
} else {
  next = BUMPS.includes(wanted as Bump)
    ? bump(current, wanted as Bump)
    : wanted.replace(/^v/, "");
}
if (parse(next) === null) fail(`"${next}" is not a version such as 1.2.3`);
if (!newer(next, current)) fail(`${next} does not come after ${current}`);

const tag = `v${next}`;
const message = `chore: release ${tag}`;
if (git("tag", "--list", tag) !== "") fail(`The tag ${tag} exists already`);
if (git("ls-remote", "--tags", REMOTE, `refs/tags/${tag}`) !== "") {
  fail(`The tag ${tag} exists on ${REMOTE} already`);
}

const unpushed = git("log", "--oneline", `${REMOTE}/${BRANCH}..HEAD`);
console.log(`\n${current} → \x1b[1m${next}\x1b[0m`);
console.log(
  unpushed === ""
    ? "\nNo commits to push besides the release."
    : `\nCommits to push with it:\n${unpushed.replace(/^/gm, "  ")}`,
);
console.log(
  `\nWill commit and tag "${message}" (signed), then push ${BRANCH} and ${tag}.`,
);
if (dry) {
  console.log("\nDry run: nothing was changed.");
  process.exit(0);
}
if (!yes && !/^y(es)?$/i.test(await ask("\nGo on? [y/N]"))) {
  fail("Stopped: nothing was changed");
}

// 3. The files. Text replaced in place, so the formatting stays.
replaceIn(FILES.package, /"version": "[^"]*"/, `"version": "${next}"`, dry);
replaceIn(
  FILES.cargo,
  /^(\[package\][^[]*?\nversion = )"[^"]*"/m,
  `$1"${next}"`,
  dry,
);
replaceIn(
  FILES.lock,
  /(\nname = "carbon"\nversion = )"[^"]*"/,
  `$1"${next}"`,
  dry,
);

// 4. Commit, tag, push. One push for both: the tag never goes up without
// its commit.
git("add", FILES.package, FILES.cargo, FILES.lock);
gitShown("commit", "--quiet", "-m", message);
gitShown("tag", "-s", tag, "-m", message);
gitShown("push", "--atomic", REMOTE, BRANCH, tag);

console.log(`\n\x1b[32m✓\x1b[0m Released ${tag}: release.yml builds it now.`);
