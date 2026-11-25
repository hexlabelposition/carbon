import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Builds a `no-restricted-imports` rule from `[pattern, message]` pairs. */
const restrictImports = (
  ...patterns: [group: string, message: string][]
): Linter.RuleEntry => [
  "error",
  {
    patterns: patterns.map(([group, message]) => ({ group: [group], message })),
  },
];

const noTauri: [string, string] = [
  "@tauri-apps/*",
  "Only src/platform may import Tauri APIs.",
];

export default defineConfig([
  globalIgnores([
    "dist",
    "tauri/target",
    "tauri/gen",
    "website/dist",
    "website/.astro",
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,

  // The application: runs in the WebView.
  {
    files: ["src/**/*.{ts,tsx}"],
    // A file of components exports only components, or a change to it
    // reloads the whole page instead of refreshing it (Fast Refresh).
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite()],
    languageOptions: { globals: globals.browser },
    rules: { "no-restricted-imports": restrictImports(noTauri) },
  },
  // Platform adapters are the one place that talks to Tauri.
  {
    files: ["src/platform/**"],
    rules: { "no-restricted-imports": "off" },
  },

  // The core: no React, no Tauri, no DOM (ARCHITECTURE.md, section 2).
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["@tauri-apps/*", "The core must not depend on Tauri."],
        ["react*", "The core must not depend on React."],
      ),
    },
  },

  // Scripts and config files run in Bun or Node.
  {
    files: ["scripts/**", "e2e/**", "*.config.{js,ts}", "website/*.config.ts"],
    languageOptions: { globals: globals.node },
  },

  // The scripts of the landing page (website/) run in the browser.
  {
    files: ["website/src/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },

  // Turns off rules that would fight with Prettier. Keep it last.
  prettier,
]);
