import { EditorView, hoverTooltip } from "@codemirror/view";
import type { Link, NotePath } from "@carbon/core";
import { t } from "../i18n/i18n";
import { linkHost } from "./link-completion";
import { linkAt } from "./link-follow";
import { imageHost, type ImageHost } from "./live-preview-image";
import { readingView } from "./reading-view";

/** What a hover over a link shows. */
export type LinkPreview =
  | {
      path: NotePath;
      title: string;
      /** The heading the link points to, as written in the note. */
      heading: string | null;
      /**
       * The Markdown of the note without its frontmatter, or the section
       * of the heading the link points to, cut short (`previewMarkdown`).
       */
      markdown: string;
    }
  /** The link points to no note; following it creates one, if it can. */
  | {
      path: null;
      /** False for a link no note is made for, such as `[[file.pdf]]`. */
      canCreate: boolean;
    };

/** Lines of the note a preview shows at most. */
const PREVIEW_LINES = 80;
/** Characters of the note a preview shows at most. */
const PREVIEW_CHARS = 6000;

/**
 * Resting the mouse on a link to a note shows that note as reading mode
 * does: its title, then its text drawn by live preview, read-only, from
 * the section of the heading if the link points to one. A long note
 * scrolls in the box.
 * A link to a missing note says that a click creates it.
 */
export const linkPreview = [
  hoverTooltip(
    async (view, pos) => {
      const host = view.state.facet(linkHost);
      if (host === null) return null;
      const link = linkAt(view.state, pos, host.current);
      if (link === null || link.target === "") return null;
      // An embed shows the note in place already (`embedPreview`).
      if (view.state.sliceDoc(link.start - 1, link.start) === "!") return null;
      const preview = await host.preview(link).catch(() => null);
      if (preview === null) return null;
      const images = view.state.facet(imageHost);
      return {
        pos: link.start,
        end: link.end,
        above: true,
        create: () => previewView(preview, images),
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
      display: "flex",
      flexDirection: "column",
      width: "480px",
      maxWidth: "calc(100vw - 32px)",
      maxHeight: "min(420px, 60vh)",
      overflow: "hidden",
      boxSizing: "border-box",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "6px",
      backgroundColor: "var(--cb-panel)",
      color: "var(--cb-fg)",
      fontFamily: "var(--font-sans)",
      fontSize: "13px",
      lineHeight: "1.5",
    },
    ".cm-link-preview-missing": {
      width: "auto",
      maxWidth: "360px",
      padding: "8px 12px",
    },
    // The name of the note is a bar of its own above its text: it is not
    // part of the note, and stays in place while the text scrolls.
    ".cm-link-preview-title": {
      flexShrink: "0",
      padding: "7px 14px",
      borderBottom: "1px solid var(--cb-line)",
      color: "var(--cb-muted)",
      fontSize: "12px",
      fontWeight: "600",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    ".cm-link-preview-body": {
      minHeight: "0",
      overflowY: "auto",
      overscrollBehavior: "contain",
      padding: "10px 14px 12px",
    },
    ".cm-link-preview-empty": { color: "var(--cb-faint)" },
    // The note inside, smaller than in its tab: all its sizes follow the
    // note size (`noteSize`).
    ".cm-link-preview .cm-editor": { "--cb-note-size": "13px" },
  }),
];

/**
 * The Markdown a preview shows: its first lines, cut at the end of a line.
 * What is left out is marked by "…" on a line of its own.
 */
export function previewMarkdown(text: string): string {
  const lines = text.split("\n");
  let kept = lines.slice(0, PREVIEW_LINES).join("\n");
  if (kept.length > PREVIEW_CHARS) {
    const end = kept.lastIndexOf("\n", PREVIEW_CHARS);
    kept = kept.slice(0, end > 0 ? end : PREVIEW_CHARS);
  }
  kept = kept.trimEnd();
  return kept.length < text.trimEnd().length ? `${kept}\n\n…` : kept;
}

/** The link to preview: only what the host needs to find the note. */
export type PreviewedLink = Pick<Link, "kind" | "target" | "fragment">;

/**
 * The box of a preview. A note is shown by an editor of its own, made as
 * the one of a tab in reading mode (`readingView`).
 */
function previewView(
  preview: LinkPreview,
  images: ImageHost | null,
): { dom: HTMLElement; destroy?: () => void } {
  const box = document.createElement("div");
  box.className = "cm-link-preview";
  if (preview.path === null) {
    box.textContent = preview.canCreate
      ? t("linkPreview.missing")
      : t("linkPreview.notNote");
    box.classList.add("cm-link-preview-missing", "cm-link-preview-empty");
    return { dom: box };
  }
  const title = document.createElement("div");
  title.className = "cm-link-preview-title";
  title.textContent = preview.title;
  title.title = preview.path;
  const body = document.createElement("div");
  body.className = "cm-link-preview-body";
  box.append(title, body);
  if (preview.markdown.trim() === "") {
    body.classList.add("cm-link-preview-empty");
    body.textContent = t("linkPreview.empty");
    return { dom: box };
  }
  const note = readingView(body, preview.markdown, images);
  return { dom: box, destroy: () => note.destroy() };
}
