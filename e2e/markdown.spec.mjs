// Needs a dashboard with this plugin enabled and a task whose comments contain
// the markdown in README ("Testing"). HERMES_TASK defaults to the sandbox task.
import { test, expect } from "@playwright/test";

const TASK = process.env.HERMES_TASK || "t_3873db8c";

test.beforeEach(async ({ page }) => {
  await page.goto("/kanban");
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  await page.locator('[data-testid="kmd-root"]').first().waitFor();
  await page.locator('[data-testid="kmd-nav"]').waitFor();
  await page.waitForTimeout(900); // the drawer re-renders once more as its data finishes loading; let it settle
});

test("numbered list, blockquote and table are rendered", async ({ page }) => {
  const c = page.locator(".hermes-kanban-drawer");
  await expect(c.locator(".kmd-root ol li").first()).toBeVisible();
  await expect(c.locator(".kmd-root blockquote").first()).toBeVisible();
  await expect(c.locator(".kmd-root table th").first()).toBeVisible();
});

test("code block has language label, highlighting, and preserved indentation", async ({ page }) => {
  const block = page.locator('[data-testid="kmd-code"]').filter({ has: page.locator('[data-testid="kmd-lang"]', { hasText: /^json$/ }) }).first();
  await expect(block.locator('[data-testid="kmd-lang"]')).toHaveText("json");
  await expect(block.locator('[class*="hljs-"]').first()).toBeVisible();
  const text = await block.locator("pre code").innerText();
  expect(text).not.toMatch(/^json/);
  expect(text).toMatch(/\n {2}"task"/);
  expect(await block.locator("pre code").evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("pre");
});

test("copy button copies the code text", async ({ page }) => {
  const block = page.locator('[data-testid="kmd-code"]').filter({ has: page.locator('[data-testid="kmd-lang"]', { hasText: /^json$/ }) }).first();
  const expected = await block.locator("pre code").innerText();
  await block.locator('[data-testid="kmd-copy"]').click();
  await expect(block.locator('[data-testid="kmd-copy"]')).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect(block.locator('[data-testid="kmd-copy"]')).toHaveText("Copy", { timeout: 4000 });
});

test("no script or injected elements from markdown source", async ({ page }) => {
  expect(await page.locator(".hermes-kanban-drawer .kmd-root script, .hermes-kanban-drawer .kmd-root img, .hermes-kanban-drawer .kmd-root iframe").count()).toBe(0);
});

test("sections are visually separated cards", async ({ page }) => {
  const secs = page.locator(".hermes-kanban-drawer-body > .hermes-kanban-section");
  expect(await secs.count()).toBeGreaterThan(2);
  const bw = await secs.first().evaluate((e) => getComputedStyle(e).borderTopWidth);
  expect(parseFloat(bw)).toBeGreaterThan(0);
});

test("a re-render by the dashboard is upgraded again", async ({ page }) => {
  await page.locator(".hermes-kanban-md").first().evaluate((e) => { e.innerHTML = "<p>reset by app</p>"; });
  await expect(page.locator('[data-testid="kmd-root"]').first()).toBeVisible();
});

// Needs a comment containing a fenced block longer than the max height (60+ lines).
test("tall code blocks are height-capped, scroll, and can be expanded", async ({ page }) => {
  const tall = page.locator('[data-testid="kmd-code"]').filter({ hasText: "value_59" }).first();
  const pre = tall.locator("pre");
  const before = await pre.evaluate((e) => e.clientHeight);
  expect(before).toBeLessThan(420);
  expect(await pre.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  const btn = tall.locator('[data-testid="kmd-expand"]');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(btn).toHaveText("Collapse");
  expect(await pre.evaluate((e) => e.clientHeight)).toBeGreaterThan(before);
  await btn.click();
  expect(await pre.evaluate((e) => e.clientHeight)).toBe(before);
  // short blocks never show the button
  const short = page.locator('[data-testid="kmd-code"]').filter({ hasNotText: "value_59" }).first();
  await expect(short.locator('[data-testid="kmd-expand"]')).toBeHidden();
});

test("clicking a section header collapses it and the choice survives a reload", async ({ page }) => {
  const sec = page.locator('[data-testid="kmd-section"][data-kmd-section="attachments"]');
  const body = sec.locator(".hermes-kanban-attachment-link").first();
  await expect(body).toBeVisible();
  await sec.locator('[data-testid="kmd-section-head"]').click();
  await expect(sec).toHaveAttribute("data-kmd-collapsed", "");
  await expect(body).toBeHidden();
  await page.reload();
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  await expect(page.locator('[data-kmd-section="attachments"]')).toHaveAttribute("data-kmd-collapsed", "");
  await page.locator('[data-kmd-section="attachments"] [data-testid="kmd-section-head"]').click();
  await expect(page.locator('[data-kmd-section="attachments"]')).not.toHaveAttribute("data-kmd-collapsed", "");
});

test("buttons inside a section header don't toggle it", async ({ page }) => {
  const toggle = page.locator('[data-testid="kmd-section"][data-kmd-section="comments"] [data-testid="kco-toggle"]');
  if (!(await toggle.count())) test.skip(true, "comment-order plugin not installed");
  await toggle.click();
  await expect(page.locator('[data-kmd-section="comments"]')).not.toHaveAttribute("data-kmd-collapsed", "");
  await toggle.click(); // restore
});

test("section navigator jumps to a section, opens it if collapsed, and toggles all", async ({ page }) => {
  const nav = page.locator('[data-testid="kmd-nav"]');
  await expect(nav).toBeVisible();
  const all = nav.locator('[data-testid="kmd-toggle-all"]');
  await expect(all).toHaveAttribute("aria-label", "Collapse all");
  await all.click();
  await expect(all).toHaveAttribute("aria-label", "Expand all");
  expect(await page.locator('[data-testid="kmd-section"][data-kmd-collapsed]').count()).toBe(await page.locator('[data-testid="kmd-section"]').count());
  await nav.locator('[data-testid="kmd-nav-item"]', { hasText: /^comments/i }).click();
  const comments = page.locator('[data-kmd-section="comments"]');
  await expect(comments).not.toHaveAttribute("data-kmd-collapsed", "");
  await expect(comments).toBeInViewport();
  await expect(all).toHaveAttribute("aria-label", "Collapse all"); // no longer all collapsed
  await all.click(); await all.click();
  expect(await page.locator('[data-testid="kmd-section"][data-kmd-collapsed]').count()).toBe(0);
});

test("navigator is a single compact row and highlights the current section", async ({ page }) => {
  const nav = page.locator('[data-testid="kmd-nav"]');
  const h = await nav.evaluate((e) => e.getBoundingClientRect().height);
  expect(h).toBeLessThan(64); // one row, not a wrapped block
  // sits between the drawer header and the body, on the drawer surface (not a sticky overlay)
  expect(await nav.evaluate((e) => e.nextElementSibling.classList.contains("hermes-kanban-drawer-body") && getComputedStyle(e).position === "static" && getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)")).toBe(true);
  await nav.locator('[data-testid="kmd-nav-item"]', { hasText: /^comments/i }).click();
  await expect(nav.locator('[data-kmd-for="comments"]')).toHaveAttribute("aria-current", "true", { timeout: 4000 });
});

test("worker log opens at its latest line and has top / end buttons", async ({ page }) => {
  const log = page.locator('[data-testid="kmd-log"]');
  test.skip(!(await log.count()), "task has no worker log");
  const pos = () => log.evaluate((e) => ({ top: e.scrollTop, max: e.scrollHeight - e.clientHeight }));
  await expect.poll(async () => { const p = await pos(); return p.max > 0 && p.top >= p.max - 1; }).toBe(true);
  expect(await log.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await page.locator('[data-testid="kmd-log-top"]').click();
  await expect.poll(async () => (await pos()).top).toBeLessThan(2);
  await page.locator('[data-testid="kmd-log-bottom"]').click();
  await expect.poll(async () => { const p = await pos(); return p.top >= p.max - 1; }).toBe(true);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  test("nav stays one short row, scrolls sideways, and tapping a chip reaches the section", async ({ page }) => {
    await page.goto("/kanban");
    await page.locator('[data-task-id="' + TASK + '"]').first().tap();
    const nav = page.locator('[data-testid="kmd-nav"]');
    await nav.waitFor();
    const box = await nav.locator('[data-testid="kmd-nav-scroll"]').evaluate((e) => ({ h: e.parentElement.getBoundingClientRect().height, sw: e.scrollWidth, cw: e.clientWidth }));
    expect(box.h).toBeLessThan(64);
    expect(box.sw).toBeGreaterThan(box.cw); // overflows horizontally instead of wrapping
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const chip = nav.locator('[data-testid="kmd-nav-item"]', { hasText: /^comments/i });
    expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(36); // touch-sized
    await chip.tap();
    await expect(page.locator('[data-kmd-section="comments"]')).toBeInViewport();
  });
  test("folding the last sections at the bottom of the flyout keeps the header under the finger", async ({ page }) => {
    await page.goto("/kanban");
    await page.locator('[data-task-id="' + TASK + '"]').first().tap();
    await page.locator('[data-testid="kmd-nav"]').waitFor();
    await page.waitForTimeout(900);
    await page.evaluate(() => { const b = document.querySelector(".hermes-kanban-drawer-body"); b.scrollTop = b.scrollHeight; });
    const heads = page.locator('[data-testid="kmd-section"] > [data-testid="kmd-section-head"]');
    const n = await heads.count();
    for (const i of [n - 1, n - 2]) {
      const head = heads.nth(i);
      await head.scrollIntoViewIfNeeded(); // tap would scroll it anyway; measure after that
      const y0 = (await head.boundingBox()).y;
      await head.tap({ position: { x: 24, y: 12 } }); // the title side; the right side holds buttons
      await page.waitForTimeout(250);
      expect(Math.abs((await head.boundingBox()).y - y0)).toBeLessThan(2);
      expect(await head.evaluate((e) => e.parentElement.hasAttribute("data-kmd-collapsed"))).toBe(true);
    }
  });
});

// Long comments are clamped. Needs a task with a ~40-line comment ending in END-OF-LONG-COMMENT plus a short
// "short follow-up comment" (HERMES_LONG_TASK, default: sandbox t_b5ea79f7).
const LONG_TASK = process.env.HERMES_LONG_TASK || "t_b5ea79f7";

test.describe("long comments", () => {
  let host;
  test.beforeEach(async ({ page }) => {
    await page.goto("/kanban");
    await page.locator(`[data-task-id="${LONG_TASK}"]`).first().click();
    host = page.locator(".hermes-kanban-md").filter({ hasText: "END-OF-LONG-COMMENT" });
    await host.locator('[data-testid="kmd-more"]').waitFor();
  });

  test("a long comment is clamped with a Show more button, a short one is not", async ({ page }) => {
    await expect(host.locator('[data-testid="kmd-more"]')).toHaveText(/Show more \(\d+ more lines\)/);
    const long = host.locator(".kmd-root");
    await expect(long).toHaveAttribute("data-kmd-clamp", "closed");
    const h = await long.evaluate((e) => e.getBoundingClientRect().height);
    const lh = await long.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
    expect(h).toBeLessThanOrEqual(lh * 12 + 2);
    const short = page.locator(".hermes-kanban-md").filter({ hasText: "short follow-up comment" });
    await expect(short.locator(".kmd-root")).not.toHaveAttribute("data-kmd-clamp", /.*/);
    await expect(short.locator('[data-testid="kmd-more"]')).toHaveCount(0);
  });

  test("Show more reveals everything and Show less folds it back", async ({ page }) => {
    const more = host.locator('[data-testid="kmd-more"]');
    await more.click();
    await expect(more).toHaveText("Show less");
    await expect(host.locator(".kmd-root")).toHaveAttribute("data-kmd-clamp", "open");
    await expect(host.getByText("END-OF-LONG-COMMENT")).toBeVisible();
    await page.waitForTimeout(700); // survives the drawer's periodic re-render
    await expect(more).toHaveText("Show less");
    await more.click();
    await expect(host.locator(".kmd-root")).toHaveAttribute("data-kmd-clamp", "closed");
    await expect(more).toHaveText(/Show more/);
  });

  test("works at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const more = host.locator('[data-testid="kmd-more"]');
    await more.scrollIntoViewIfNeeded();
    await more.click();
    await expect(more).toHaveText("Show less");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
});

test("worker log wraps long lines instead of scrolling sideways", async ({ page }) => {
  await page.goto("/kanban");
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  const log = page.locator('[data-testid="kmd-log"]').first();
  await log.waitFor();
  expect(await log.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("pre-wrap");
  expect(await log.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
});
