# Carbon

Fast, local-first notes with links. A simpler, more human alternative to Obsidian.

> **Status:** planning / pre-alpha. Nothing to install yet. See [BACKLOG.md](BACKLOG.md) for progress.

## Why Carbon

Plain Markdown files plus links between notes is a great way to think. Carbon keeps that idea and focuses on three things:

- **Speed.** A system WebView instead of a bundled Chromium. No Electron. Heavy work stays off the UI thread.
- **Simplicity.** Sensible defaults, fewer settings, no plugin hunt needed for the basics.
- **Ownership.** Your notes are ordinary `.md` files in a folder you choose. Carbon can be deleted and your notes stay readable.

Carbon is open to everyone, but it is built to solve its author's own note-taking pains first. That is why Linux is the primary platform.

## Principles

1. **Files are the source of truth.** The index is only a cache and can be rebuilt at any time.
2. **Local first.** Everything works offline. No account, no telemetry.
3. **Fast by design.** Performance budgets are defined in [ARCHITECTURE.md](ARCHITECTURE.md) and checked with benchmarks.
4. **Core is separate from the UI.** All note logic lives in a TypeScript library that knows nothing about React or Tauri.

## Planned features (MVP, v0.1)

- Markdown editor with live preview (formatting renders in place while you type)
- Wiki links `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]` with autocomplete
- Backlinks panel with context
- Full-text search and a quick switcher
- Tags (`#tag`, nested `#area/topic`) and YAML frontmatter
- Graph view (global and local)
- Light and dark themes

### Platforms

| Platform   | Status                                        |
| ---------- | --------------------------------------------- |
| Linux      | Primary. Developed and tested here first      |
| Windows    | Planned for v0.1                              |
| Android    | Under consideration, first in line after v0.1 |
| macOS, iOS | Under consideration                           |

### Not in v0.1

- Built-in sync. A vault is a normal folder, so git, Syncthing or any cloud drive works.
- Plugin system
- Real-time collaboration

### Under consideration

Ideas with no commitment (Android, macOS, iOS, sync, Obsidian vault compatibility and more) are listed in the [backlog](BACKLOG.md#ideas-under-consideration). Being on that list does not mean a feature will be built.

## Tech stack

| Layer                              | Choice                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| Language                           | TypeScript everywhere                                             |
| Core (notes, index, search, links) | `@carbon/core`, a private workspace package, not published to npm |
| App shell                          | Tauri 2 with official plugins, no custom Rust code for now        |
| UI                                 | React + Vite + Tailwind CSS                                       |
| Editor                             | CodeMirror 6                                                      |
| Storage                            | Markdown files + SQLite index                                     |
| Package manager and test runner    | Bun                                                               |

The reasoning behind each choice is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Repository layout (planned)

One repository, one Tauri project for every platform.

```
carbon/
  package.json          # the Carbon application and Bun workspaces root
  packages/
    core/               # @carbon/core: vault, parser, index, search, links
  src/                  # the Carbon application
    features/           # editor, file tree, backlinks, search, tags, graph
    shells/             # layout per form factor (desktop first)
    platform/           # Tauri adapters for the core (file system, database)
  tauri/                # Tauri: config and plugin registration only
  README.md
  ARCHITECTURE.md
  BACKLOG.md
```

## Development (once the scaffold exists)

Prerequisites:

- Bun
- Rust toolchain. Tauri needs it to build the app. You do not write Rust for Carbon.
- Tauri system dependencies for your OS (see the Tauri prerequisites guide)

```bash
git clone https://github.com/hexlabelposition/carbon
cd carbon
bun install
bun tauri dev         # run the app in dev mode
bun test              # run core tests
bun run typecheck     # type check the app, the core and the scripts
bun run lint          # lint with ESLint
bun run format        # format with Prettier
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): how Carbon is built and why
- [BACKLOG.md](BACKLOG.md): milestones and tasks

## Roadmap in one glance

| Milestone            | Outcome                                          |
| -------------------- | ------------------------------------------------ |
| M0 Foundation        | Repo, scaffold, CI, core package wired to Tauri  |
| M1 Vault and editor  | Open a folder, edit notes with live preview      |
| M2 Links             | Wiki links, backlinks, rename that updates links |
| M3 Search            | Full-text search, quick switcher                 |
| M4 Tags and metadata | Tags, frontmatter, aliases                       |
| M5 Graph             | Global and local graph                           |
| M6 Release 0.1       | Settings, packaging, performance pass            |

## License

MIT.
