// Marks the card of the visitor's system in the download section and names
// it on the main button. Nothing else on the page needs a script.

function detectOs(): "linux" | "windows" | null {
  const agent = navigator.userAgent;
  if (/windows/i.test(agent)) return "windows";
  if (/linux|x11/i.test(agent) && !/android/i.test(agent)) return "linux";
  return null;
}

const os = detectOs();
if (os) {
  document.querySelector(`[data-os="${os}"]`)?.setAttribute("data-current", "");
  const primary = document.querySelector("[data-primary-label]");
  if (primary) {
    primary.textContent = `Download for ${os === "linux" ? "Linux" : "Windows"}`;
  }
}
