// Markdown -> HTML string. Pure (no DOM) so it can be unit-tested in node.
//
// Safety model: raw HTML in the source is escaped, never passed through; link
// targets are limited to http/https/mailto; images are shown as links so
// nothing is fetched automatically. Every other string comes from marked's own
// escaping or highlight.js output.
import { Marked } from "marked";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGS = { bash, css, diff, go, ini, java, javascript, json, markdown, php, python, ruby, rust, sql, typescript, xml, yaml };
for (const [name, def] of Object.entries(LANGS)) hljs.registerLanguage(name, def);
const ALIASES = { sh: "bash", shell: "bash", zsh: "bash", js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", yml: "yaml", html: "xml", toml: "ini", md: "markdown", rb: "ruby", golang: "go", patch: "diff", jsonc: "json" };
for (const [alias, target] of Object.entries(ALIASES)) {
  hljs.registerAliases(alias, { languageName: target });
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeHref(href) {
  const h = String(href || "").trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

function highlight(text, lang) {
  const l = (lang || "").toLowerCase();
  if (l && hljs.getLanguage(l)) {
    try { return hljs.highlight(text, { language: l, ignoreIllegals: true }).value; } catch (_e) { /* fall through */ }
  }
  return escapeHtml(text);
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Raw HTML (block or inline) is shown as literal text.
    html(token) { return escapeHtml(token.text != null ? token.text : token.raw); },
    code(token) {
      const lang = ((token.lang || "").trim().split(/\s+/)[0] || "").replace(/[^\w+#.-]/g, "");
      const label = lang || "text";
      const body = highlight(token.text, lang);
      return (
        '<div class="kmd-code" data-testid="kmd-code">' +
        '<div class="kmd-code-head"><span class="kmd-lang" data-testid="kmd-lang">' + escapeHtml(label) + "</span>" +
        '<span class="kmd-actions"><button type="button" class="kmd-expand" data-testid="kmd-expand" hidden>Expand</button>' +
        '<button type="button" class="kmd-copy" data-testid="kmd-copy" title="Copy code">Copy</button></span></div>' +
        '<pre><code class="hljs">' + body + "</code></pre></div>"
      );
    },
    codespan(token) { return '<code class="kmd-inline">' + escapeHtml(token.text) + "</code>"; },
    link(token) {
      const inner = this.parser.parseInline(token.tokens);
      const href = safeHref(token.href);
      if (!href) return inner;
      const title = token.title ? ' title="' + escapeHtml(token.title) + '"' : "";
      return '<a href="' + escapeHtml(href) + '"' + title + ' target="_blank" rel="noopener noreferrer">' + inner + "</a>";
    },
    image(token) {
      const alt = escapeHtml(token.text || token.href || "image");
      const href = safeHref(token.href);
      if (!href) return alt;
      return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">[image: ' + alt + "]</a>";
    },
    table(token) {
      const cell = (c, tag) => {
        const al = c.align ? ' style="text-align:' + (c.align === "center" || c.align === "right" ? c.align : "left") + '"' : "";
        return "<" + tag + al + ">" + this.parser.parseInline(c.tokens) + "</" + tag + ">";
      };
      const head = "<tr>" + token.header.map((c) => cell(c, "th")).join("") + "</tr>";
      const rows = token.rows.map((r) => "<tr>" + r.map((c) => cell(c, "td")).join("") + "</tr>").join("");
      return '<div class="kmd-table-wrap"><table><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>";
    },
  },
});

export function renderMarkdown(src) {
  return marked.parse(String(src == null ? "" : src), { async: false });
}
