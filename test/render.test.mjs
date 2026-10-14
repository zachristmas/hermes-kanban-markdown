import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, safeHref } from "../src/render.js";

const r = renderMarkdown;

test("raw html is escaped, never emitted", () => {
  for (const p of ["<script>alert(1)</script>", '<img src=x onerror="alert(1)">', "<iframe src=//evil></iframe>", "text <b onclick=x>y</b>"]) {
    const out = r(p);
    assert.ok(!/<(script|img|iframe|b)[\s>]/i.test(out), out);
    assert.ok(out.includes("&lt;"), out);
  }
});

test("dangerous link and image schemes are dropped", () => {
  assert.ok(!/href="javascript/i.test(r("[x](javascript:alert(1))")));
  assert.ok(!/href="\s*data:/i.test(r("[x](data:text/html,<script>1</script>)")));
  assert.ok(!/<img/i.test(r("![x](javascript:alert(1))")));
  assert.ok(!/<img/i.test(r("![x](https://evil.example/a.png)")), "images are never auto-fetched");
  assert.ok(!/href="vbscript/i.test(r("[x](vbscript:1)")));
});

test("safe links open in a new tab with noopener", () => {
  const out = r("[a](https://example.com/x?a=1&b=2)");
  assert.match(out, /href="https:\/\/example\.com\/x\?a=1&amp;b=2"/);
  assert.match(out, /target="_blank" rel="noopener noreferrer"/);
  assert.ok(safeHref("mailto:a@b.co"));
  assert.equal(safeHref("//evil.example"), null);
});

test("attribute injection through link title and fenced language is escaped", () => {
  const t = r('[a](https://e.com "x\\" onmouseover=\\"alert(1)")');
  assert.ok(!/ onmouseover=/.test(t.replace(/&quot;/g, "")) || t.includes("&quot;"));
  const c = r('```js"><script>alert(1)</script>\ncode\n```');
  assert.ok(!/<script/i.test(c), c);
});

test("numbered lists, nested lists, blockquote, hr, task list, strikethrough", () => {
  assert.match(r("1. one\n2. two"), /<ol>[\s\S]*<li>[\s\S]*one[\s\S]*<\/ol>/);
  assert.match(r("- a\n  - b"), /<ul>[\s\S]*<ul>/);
  assert.match(r("> quoted"), /<blockquote>/);
  assert.match(r("a\n\n---\n\nb"), /<hr/);
  assert.match(r("- [x] done\n- [ ] todo"), /type="checkbox"/);
  assert.match(r("~~gone~~"), /<del>gone<\/del>/);
});

test("tables render with a wrapper and escaped cells", () => {
  const out = r("| a | b |\n|---|:-:|\n| <i>1</i> | 2 |");
  assert.match(out, /<div class="kmd-table-wrap"><table>/);
  assert.match(out, /<th>a<\/th>/);
  assert.match(out, /text-align:center/);
  assert.ok(!/<i>/.test(out));
});

test("fenced code: language label, highlighting, indentation preserved, no lang line leaked", () => {
  const out = r('```json\n{\n  "a": 1,\n    "b": [true]\n}\n```');
  assert.match(out, /data-testid="kmd-lang">json</);
  assert.match(out, /hljs-attr/);
  assert.ok(out.includes('\n  <span class="hljs-attr">') || out.includes("\n  "), "indentation kept");
  assert.ok(!/>json\s*\n\s*\{/.test(out), "language tag is not part of the code");
  assert.match(out, /data-testid="kmd-copy"/);
});

test("aliases and unknown languages", () => {
  assert.match(r("```py\nprint(1)\n```"), /hljs-built_in|hljs-title|hljs-keyword|hljs-number/);
  const u = r("```nosuchlang\n<b>x</b>\n```");
  assert.match(u, /data-testid="kmd-lang">nosuchlang</);
  assert.ok(u.includes("&lt;b&gt;x&lt;/b&gt;"));
  const none = r("```\nplain\n```");
  assert.match(none, />text</);
});

test("inline code is escaped and empty input is safe", () => {
  assert.match(r("use `<div>`"), /<code class="kmd-inline">&lt;div&gt;<\/code>/);
  assert.equal(r(""), "");
  assert.equal(r(null), "");
});
