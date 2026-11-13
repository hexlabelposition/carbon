import { EditorView, hoverTooltip } from "@codemirror/view";
import type { Link, NotePath } from "@carbon/core";
import { linkHost } from "./link-completion";
import { linkAt } from "./link-follow";

/** What a hover over a link shows. */
export type LinkPreview =
  | {
      path: NotePath;
      title: string;
      /** The start of the note, or of the heading the link points to. */
      text: string;
    }
  /** The link points to no note; following it creates one. */
  | { path: null };

/** Lines of the note a preview shows at most. */
const PREVIEW_LINES = 12;
/** Characters of the note a preview shows at most. */
const PREVIEW_CHARS = 800;

/**
 * Resting the mouse on a link to a note shows the start of that note: its
 * title and its first lines as plain text, from the heading if the link
 * points to one. A link to a missing note says that a click creates it.
 */
export const linkPreview = [
  hoverTooltip(
    async (view, pos) => {
      const host = view.state.facet(linkHost);
      if (host === null) return null;
      const link = linkAt(view.state, pos, host.current);
      if (link === null || link.target === "") return null;
      const preview = await host.preview(link).catch(() => null);
      if (preview === null) return null;
      return {
        pos: link.start,
        end: link.end,
        above: true,
        create: () => ({ dom: previewDom(preview) }),
      };
    },
    { hoverTime: 500 },
  ),
  EditorView.baseTheme({
    // Hover tooltips are only previews: the box draws the frame.
    ".cm-tooltip.cm-tooltip-hover": {
      border: "none",
      backgroundColor: "transparent",
    },
    ".cm-link-preview": {
      maxWidth: "360px",
      padding: "8px 12px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "6px",
      backgroundColor: "var(--cb-panel)",
      color: "var(--cb-fg)",
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
      lineHeight: "1.5",
    },
    ".cm-link-preview-title": { fontWeight: "600", marginBottom: "4px" },
    ".cm-link-preview-text": {
      color: "var(--cb-muted)",
      whiteSpace: "pre-line",
      overflowWrap: "anywhere",
    },
    ".cm-link-preview-empty": { color: "var(--cb-faint)" },
  }),
];

/** The text of a note as a preview shows it: its first lines, cut short. */
export function previewText(plainText: string): string {
  const lines = plainText.split("\n").slice(0, PREVIEW_LINES).join("\n");
  const cut = lines.length > PREVIEW_CHARS || plainText.length > lines.length;
  const text = lines.slice(0, PREVIEW_CHARS).trimEnd();
  return cut ? `${text}…` : text;
}

/** The link to preview: only what the host needs to find the note. */
export type PreviewedLink = Pick<Link, "kind" | "target" | "fragment">;

function previewDom(preview: LinkPreview): HTMLElement {
  const box = document.createElement("div");
  box.className = "cm-link-preview";
  if (preview.path === null) {
    box.textContent = "No such note yet. Click the link to create it.";
    box.classList.add("cm-link-preview-empty");
    return box;
  }
  const title = document.createElement("div");
  title.className = "cm-link-preview-title";
  title.textContent = preview.title;
  title.title = preview.path;
  const text = document.createElement("div");
  text.className =
    preview.text === ""
      ? "cm-link-preview-text cm-link-preview-empty"
      : "cm-link-preview-text";
  text.textContent = preview.text === "" ? "Empty note" : preview.text;
  box.append(title, text);
  return box;
}
