// A parse worker for the bench, as the one of the app (src/workers).
import { parseFiles, type NoteFile } from "../src/index";

declare const self: {
  onmessage:
    ((event: MessageEvent<{ id: number; files: NoteFile[] }>) => void) | null;
  postMessage(reply: unknown): void;
};

self.onmessage = ({ data: { id, files } }) => {
  self.postMessage({ id, parsed: parseFiles(files) });
};
