// Renders any uncaught JS error directly on the page as a visible banner.
// Exists so errors are visible on mobile devices without needing DevTools.

function showBanner(title: string, detail: string) {
  const existing = document.getElementById("__error_overlay__");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "__error_overlay__";
  el.style.cssText = [
    "position:fixed", "top:0", "left:0", "right:0", "z-index:999999",
    "background:#3a0d0d", "color:#ffd9d9", "font-family:monospace",
    "font-size:12px", "padding:12px 14px", "max-height:60vh", "overflow:auto",
    "white-space:pre-wrap", "border-bottom:3px solid #ff5555",
  ].join(";");
  el.textContent = `⚠ ${title}\n${detail}`;
  document.body.appendChild(el);
}

window.addEventListener("error", (e) => {
  showBanner("Script error", `${e.message}\n${e.filename ?? ""}:${e.lineno ?? ""}:${e.colno ?? ""}\n${e.error?.stack ?? ""}`);
});

window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  showBanner("Unhandled promise rejection", detail);
});
