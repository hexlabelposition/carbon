// Timers exist in every runtime the core targets (WebView, Web Worker, Bun)
// but are not part of the ECMAScript library types the core compiles with.

declare function setTimeout(handler: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;
