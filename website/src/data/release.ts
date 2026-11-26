// The latest release of Carbon, read from GitHub when the site is built:
// its version and the links to its files go into the page as they are, so
// it needs no script to show them. The Pages workflow builds the site again
// when a release is published. If GitHub does not answer, the page leads
// to the page of the latest release instead.

export const REPO_URL = "https://github.com/hexlabelposition/carbon";
const API_URL =
  "https://api.github.com/repos/hexlabelposition/carbon/releases/latest";

export interface Release {
  /** Such as "0.4.0", or null when GitHub did not answer. */
  version: string | null;
  /** When it was published, as an ISO date. */
  date: string | null;
  /** The link to the file whose name ends with the suffix. */
  file(suffix: string): string;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  assets: { name: string; browser_download_url: string }[];
}

async function fetchRelease(): Promise<GitHubRelease | null> {
  // In CI the token of the workflow keeps it clear of the rate limit.
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return response.ok ? ((await response.json()) as GitHubRelease) : null;
  } catch {
    return null;
  }
}

const latest = await fetchRelease();
if (!latest) console.warn("Could not read the latest release of Carbon.");

export const release: Release = {
  version: latest?.tag_name.replace(/^v/, "") ?? null,
  date: latest?.published_at ?? null,
  file(suffix) {
    const asset = latest?.assets.find((a) => a.name.endsWith(suffix));
    return asset?.browser_download_url ?? `${REPO_URL}/releases/latest`;
  },
};
