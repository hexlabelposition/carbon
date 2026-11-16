import type { NoteFile, NoteParser, ParsedFile } from "@carbon/core";
import type { ParseReply, ParseRequest } from "./parse-messages";

interface Pending {
  resolve: (parsed: ParsedFile[]) => void;
  reject: (error: Error) => void;
}

/**
 * Parse workers at most: one core stays for the UI thread, and past four
 * the startup scan waits on reading and writing more than on parsing.
 */
const MAX_WORKERS = 4;

/** Files below which a batch goes to one worker: splitting costs more. */
const SPLIT_FROM = 32;

/**
 * How long a worker with nothing to parse stays, in milliseconds. Each
 * holds its own copy of the parser and the core, tens of megabytes; past
 * the startup scan there is little to parse, and starting one again takes
 * a moment (C-602).
 */
const IDLE_MS = 10_000;

/**
 * A `NoteParser` that parses in Web Workers, so the startup scan of a
 * large vault does not take the UI thread (ARCHITECTURE.md, section 8).
 * Parsing a note is the slowest step of the first index (C-602), so a
 * large batch is shared out among several workers, one per core but one,
 * at most `MAX_WORKERS`; a small one, such as a note just saved, goes to
 * the next worker in turn. A worker starts on its first batch and stops
 * after `IDLE_MS` with nothing to do.
 */
export function createWorkerParser(): NoteParser {
  const count = Math.max(
    1,
    Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 2) - 1),
  );
  const workers = Array.from({ length: count }, () => oneWorker());
  let turn = 0;

  return {
    async parse(files) {
      if (files.length < SPLIT_FROM || count === 1) {
        turn = (turn + 1) % count;
        return workers[turn].parse(files);
      }
      // In order: each worker takes a run of files side by side, so the
      // answers join back in the order of the batch.
      const size = Math.ceil(files.length / count);
      const parts = await Promise.all(
        workers.map((worker, i) =>
          worker.parse(files.slice(i * size, (i + 1) * size)),
        ),
      );
      return parts.flat();
    },
  };
}

/**
 * One worker, started on its first batch and stopped when idle, started
 * again when it is needed or if it breaks.
 */
function oneWorker(): {
  parse(files: readonly NoteFile[]): Promise<ParsedFile[]>;
} {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();
  let idle: ReturnType<typeof setTimeout> | null = null;

  /** Stops the worker once nothing is left to parse for a while. */
  const stopWhenIdle = () => {
    if (pending.size > 0) return;
    idle = setTimeout(() => {
      idle = null;
      worker?.terminate();
      worker = null;
    }, IDLE_MS);
  };

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
      stopWhenIdle();
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
      // An empty share of a small batch needs no worker.
      if (files.length === 0) return Promise.resolve([]);
      if (idle !== null) {
        clearTimeout(idle);
        idle = null;
      }
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
