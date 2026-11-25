// Points the download buttons at the files of the latest release and puts
// its version on the page. Without it, or if GitHub does not answer, the
// buttons lead to the page of the latest release, which works as well.

const REPO = "hexlabelposition/carbon";

interface Release {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

function detectOs(): "linux" | "windows" | null {
  const agent = navigator.userAgent;
  if (/windows/i.test(agent)) return "windows";
  if (/linux|x11/i.test(agent) && !/android/i.test(agent)) return "linux";
  return null;
}

const os = detectOs();
if (os) {
  document
    .querySelector(`[data-os="${os}"]`)
    ?.classList.add("border-line-strong", "bg-panel");
  const primary = document.querySelector("[data-primary]");
  if (primary) {
    primary.textContent = `Download for ${os === "linux" ? "Linux" : "Windows"}`;
  }
}

async function showLatestRelease(): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
  );
  if (!response.ok) return;
  const release = (await response.json()) as Release;
  const version = release.tag_name.replace(/^v/, "");

  for (const el of document.querySelectorAll("[data-version]")) {
    el.textContent = `Version ${version}`;
  }
  for (const el of document.querySelectorAll("[data-version-long]")) {
    el.textContent = `Carbon ${version}`;
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    "[data-asset]",
  )) {
    const suffix = link.dataset.asset ?? "";
    const asset = release.assets.find((a) => a.name.endsWith(suffix));
    if (asset) link.href = asset.browser_download_url;
  }
}

showLatestRelease().catch(() => {});
