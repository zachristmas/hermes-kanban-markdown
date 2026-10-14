import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dashboard", "dist");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, "src", "index.js")],
  bundle: true, format: "iife", minify: true, target: "es2020", legalComments: "none",
  outfile: join(out, "index.js"),
  banner: { js: "/* kanban-markdown (MIT). Bundles marked (MIT) and highlight.js (BSD-3-Clause); see THIRD_PARTY.md. Source: src/ */" },
});

const font = (w) => "data:font/woff2;base64," + readFileSync(join(root, "node_modules/@fontsource/jetbrains-mono/files", `jetbrains-mono-latin-${w}-normal.woff2`)).toString("base64");
let css = readFileSync(join(root, "src", "style.css"), "utf8");
css = css.replace("__FONT_400__", font(400)).replace("__FONT_700__", font(700));
writeFileSync(join(out, "style.css"), css);
console.log("built", out);
