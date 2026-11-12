import { parseFiles } from "@carbon/core";
import type { ParseReply, ParseRequest } from "./parse-messages";

// The app's TypeScript setup knows the window, not workers: this is the
// part of the worker scope used here.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage(reply: ParseReply): void;
};

/** Parses each batch it is sent and sends the results back. */
scope.onmessage = ({ data: { id, files } }) => {
  try {
    scope.postMessage({ id, parsed: parseFiles(files) });
  } catch (error) {
    scope.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
