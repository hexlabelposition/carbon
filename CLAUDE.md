# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Carbon is a local-first Markdown notes app (an Obsidian alternative) built with Tauri 2, React and a pure TypeScript core. Linux is the primary platform, Windows is supported. `ARCHITECTURE.md` is the detailed design (with ADR-NNN decisions). There is no backlog in the repository: tasks and ideas are planned in the author's own Carbon vault, and what each release brought is in GitHub Releases. Older commits and code comments refer to C-NNN task ids and milestones M0–M6 of the former backlog: look one up with `git show 1b7fb71:BACKLOG.md`.

## Commands

Bun is the package manager and test runner (Node.js is still needed for tsc, ESLint and Vite).

```bash
bun install
bun tauri dev                 # run the app (Vite dev server on port 1420)
bun test                      # all core tests
bun test packages/core/test/search.test.ts   # one file
bun test -t "pattern"         # tests whose name matches
bun run typecheck             # app, scripts, e2e and every workspace package
bun run lint                  # ESLint (lint:fix to fix)
bun run format:check          # Prettier (format to write)
bun run e2e                   # end-to-end tests in the real app, Linux only
bun gen:vault                 # generate a large vault for benchmarks
bun bench                     # core benchmarks
```

CI runs typecheck, lint, format:check and `bun test`; run them all before considering a change done.

`bun run e2e` (`scripts/e2e.ts`) starts Vite if needed, builds the debug app with cargo, and runs `tauri-driver` with an isolated profile in a temp folder against `fixtures/test-vault`, so the user's vaults and settings are never touched. It needs `tauri-driver` and WebKitWebDriver.

## Architecture

Three layers, with two hard rules:

1. **`packages/core` (`@carbon/core`) never imports React or `@tauri-apps/*`.** It receives a `Platform` object (interfaces in `packages/core/src/platform/`: `FileSystem`, `Watcher`, `SqlDatabases`, `Trash`, `SettingsStore`, optional `NoteParser`) and touches the outside world only through it.
2. **UI code never calls Tauri APIs directly.** It goes through the core. The Tauri implementations of the platform interfaces live in `src/platform/`.

This is why the core is fully testable with `bun test`: `packages/core/test/fakes/` provides an in-memory platform (file system, watcher, trash, settings, and SQLite via Bun's in-memory database).

### Core

- `Vault.open(path, platform)` returns the single object the UI talks to: `vault.notes`, `folders`, `attachments`, `links`, `search`, `tags`, `graph`, `bookmarks`, `trash`, plus events (`changed`, `tree`, `conflict`, `rewritten`, `index:progress|ready|updated`, ...). See ARCHITECTURE.md §6.
- **Files are the source of truth; the SQLite index is a cache.** On a schema version mismatch it is deleted and rebuilt, so there are no migrations. All SQL lives in the core behind `IndexStore` (`index/index-store.ts`); the platform only executes statements.
- Writes are atomic (temp file + rename) and guarded by a content hash: `notes.write(path, content, baseHash)` rejects if the file changed on disk, which drives the editor's conflict flow. The vault ignores its own writes in watcher events (`vault/own-changes.ts`).
- The parser is built on Lezer Markdown with Carbon extensions for wiki links and tags, and is the **same grammar the CodeMirror editor uses**, so highlighting and indexing always agree. It has no DOM access and runs in a Web Worker during the startup scan. `packages/core/test/corpus/` is a shared sample corpus.
- Renaming a note rewrites links to it; renaming a tag rewrites inline tags (via the grammar) and frontmatter `tags`.
- Vault-local data lives in `.carbon/` inside the vault: `trash/`, `drafts/`, `bookmarks.json`, `config.json`.
- Full-text search uses SQLite FTS5; the quick switcher uses fuzzysort over the in-memory tree, so it works before the index is ready.

### App (`src/`)

- `features/<name>/`: feature logic (hooks, state) and components, shared across form factors. `shells/desktop/` arranges panels and navigation; it is the only shell. Keep feature logic out of layout components and don't rely on hover as the only way to do something.
- `workers/`: the parse worker (startup indexing) and the graph layout worker (d3-force; rendering uses sigma/canvas).
- Editor: CodeMirror 6 with live preview implemented as decorations (`features/editor/live-preview*.ts`); the document on disk is always plain Markdown.
- UI text is translated: add every string to both `features/i18n/en.ts` and `features/i18n/ru.ts`.
- `src/dev/`: dev-build-only panels (benchmarks, test vault).

### Tauri (`tauri/`)

Named `tauri/`, not `src-tauri/`. Mostly official plugins (fs, sql, dialog, opener, updater, process, log). Custom Rust is kept to a few small commands in `tauri/src/lib.rs`: `move_to_trash`, `import_file`, `list_notes`, `sql_batch`. The project constraint is "no custom Rust beyond that"; prefer solving things in TypeScript.

### Performance budgets

ARCHITECTURE.md §1 sets targets for a 10k-note vault (e.g. reindex after save < 50 ms, search < 50 ms, quick switcher < 16 ms, no dropped frames while typing). Keep heavy work off the UI thread.
