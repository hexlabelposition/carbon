import type { NoteParser, ParsedFile } from "@carbon/core";
import type { ParseReply, ParseRequest } from "./parse-messages";

interface Pending {
  resolve: (parsed: ParsedFile[]) => void;
  reject: (error: Error) => void;
}

/**
 * A `NoteParser` that parses in a Web Worker, so the startup scan of a
 * large vault does not take the UI thread (ARCHITECTURE.md, section 8).
 * The worker starts on the first batch and then stays: a vault opened
 * later reuses it.
 */
export function createWorkerParser(): NoteParser {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  /** Fails every batch in flight, and starts a new worker next time. */
  const fail = (message: string) => {
    for (const { reject } of pending.values()) reject(new Error(message));
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  const start = (): Worker => {
    const started = new Worker(new URL("./parse-worker.ts", import.meta.url), {
      type: "module",
      name: "parse",
    });
    started.onmessage = ({ data }: MessageEvent<ParseReply>) => {
      const batch = pending.get(data.id);
      if (batch === undefined) return;
      pending.delete(data.id);
      if ("error" in data) batch.reject(new Error(data.error));
      else batch.resolve(data.parsed);
    };
    // The worker could not load, or broke outside a batch.
    started.onerror = (event) => {
      event.preventDefault();
      fail(`The parse worker failed: ${event.message || "unknown error"}`);
    };
    return started;
  };

  return {
    parse(files) {
      return new Promise((resolve, reject) => {
        worker ??= start();
        const id = nextId++;
        pending.set(id, { resolve, reject });
        const request: ParseRequest = { id, files };
        worker.postMessage(request);
      });
    },
  };
}
