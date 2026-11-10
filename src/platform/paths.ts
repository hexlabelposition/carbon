/** The core uses `/` on every platform; Windows reports `\`. */
export function toCorePath(path: string): string {
  return path.replaceAll("\\", "/");
}
