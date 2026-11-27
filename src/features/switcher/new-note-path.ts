import type { NotePath } from "@carbon/core";

/**
 * The path of a note named as typed: at the vault root, or in the folders
 * typed before it, as `projects/Idea`. `null` if nothing is typed.
 */
export function newNotePath(query: string): NotePath | null {
  const name = query.trim().replace(/^\/+|\/+$/g, "");
  if (name === "") return null;
  return /\.md$/i.test(name) ? name : `${name}.md`;
}
