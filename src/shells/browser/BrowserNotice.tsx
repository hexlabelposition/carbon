import { CarbonLogo } from "../../features/brand/CarbonLogo";

/**
 * What a plain web browser shows: the app needs Tauri for its files, its
 * index and its window, and without them it cannot start.
 */
export function BrowserNotice() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-8 text-ui text-fg">
      <div className="flex max-w-100 flex-col gap-4">
        <CarbonLogo className="h-10 w-auto self-start" />
        <h1 className="text-h3 font-semibold">Carbon runs as a desktop app</h1>
        <p className="text-muted">
          This page is its interface without the app around it: notes, the index
          and the window come from Tauri, which a web browser does not have.
        </p>
        <p className="text-muted">
          Start it with{" "}
          <code className="rounded-sm border border-line bg-code px-1 font-mono text-small">
            bun tauri dev
          </code>
          .
        </p>
      </div>
    </main>
  );
}
