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
  measureCode(root);
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

function measureCode(root) {
  root.querySelectorAll(".kmd-code").forEach((blk) => {
    const pre = blk.querySelector("pre");
    const btn = blk.querySelector(".kmd-expand");
    if (!pre || !btn || blk.hasAttribute("data-kmd-expanded")) return;
    btn.hidden = !(pre.scrollHeight > pre.clientHeight + 2);
  });
}

document.addEventListener("click", (e) => {
  const exp = e.target instanceof Element ? e.target.closest(".kmd-expand") : null;
  if (exp) {
    e.stopPropagation();
    const blk = exp.closest(".kmd-code");
    const open = blk.toggleAttribute("data-kmd-expanded");
    exp.textContent = open ? "Collapse" : "Expand";
    if (!open) measureCode(blk.parentElement);
    return;
  }
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

// --- collapsible sections + section navigator ---------------------------------
const LS_COLLAPSED = "hermes.kanban.collapsedSections";
const HEAD_SEL = ":scope > .hermes-kanban-section-head, :scope > .hermes-kanban-section-head-row";

function readCollapsed() {
  try { const v = JSON.parse(window.localStorage.getItem(LS_COLLAPSED) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch (_e) { return new Set(); }
}
function writeCollapsed(set) {
  try { window.localStorage.setItem(LS_COLLAPSED, JSON.stringify(Array.from(set))); } catch (_e) { /* ignore */ }
}

function headOf(section) { return section.querySelector(HEAD_SEL); }

function labelOf(head) {
  const c = head.cloneNode(true);
  c.querySelectorAll("button, a, select, input").forEach((n) => n.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
}
// Stable key without counts, so "Comments (3)" and "Comments (4)" are one section.
const keyOf = (label) => label.toLowerCase().replace(/\(.*?\)|\d+/g, "").replace(/\s+/g, " ").trim();

function setCollapsed(section, collapsed) {
  if (collapsed) section.setAttribute("data-kmd-collapsed", ""); else section.removeAttribute("data-kmd-collapsed");
  const head = headOf(section);
  if (head) head.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function persist(section) {
  schedule(); // keeps the nav's Collapse all / Expand all label in step
  const key = section.getAttribute("data-kmd-section");
  if (!key) return;
  const set = readCollapsed();
  if (section.hasAttribute("data-kmd-collapsed")) set.add(key); else set.delete(key);
  writeCollapsed(set);
}

function decorateSections(body) {
  const stored = readCollapsed();
  const items = [];
  body.querySelectorAll(":scope > .hermes-kanban-section").forEach((section) => {
    const head = headOf(section);
    if (!head) return;
    const label = labelOf(head);
    const key = keyOf(label);
    if (!label) return;
    if (!section.hasAttribute("data-kmd-section")) {
      section.setAttribute("data-kmd-section", key);
      section.setAttribute("data-testid", "kmd-section");
      head.setAttribute("data-testid", "kmd-section-head");
      head.setAttribute("tabindex", "0");
      head.setAttribute("title", "Click to collapse or expand");
      setCollapsed(section, stored.has(key));
    }
    if (section.getAttribute("data-kmd-section") !== key) section.setAttribute("data-kmd-section", key);
    items.push({ section, label, key });
  });
  return items;
}

document.addEventListener("click", (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;
  const head = t.closest(".hermes-kanban-drawer .hermes-kanban-section[data-kmd-section] > .hermes-kanban-section-head, .hermes-kanban-drawer .hermes-kanban-section[data-kmd-section] > .hermes-kanban-section-head-row");
  if (!head || t.closest("button, a, select, input, textarea")) return;
  const section = head.parentElement;
  setCollapsed(section, !section.hasAttribute("data-kmd-collapsed"));
  persist(section);
}, true); // capture: the drawer stops click propagation before it reaches document
document.addEventListener("keydown", (e) => {
  if ((e.key !== "Enter" && e.key !== " ") || !(e.target instanceof Element)) return;
  const head = e.target;
  if (!head.matches(".hermes-kanban-section[data-kmd-section] > [data-testid=kmd-section-head]")) return;
  e.preventDefault();
  const section = head.parentElement;
  setCollapsed(section, !section.hasAttribute("data-kmd-collapsed"));
  persist(section);
}, true);

function allCollapsed(items) { return items.every(({ section }) => section.hasAttribute("data-kmd-collapsed")); }

// Two stacked chevrons (collapse) / two spread chevrons (expand); currentColor so every theme works.
const ICON_COLLAPSE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 3.5l4 3.5 4-3.5M4 12.5L8 9l4 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_EXPAND = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 6.5L8 3l4 3.5M4 9.5L8 13l4-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function syncToggleAll(nav, items) {
  const btn = nav.querySelector('[data-testid="kmd-toggle-all"]');
  if (!btn) return;
  const collapsed = allCollapsed(items);
  const label = collapsed ? "Expand all" : "Collapse all";
  if (btn.getAttribute("aria-label") !== label) {
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.setAttribute("data-state", collapsed ? "collapsed" : "expanded");
    btn.innerHTML = collapsed ? ICON_EXPAND : ICON_COLLAPSE;
  }
}

// The nav lives between the drawer header and the scrolling body, so it never overlaps
// (or gets clipped by) anything the dashboard pins to the top of the screen.
function buildNav(body, items) {
  const drawer = body.closest(".hermes-kanban-drawer");
  if (!drawer) return;
  const sig = items.map((i) => i.key + "|" + i.label).join("\n");
  let nav = drawer.querySelector(":scope > .kmd-nav");
  if (!nav || nav.getAttribute("data-kmd-sig") !== sig) {
    if (!nav) {
      nav = document.createElement("div");
      nav.className = "kmd-nav";
      nav.setAttribute("data-testid", "kmd-nav");
      nav.setAttribute("role", "navigation");
      nav.setAttribute("aria-label", "Task sections");
      body.parentElement.insertBefore(nav, body);
    }
    nav.setAttribute("data-kmd-sig", sig);
    nav.replaceChildren();
    const scroller = document.createElement("div");
    scroller.className = "kmd-nav-scroll";
    scroller.setAttribute("data-testid", "kmd-nav-scroll");
    items.forEach(({ section, label, key }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kmd-nav-item";
      b.setAttribute("data-testid", "kmd-nav-item");
      b.setAttribute("data-kmd-for", key);
      const m = label.match(/\((\d+)\)\s*$/);
      const name = document.createElement("span");
      name.textContent = label.replace(/\s*\(.*\)\s*$/, "");
      b.appendChild(name);
      if (m) { const c = document.createElement("span"); c.className = "kmd-nav-count"; c.textContent = m[1]; b.appendChild(c); }
      b.addEventListener("click", () => {
        if (section.hasAttribute("data-kmd-collapsed")) { setCollapsed(section, false); persist(section); }
        section.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      scroller.appendChild(b);
    });
    nav.appendChild(scroller);
    const all = document.createElement("button");
    all.type = "button"; all.className = "kmd-nav-tool"; all.setAttribute("data-testid", "kmd-toggle-all");
    all.addEventListener("click", () => {
      const live = decorateSections(body);
      const collapse = !allCollapsed(live);
      live.forEach(({ section }) => { setCollapsed(section, collapse); persist(section); });
      syncToggleAll(nav, live);
    });
    nav.appendChild(all);
  }
  syncToggleAll(nav, items);
  if (!body.hasAttribute("data-kmd-spy")) {
    body.setAttribute("data-kmd-spy", "");
    let raf = 0;
    body.addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; spy(body); });
    }, { passive: true });
  }
  spy(body);
}

// Mark the tab for the section at the top of the drawer and keep it visible in the tab row.
function spy(body) {
  const drawer = body.closest(".hermes-kanban-drawer");
  const scroller = drawer && drawer.querySelector(":scope > .kmd-nav > .kmd-nav-scroll");
  if (!scroller) return;
  const line = body.getBoundingClientRect().top + 32;
  const secs = body.querySelectorAll(":scope > .hermes-kanban-section[data-kmd-section]");
  let current = secs.length ? secs[0].getAttribute("data-kmd-section") : null; // first tab until you scroll past it
  secs.forEach((sec) => {
    if (sec.getBoundingClientRect().top <= line) current = sec.getAttribute("data-kmd-section");
  });
  scroller.querySelectorAll(".kmd-nav-item").forEach((chip) => {
    const on = chip.getAttribute("data-kmd-for") === current;
    if (on === chip.hasAttribute("aria-current")) return;
    if (!on) { chip.removeAttribute("aria-current"); return; }
    chip.setAttribute("aria-current", "true");
    const sr = scroller.getBoundingClientRect(), cr = chip.getBoundingClientRect();
    if (cr.left < sr.left + 12 || cr.right > sr.right - 12) {
      scroller.scrollTo({ left: Math.max(0, chip.offsetLeft - scroller.clientWidth / 2 + chip.clientWidth / 2), behavior: "smooth" });
    }
  });
}

function decorateDrawer() {
  document.querySelectorAll(".hermes-kanban-drawer .hermes-kanban-drawer-body").forEach((body) => {
    const items = decorateSections(body);
    if (items.length > 1) buildNav(body, items);
    else {
      const stale = body.closest(".hermes-kanban-drawer")?.querySelector(":scope > .kmd-nav");
      if (stale) stale.remove();
    }
  });
}

let scheduled = false;
function run() {
  scheduled = false;
  document.querySelectorAll(MD).forEach(upgrade);
  measureCode(document); // layout can settle after the first render (drawer animation, font load)
  decorateDrawer();
  syncTheme();
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(run);
}

new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-theme"] });
schedule();
window.addEventListener("resize", schedule);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

window.__HERMES_PLUGINS__.register("kanban-markdown", () => null);
