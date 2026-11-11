// Generates a test vault: N Markdown notes with random links and tags.
//
//   bun scripts/generate-vault.ts <dir> [notes=10000] [seed=1]
//
// The same arguments always produce the same vault, so measurements can be
// repeated. The target folder must be empty or missing.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [dir, countArg = "10000", seedArg = "1"] = process.argv.slice(2);
const count = Number(countArg);
const seed = Number(seedArg);

if (!dir || !Number.isInteger(count) || count < 1 || !Number.isInteger(seed)) {
  console.error(
    "Usage: bun scripts/generate-vault.ts <dir> [notes=10000] [seed=1]",
  );
  process.exit(1);
}
if (existsSync(dir) && readdirSync(dir).length > 0) {
  console.error(`Refusing to write into a non-empty folder: ${dir}`);
  process.exit(1);
}

// mulberry32: a small seeded PRNG.
let state = seed >>> 0;
function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];
const chance = (p: number) => random() < p;

const WORDS = (
  "note link graph index vault search fast local plain file folder tag idea draft plan review " +
  "project system design editor parser cache query result module layer build test measure budget " +
  "window thread worker event change write read open close rename move start finish simple clear " +
  "заметка ссылка граф индекс поиск файл папка идея план проект система редактор"
).split(" ");

const AREAS = ["area", "project", "topic", "status", "type", "source"];
const TAGS = Array.from({ length: 200 }, (_, i) =>
  i % 3 === 0 ? `${pick(AREAS)}/${pick(WORDS)}${i}` : `${pick(WORDS)}${i}`,
);

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
const words = (n: number) =>
  Array.from({ length: n }, () => pick(WORDS)).join(" ");
const sentence = () => `${capitalize(words(int(6, 16)))}.`;

// About one folder per 40 notes, up to three levels deep. A tenth of the
// notes stay in the vault root.
const folders = [""];
for (let i = 0; i < Math.max(1, Math.round(count / 40)); i++) {
  const parent = pick(folders);
  folders.push(
    parent.split("/").length >= 3
      ? `${pick(WORDS)}-${i}`
      : join(parent, `${pick(WORDS)}-${i}`),
  );
}

const notes = Array.from({ length: count }, (_, i) => {
  const title = `${capitalize(words(int(1, 3)))} ${i}`;
  return { title, path: join(chance(0.1) ? "" : pick(folders), `${title}.md`) };
});

function link(): string {
  if (chance(0.05)) return `[[Missing ${int(0, count)}]]`;
  const target = pick(notes).title;
  if (chance(0.15)) return `[[${target}|${words(2)}]]`;
  if (chance(0.1)) return `[[${target}#${capitalize(words(2))}]]`;
  return `[[${target}]]`;
}

function paragraph(): string {
  const parts = Array.from({ length: int(2, 6) }, sentence);
  for (let i = int(0, 2); i > 0; i--)
    parts.splice(int(0, parts.length), 0, `See ${link()}.`);
  if (chance(0.3)) parts.push(`#${pick(TAGS)}`);
  return parts.join(" ");
}

function body(title: string): string {
  const out: string[] = [];
  if (chance(0.4)) {
    out.push("---");
    out.push(
      `tags: [${Array.from({ length: int(1, 3) }, () => pick(TAGS)).join(", ")}]`,
    );
    if (chance(0.3)) out.push(`aliases: [${capitalize(words(2))}]`);
    out.push("---", "");
  }
  out.push(`# ${title}`, "");
  for (let section = int(1, 4); section > 0; section--) {
    if (chance(0.7)) out.push(`## ${capitalize(words(int(1, 4)))}`, "");
    for (let p = int(1, 3); p > 0; p--) out.push(paragraph(), "");
    if (chance(0.3)) {
      for (let item = int(2, 5); item > 0; item--)
        out.push(`- [${chance(0.5) ? "x" : " "}] ${words(int(3, 8))}`);
      out.push("");
    }
  }
  return out.join("\n");
}

let bytes = 0;
const made = new Set<string>();
for (const note of notes) {
  const path = join(dir, note.path);
  const folder = dirname(path);
  if (!made.has(folder)) {
    mkdirSync(folder, { recursive: true });
    made.add(folder);
  }
  const text = body(note.title);
  bytes += Buffer.byteLength(text);
  writeFileSync(path, text);
}

console.log(
  `${count} notes in ${made.size} folders, ${(bytes / 1024 / 1024).toFixed(1)} MB, ` +
    `${Math.round(bytes / count)} bytes per note on average: ${dir}`,
);
