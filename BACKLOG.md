# Backlog

Tasks for Carbon, grouped by milestone. Architecture background is in [ARCHITECTURE.md](ARCHITECTURE.md).

**Priorities**

- **P0** required for the milestone
- **P1** important, can slip to the next milestone
- **P2** nice to have

**Rules**

- Milestones are done in order. Each one ends with something usable.
- A milestone is done when its "Done when" line is true.
- New ideas go to [Ideas under consideration](#ideas-under-consideration) first, not into the current milestone.

---

## M0. Foundation

Done when: the Tauri window opens on Linux, React calls a function from `@carbon/core` that reads a real file through the Tauri adapter, the two measurements below are recorded, and CI is green.

- [x] **C-001** (P0) Create the monorepo with Bun workspaces
- [x] **C-002** (P0) Scaffold the Tauri 2 app with React + TypeScript + Vite in the repository root, rename `src-tauri/` to `tauri/`
- [x] **C-003** (P0) Set up Tailwind CSS with theme variables (dark and light)
- [x] **C-004** (P0) Create `packages/core`: public API skeleton, platform interfaces (`FileSystem`, `Watcher`, `IndexStore`)
- [x] **C-005** (P0) Tauri adapters in `src/platform`, add the `fs`, `sql`, `dialog` plugins
- [x] **C-006** (P0) In-memory fakes for the platform interfaces, first core test with `bun test`
- [x] **C-007** (P0) Measure: read 10k files through the `fs` plugin (time, best concurrency)
- [x] **C-008** (P0) Measure: SQL plugin with FTS5 (is it available, bulk insert speed for 10k notes)
- [x] **C-009** (P0) Decide the index engine from C-007 and C-008 (ADR-009, open question 1)
- [x] **C-010** (P0) Add the MIT LICENSE file
- [x] **C-011** (P0) CI: type check, lint, tests, build on Linux and Windows
- [x] **C-012** (P1) Test vault generator: N notes with random links and tags
- [x] **C-013** (P2) Contributing guide and code style notes

## M1. Vault and editor

Done when: I can open a folder, browse notes, edit them with live preview, and nothing is lost on crash or external edits.

**Core**

- [x] **C-101** (P0) Open a folder as a vault, return the file tree
- [x] **C-102** (P0) Read notes; write notes atomically (temp file + rename)
- [x] **C-103** (P0) Create, rename, move, delete notes and folders
- [x] **C-104** (P0) Watch the vault, debounce, emit added / changed / removed
- [x] **C-105** (P0) Reject a write when the file on disk changed (hash check)
- [x] **C-106** (P1) Delete to system trash
- [x] **C-107** (P1) App settings: recent vaults, last opened note

**UI**

- [x] **C-110** (P0) Desktop shell in `src/shells/desktop`; feature logic lives in hooks, not in layout components
- [x] **C-111** (P0) Start screen: open vault, create vault, recent vaults
- [x] **C-112** (P0) File tree sidebar with create, rename, delete, drag to move
- [x] **C-113** (P0) CodeMirror 6 editor with Markdown highlighting
- [x] **C-114** (P0) Live preview: headings, bold, italic, strikethrough, inline code
- [x] **C-115** (P0) Live preview: lists, task checkboxes (clickable), quotes, horizontal rule
- [x] **C-116** (P0) Live preview: code blocks with syntax highlighting
- [x] **C-117** (P0) Autosave with debounce, unsaved indicator
- [x] **C-118** (P0) Reload an open note when it changes on disk; conflict dialog if it has unsaved edits
- [x] **C-119** (P1) Tabs and back / forward navigation history
- [x] **C-120** (P1) Live preview: tables
- [x] **C-121** (P1) Local images render in the editor; paste or drop an image saves it into the vault
- [x] **C-122** (P2) Source mode toggle (raw Markdown)
- [x] **C-123** (P2) Outline panel (headings of the current note)

## M2. Links and backlinks

Done when: I can link notes with `[[...]]`, jump between them, see backlinks, and rename a note without breaking links.

**Core**

- [x] **C-201** (P0) Lezer Markdown extension for wiki links `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`
- [x] **C-202** (P0) `parseNote`: title, headings, wiki links, Markdown links to local `.md` files, plain text
- [x] **C-203** (P0) Index store implementation for notes and links, kept in the app cache directory
- [x] **C-204** (P0) Startup scan: index only new and changed files, drop removed ones
- [x] **C-205** (P0) Parsing in a Web Worker so the scan does not block the UI
- [x] **C-206** (P0) Incremental reindex on save and on watcher events
- [x] **C-207** (P0) Link resolution: exact path, then file name, then alias
- [x] **C-208** (P0) Backlinks query with context snippet
- [x] **C-209** (P0) Rename and move rewrite links in other notes
- [x] **C-210** (P1) Unresolved links query
- [x] **C-211** (P1) Index progress and ready events

**UI**

- [x] **C-221** (P0) Render wiki links in live preview; click or Ctrl/Cmd+click to follow
- [x] **C-222** (P0) `[[` autocomplete with note titles
- [x] **C-223** (P0) Following a link to a missing note creates it
- [ ] **C-224** (P0) Backlinks panel for the current note
- [ ] **C-225** (P1) Heading autocomplete after `[[Note#`
- [ ] **C-226** (P1) Indexing status in the status bar
- [ ] **C-227** (P2) Hover preview of the linked note
- [ ] **C-228** (P2) Unlinked mentions (note title appears as plain text elsewhere)

## M3. Search

Done when: I can find any note by title or content in a 10k-note vault without noticeable delay.

- [ ] **C-301** (P0) Full-text index over title and body, kept in sync by the indexer
- [ ] **C-302** (P0) `search.query` with ranking, snippets and match highlights
- [ ] **C-303** (P0) Search panel: results list, click opens the note at the match
- [ ] **C-304** (P0) Quick switcher (Ctrl/Cmd+O): fuzzy match on titles, Enter opens, create if missing
- [ ] **C-305** (P0) Find and replace inside the current note
- [ ] **C-306** (P1) Command palette (Ctrl/Cmd+P) for all app actions
- [ ] **C-307** (P1) Search works for non-English text (check tokenizer for Cyrillic)
- [ ] **C-308** (P2) Search operators: `tag:`, `path:`, exact phrase
- [ ] **C-309** (P2) Recent notes in the quick switcher when the query is empty

## M4. Tags and metadata

Done when: tags and frontmatter are indexed, visible and usable for navigation.

- [ ] **C-401** (P0) Lezer extension for inline `#tag` and nested `#area/topic`
- [ ] **C-402** (P0) Parse YAML frontmatter (`tags`, `aliases`, other properties)
- [ ] **C-403** (P0) Index tags, aliases, properties
- [ ] **C-404** (P0) Tags panel: tree of tags with counts, click shows notes
- [ ] **C-405** (P0) Aliases used in link resolution and `[[` autocomplete
- [ ] **C-406** (P1) Tag autocomplete after `#`
- [ ] **C-407** (P1) Frontmatter rendered as a compact block in live preview
- [ ] **C-408** (P2) Properties editor UI (edit frontmatter without writing YAML)
- [ ] **C-409** (P2) Rename a tag across the vault

## M5. Graph

Done when: the graph of a 10k-note vault opens and stays smooth while panning and zooming.

- [ ] **C-501** (P0) Core: `graph.global` (nodes, edges) and `graph.local` (around a note, depth N)
- [ ] **C-502** (P0) Prototype renderers with a 10k-node vault and pick one (open question 2)
- [ ] **C-503** (P0) Graph view: force layout in a Web Worker, pan, zoom, click to open a note
- [ ] **C-504** (P0) Local graph panel for the current note
- [ ] **C-505** (P1) Hover highlights a node and its neighbors
- [ ] **C-506** (P1) Filters: by tag, hide orphans, show unresolved links
- [ ] **C-507** (P2) Node size by number of links, color by tag or folder
- [ ] **C-508** (P2) Graph updates live when notes change

## M6. Polish and release 0.1

Done when: a stranger on Linux can download Carbon, create a vault and use it daily.

- [ ] **C-601** (P0) Settings screen: theme, font, font size, editor options
- [ ] **C-602** (P0) Performance pass against the budgets, fix regressions
- [ ] **C-603** (P0) App icon and branding in the app and installers
- [ ] **C-604** (P0) Packaging for Linux: AppImage, deb
- [ ] **C-605** (P0) Use Carbon for my own notes for two weeks, fix what hurts
- [ ] **C-606** (P0) Error handling pass: clear messages, local log file
- [ ] **C-607** (P1) Auto-update
- [ ] **C-608** (P1) Windows release: installer, code signing, test pass on a real Windows machine
- [ ] **C-609** (P1) End-to-end tests for the main flows
- [ ] **C-610** (P1) Landing page and short user guide
- [ ] **C-611** (P2) Configurable keyboard shortcuts
- [ ] **C-612** (P2) AUR package

---

## Ideas under consideration

**These are open questions, not promises.** Nothing here is scheduled or guaranteed. An idea moves into a milestone only after a deliberate decision.

- Android app: mobile shell, file access inside the app sandbox, sync. First in line after v0.1
- macOS build
- iOS app
- Obsidian compatibility: open an existing Obsidian vault as is, maybe read some of its settings
- Embeds: `![[Note]]`, `![[Note#Heading]]`
- Daily notes and templates
- Built-in git sync
- Own end-to-end encrypted sync service
- Publishing notes to the web
- Plugin or extension API
- Block references `[[Note#^block]]`
- Export to PDF and HTML
- Import from other apps (Notion, Evernote)
- Vim mode
- Spell check
- Interface translations
- Canvas (free-form board)
- Multiple windows and split panes
- Vault encryption
- Moving hot paths (file scan, indexing) to native code
- Paid optional services as an income model

## Open decisions

Tracked in [ARCHITECTURE.md, open questions](ARCHITECTURE.md#13-open-questions).

| Decision                             | Needed before  |
| ------------------------------------ | -------------- |
| State management library             | M1 UI work     |
| Test runner (`bun test` or Vitest)   | First UI tests |
| Graph renderer                       | M5 (C-502)     |
| Stable note IDs for external renames | After v0.1     |
