# Contributing

Carbon is built by one person to solve their own note-taking pains first. Issues and pull requests are welcome, but a change is easier to accept when it fits the [backlog](BACKLOG.md) and the [architecture](ARCHITECTURE.md). For anything larger than a fix, open an issue before writing code.

## Setup

Prerequisites:

- Bun: package manager, script runner and test runner
- Node.js: `tsc`, ESLint, Prettier and Vite run on it when started through `bun run`
- Rust toolchain: Tauri needs it to build the app. For editor support, install the Rust standard library sources too (`rust-src`)
- Tauri system dependencies for your OS (see the Tauri prerequisites guide)

```bash
bun install
bun tauri dev
```

## Commands

| Command               | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `bun tauri dev`       | Run the app in dev mode                           |
| `bun test`            | Run the core tests                                |
| `bun run typecheck`   | Type check the app, the core and the scripts      |
| `bun run lint`        | Lint with ESLint (`lint:fix` applies fixes)       |
| `bun run format`      | Format with Prettier (`format:check` only checks) |
| `bun gen:vault <dir>` | Generate a test vault with 10,000 notes           |
| `bun run bench <dir>` | Measure the core against the budgets on a vault   |
| `bun run icons`       | Make every app icon from `tauri/app-icon.svg`     |
| `bun run e2e`         | Run the end-to-end tests in the real app (Linux)  |

CI runs the type check, lint, format check and tests, and builds the app on Linux and Windows. Run the first four locally before pushing.

The end-to-end tests of the main flows (`e2e/`) run the real app on Linux: `bun run e2e`. They need `tauri-driver` (`cargo install tauri-driver --locked`) and WebKitWebDriver (the `webkit2gtk-driver` package, or `webkit2gtk` on Arch). The script starts the dev server if none runs, builds the debug app, and gives it a profile of its own in a temporary folder, so your vaults and settings are not touched. A window opens for a few seconds. When a test fails, the profile is kept with a screenshot of each failure and the log of the app.

To try a change by hand, use **Open test vault** in the dev tools, the orange bug in the top row of the dev build. It opens a copy of `fixtures/test-vault`, made afresh each time, with a note for each area: formatting, links, images, tags, a long note, Cyrillic names. Anything may be changed in it. A case the vault lacks goes into `fixtures/test-vault`.

## Where code goes

| Folder              | What lives there                                     | Must not import                |
| ------------------- | ---------------------------------------------------- | ------------------------------ |
| `packages/core/src` | Everything about notes: vault, parser, index, search | React, Tauri, DOM or Node APIs |
| `src/platform`      | Tauri implementations of the core interfaces         |                                |
| `src` (the rest)    | UI: features, shells, workers                        | `@tauri-apps/*`                |
| `tauri`             | Tauri config, capabilities, plugin registration      |                                |

ESLint and the core `tsconfig.json` enforce the import rules. The reasons are in [ARCHITECTURE.md, section 2](ARCHITECTURE.md#2-high-level-overview).

Two more rules from the architecture:

- The core touches the outside world only through the `Platform` object it is given. A new need means a new method on a platform interface, an adapter in `src/platform`, and a fake in `packages/core/test/fakes`.
- Feature logic lives in hooks, not in layout components.

## Code style

Formatting is Prettier with its default settings, so there is nothing to decide. Beyond that:

- TypeScript is strict. Avoid `any` and non-null assertions (`!`).
- Paths inside the core use `/` on every platform. Note paths are relative to the vault root.
- Functions that return a promise reject instead of throwing synchronously.
- Comments explain why, not what. Temporary code says which task removes it, for example "Remove with C-110".
- Config files keep their options in named groups.
- No custom Rust without a measurement that shows the need ([ARCHITECTURE.md, section 7](ARCHITECTURE.md#7-tauri-usage)).

## Tests

- Core logic is tested with `bun test` against the in-memory fakes. No test touches the real disk.
- A bug fix comes with a test that fails without the fix.
- The UI test runner is not chosen yet ([open question 7](ARCHITECTURE.md#13-open-questions)).

## Commits and tasks

- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `style:`, `chore:`, `ci:`. Lowercase, imperative, no trailing period.
- One commit does one thing. Formatting-only changes get their own `style:` commit.
- Tasks have IDs in [BACKLOG.md](BACKLOG.md), such as `C-104`. Tick the task in the same change that finishes it.
- New ideas go to "Ideas under consideration" in the backlog first, not into the current milestone.
- A decision that changes the architecture is recorded in the decision log in [ARCHITECTURE.md](ARCHITECTURE.md#12-decision-log).

## Releases

1. Raise the version in `package.json` (`tauri/tauri.conf.json` and the interface read it from there) and in `tauri/Cargo.toml`, and commit it.
2. Tag the commit `v` and the version, such as `v0.1.0`, and push the tag.
3. The release workflow checks the tag against the version and makes a draft release on GitHub, with the text of `.github/release-notes.md`. It builds the deb and the AppImage on Ubuntu 22.04 and the Windows installer (NSIS, for the current user) on Windows, and attaches them to the draft.
4. Try the packages, on Windows with the list below, then publish the release.

To build the packages on your machine: `bun tauri build`. On Linux they land in `tauri/target/release/bundle/deb` and `tauri/target/release/bundle/appimage`; on Windows the installer lands in `tauri/target/release/bundle/nsis`.

The Windows installer is not signed yet (C-608), so SmartScreen warns before it runs. Signing switches on by itself once the secret `WINDOWS_SIGN_COMMAND` holds the command of a signing service, with `%1` for the file.

### Trying a release on Windows

On a real Windows 10 or 11, with the installer from the draft:

- [ ] The installer runs without administrator rights, in the language of the system, and puts Carbon in the Start menu.
- [ ] Carbon starts; the window has its own title bar, rounded corners, and minimize, maximize and close work; dragging the top row moves it.
- [ ] Create a vault, open one, reopen it from the recent list; the last open vault opens at the next start.
- [ ] Notes: create, type, rename, move by drag, delete to the vault trash and to the system trash (Recycle Bin), restore.
- [ ] A note changed in Notepad while open is reloaded; a note with unsaved edits asks.
- [ ] Paste and drop an image from Explorer; it lands in the vault and shows.
- [ ] Links: follow, create a missing note, rename a note and see its links rewritten; backlinks and the graph show.
- [ ] Search, the quick switcher and the palette; Cyrillic names and text.
- [ ] Shortcuts with Ctrl; changing one in the settings; zoom with Ctrl+wheel and Ctrl+= / Ctrl+-.
- [ ] Settings: theme, language, fonts; "Open the log folder" opens `%LOCALAPPDATA%\io.github.hexlabelposition.carbon\logs`, with `carbon.log` in it.
- [ ] Uninstall from "Apps"; the notes in the vault stay.

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
