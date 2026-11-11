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

CI runs the type check, lint, format check and tests, and builds the app on Linux and Windows. Run the first four locally before pushing.

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

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
