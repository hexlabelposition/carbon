import type { SettingsStore } from "../../src/index";

/** An in-memory `SettingsStore`. `text` is what a real one keeps on disk. */
export class MemorySettingsStore implements SettingsStore {
  constructor(public text: string | null = null) {}

  async read(): Promise<string | null> {
    return this.text;
  }

  async write(text: string): Promise<void> {
    this.text = text;
  }
}
