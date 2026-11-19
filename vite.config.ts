import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";
import { readFileSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST;

/** The version of the app, from package.json alone. */
const { version } = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  // The version of the app, from package.json alone: tauri.conf.json
  // reads it from there too, so a release changes it in one place.
  define: { __CARBON_VERSION__: JSON.stringify(version) },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // The bundle ships inside the app and loads from disk, not the network, so
  // the 500 kB web default only adds noise. The main chunk is ~1.1 MB.
  build: { chunkSizeWarningLimit: 1500 },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore the Tauri build output
      ignored: ["**/tauri/target/**", "**/tauri/gen/**"],
    },
  },
}));
