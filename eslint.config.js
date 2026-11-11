import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Builds a `no-restricted-imports` rule from `[pattern, message]` pairs. */
const restrictImports = (...patterns) => [
  "error",
  {
    patterns: patterns.map(([group, message]) => ({ group: [group], message })),
  },
];

const noTauri = ["@tauri-apps/*", "Only src/platform may import Tauri APIs."];

export default defineConfig([
  globalIgnores(["dist", "tauri/target", "tauri/gen"]),

  js.configs.recommended,
  tseslint.configs.recommended,

  // The application: runs in the WebView.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
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
    files: ["scripts/**", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },

  // Turns off rules that would fight with Prettier. Keep it last.
  prettier,
]);
