// Needs a dashboard with this plugin enabled and a task whose comments contain
// the markdown in README ("Testing"). HERMES_TASK defaults to the sandbox task.
import { test, expect } from "@playwright/test";

const TASK = process.env.HERMES_TASK || "t_3873db8c";

test.beforeEach(async ({ page }) => {
  await page.goto("/kanban");
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  await page.locator('[data-testid="kmd-root"]').first().waitFor();
});

test("numbered list, blockquote and table are rendered", async ({ page }) => {
  const c = page.locator(".hermes-kanban-drawer");
  await expect(c.locator(".kmd-root ol li").first()).toBeVisible();
  await expect(c.locator(".kmd-root blockquote").first()).toBeVisible();
  await expect(c.locator(".kmd-root table th").first()).toBeVisible();
});

test("code block has language label, highlighting, and preserved indentation", async ({ page }) => {
  const block = page.locator('[data-testid="kmd-code"]').first();
  await expect(block.locator('[data-testid="kmd-lang"]')).toHaveText("json");
  await expect(block.locator('[class*="hljs-"]').first()).toBeVisible();
  const text = await block.locator("pre code").innerText();
  expect(text).not.toMatch(/^json/);
  expect(text).toMatch(/\n {2}"task"/);
  expect(await block.locator("pre code").evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("pre");
});

test("copy button copies the code text", async ({ page }) => {
  const block = page.locator('[data-testid="kmd-code"]').first();
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
