/** The trash of the operating system: the Recycle Bin on Windows. */
export interface Trash {
  /**
   * Moves a file, or a folder with everything inside, to the system trash.
   * Rejects and leaves `path` in place if that is not possible, for example
   * on a drive that has no trash. `path` is absolute and `/` separated.
   */
  moveToTrash(path: string): Promise<void>;
}
