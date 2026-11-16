import { matchKey } from "../links/resolve";
import { renameFrontmatterTags } from "../parser/frontmatter-edit";
import { markdownParser, withoutFrontmatter } from "../parser/parse-note";

/**
 * The text of a note with the tag `from` renamed to `to`, and the tags
 * nested in it with it: `#area/x` becomes `#field/x` when `area` becomes
 * `field`. Inline tags and the tags of the frontmatter; case is ignored
 * in `from`, and the parts after it keep their spelling. `null` if the
 * note has none of them.
 */
export function renameTagIn(
  text: string,
  from: string,
  to: string,
): string | null {
  const key = matchKey(from);
  const depth = from.split("/").length;
  const rename = (tag: string): string | null => {
    const tagKey = matchKey(tag);
    if (tagKey !== key && !tagKey.startsWith(`${key}/`)) return null;
    return [to, ...tag.split("/").slice(depth)].join("/");
  };

  // Inline tags, from the end, so the offsets before stay right.
  const body = withoutFrontmatter(text);
  const edits: { from: number; to: number; text: string }[] = [];
  markdownParser.parse(body).iterate({
    enter({ name, from, to }) {
      if (name !== "HashtagLabel") return;
      const next = rename(body.slice(from, to));
      if (next !== null) edits.push({ from, to, text: next });
    },
  });
  let result = text;
  for (const edit of edits.reverse()) {
    result = result.slice(0, edit.from) + edit.text + result.slice(edit.to);
  }

  // The frontmatter is before every inline tag: its offsets are as read.
  const change = renameFrontmatterTags(result, rename);
  if (change !== null) {
    result =
      result.slice(0, change.from) + change.insert + result.slice(change.to);
  }
  return edits.length === 0 && change === null ? null : result;
}
