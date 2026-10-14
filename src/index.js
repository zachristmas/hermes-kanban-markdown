// kanban-markdown: full markdown rendering for the kanban task drawer.
//
// The built-in drawer renders markdown with a tiny regex renderer. This finds
// each rendered block, reads its markdown source from the React props that
// produced it, and swaps in a complete render. If the source can't be found the
// built-in rendering is left alone.
import { renderMarkdown } from "./render.js";

const MD = ".hermes-kanban-drawer .hermes-kanban-md";

function sourceOf(el) {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  if (!key) return null;
  let f = el[key];
  for (let i = 0; i < 4 && f; i++) {
    f = f.return;
    const p = f && f.memoizedProps;
    if (p && typeof p.source === "string") return p.source;
  }
  return null;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0) + ":" + s.length;
}

function upgrade(el) {
  const src = sourceOf(el);
  if (src == null) return;
  const h = hash(src);
  const cur = el.firstElementChild;
  if (cur && cur.classList.contains("kmd-root") && cur.getAttribute("data-kmd-hash") === h) return;
  let html;
  try { html = renderMarkdown(src); } catch (_e) { return; } // keep built-in output
  const root = document.createElement("div");
  root.className = "kmd-root";
  root.setAttribute("data-kmd-hash", h);
  root.setAttribute("data-testid", "kmd-root");
  root.innerHTML = html;
  el.replaceChildren(root);
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy") ? resolve() : reject(new Error("copy failed")); } catch (e) { reject(e); }
    ta.remove();
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target instanceof Element ? e.target.closest(".kmd-copy") : null;
  if (!btn) return;
  e.stopPropagation();
  const code = btn.closest(".kmd-code")?.querySelector("pre code");
  if (!code) return;
  copyText(code.textContent || "").then(
    () => flash(btn, "Copied"),
    () => flash(btn, "Copy failed"),
  );
}, true);

function flash(btn, text) {
  btn.textContent = text;
  clearTimeout(btn._kmdT);
  btn._kmdT = setTimeout(() => { btn.textContent = "Copy"; }, 1500);
}

// Pick the code palette from the actual page background so every dashboard
// theme gets readable colors.
function syncTheme() {
  const drawer = document.querySelector(".hermes-kanban-drawer");
  const bg = getComputedStyle(drawer || document.body).backgroundColor;
  const m = bg.match(/[\d.]+/g);
  if (!m || m.length < 3) return;
  const [r, g, b] = m.map(Number);
  const a = m.length > 3 ? Number(m[3]) : 1;
  let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (a === 0) return;
  const mode = lum < 140 ? "dark" : "light";
  const root = document.documentElement;
  if (root.getAttribute("data-kmd-theme") !== mode) root.setAttribute("data-kmd-theme", mode);
}

let scheduled = false;
function run() {
  scheduled = false;
  document.querySelectorAll(MD).forEach(upgrade);
  syncTheme();
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(run);
}

new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-theme"] });
schedule();

window.__HERMES_PLUGINS__.register("kanban-markdown", () => null);
