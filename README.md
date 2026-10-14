# hermes-kanban-markdown

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Full markdown rendering and clearer sections for the [Hermes Agent](https://github.com/NousResearch/hermes-agent) kanban task drawer.

The built-in drawer renders markdown with a small regex renderer: no numbered lists, tables or blockquotes, the language tag of a fenced block shows up as code, and there is no highlighting or copy button. Every section also runs into the next one. This plugin fixes both.

### Before and after

Same task, same data. Left is the stock drawer, right is with this plugin.

<table>
<tr><th align="center">Stock drawer</th><th align="center">With kanban-markdown</th></tr>
<tr>
<td><img src="docs/before-top.png" alt="Stock drawer: description with raw markdown, sections running together" width="400"></td>
<td><img src="docs/after-top.png" alt="With the plugin: numbered lists, checkboxes, a table, section cards and a section navigator" width="400"></td>
</tr>
<tr>
<td><img src="docs/before-comment.png" alt="Stock drawer: comment with code shown as plain text" width="400"></td>
<td><img src="docs/after-comment.png" alt="With the plugin: highlighted code blocks with language labels and Copy buttons" width="400"></td>
</tr>
</table>

### Collapse sections and jump between them

Click any section header to fold it (remembered per browser). The bar at the top jumps straight to a section and opens it if it was folded.

<img src="docs/nav-collapsed.png" alt="Dependencies and Attachments collapsed, navigator bar pinned to the top of the drawer" width="420">

## Features

- Full GFM: headings, nested and numbered lists, task lists, blockquotes, tables, horizontal rules, strikethrough, links.
- Code blocks with a language label, syntax highlighting (bash, css, diff, go, ini/toml, java, js/ts, json, markdown, php, python, ruby, rust, sql, xml/html, yaml), preserved indentation, horizontal scroll, and a **Copy** button.
- Code uses an embedded JetBrains Mono; prose keeps your dashboard font. No external requests.
- Palette follows the active dashboard theme (dark or light is detected from the real background).
- Each drawer section (Description, Dependencies, Attachments, Result, Comments, ...) is a bordered card with its own header band, and comments are divided from each other.
- Code blocks are capped at a reasonable height (22rem) and scroll; an **Expand** button appears only on blocks that are actually clipped.
- Click a section header to collapse or expand it (remembered per browser). A sticky bar at the top of the drawer has a chip per section that jumps straight to it (opening it if collapsed), plus **Collapse all / Expand all**.
- Safe by construction: raw HTML in task text is shown as literal text, only http, https and mailto links are active, and images are shown as links (never fetched automatically).
- If the markdown source can't be read, the built-in rendering is left untouched.

## Install

User dashboard plugins must be in `~/.hermes/plugins/` **and** listed in `plugins.enabled` of the active profile.

```bash
git clone https://github.com/zachristmas/hermes-kanban-markdown.git ~/.hermes/plugins/kanban-markdown
hermes plugins enable kanban-markdown
# then restart `hermes dashboard` (plugin discovery is cached per process) and hard-refresh
```

`dashboard/dist/` is committed, so no build step is needed to use it. Uninstall with `hermes plugins disable kanban-markdown` and delete the directory.

## How it works

The drawer has no plugin slots. A `MutationObserver` finds each `.hermes-kanban-md` block, reads the markdown source from the React props of the component that rendered it, and replaces the block with the full render. When the dashboard re-renders a block, the plugin upgrades it again. Section separation is CSS only.

This reads React internals (`__reactFiber$` keys), so a future dashboard refactor could stop the markdown upgrade from applying. In that case the drawer simply falls back to the built-in rendering.

## Development

```bash
npm install
npm run build   # src/ -> dashboard/dist/ (esbuild)
npm test        # node:test unit tests, including XSS payloads
npm run e2e     # Playwright; needs a dashboard with the plugin enabled
```

E2E env: `HERMES_URL` (default `http://127.0.0.1:9229`), `HERMES_TASK` (a task whose comments contain a fenced `json` block, a numbered list, a blockquote and a table), `CHROMIUM_PATH` (optional). Use a throwaway `HERMES_HOME`, not your real one.

## License

MIT. Bundled third-party components are listed in [THIRD_PARTY.md](THIRD_PARTY.md).
