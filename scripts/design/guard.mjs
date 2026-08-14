#!/usr/bin/env node
/**
 * Design-system consistency guard.
 *
 * Fails the check when application code hardcodes a design value instead of
 * consuming a DESIGN.md token. Runs headlessly in dev (via the Vite plugin)
 * and in `npm run design:check`.
 *
 * Escape hatch: put `design-allow` in a comment on the offending line.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scanRoots = ["src"];
const SKIP_DIRS = new Set(["generated", "ui", "node_modules", ".git"]);
const EXT = /\.(tsx|ts|css)$/;

const RULES = [
  {
    id: "no-absolute-colors",
    re: /\b(?:bg|text|border|fill|stroke|ring|from|via|to)-(?:white|black)\b/g,
    message: "absolute color utility — use a semantic token (bg-surface, text-foreground, …)",
  },
  {
    id: "no-arbitrary-colors",
    re: /\b(?:bg|text|border|fill|stroke|ring|shadow)-\[(?:#|rgb|hsl|oklch)[^\]]*\]/g,
    message: "arbitrary color value — add it to DESIGN.md and use the generated token",
  },
  {
    id: "no-raw-hex",
    re: /(?<!srcDoc[^\n]{0,400})#[0-9a-fA-F]{6}\b/g,
    message: "raw hex literal — colors live in DESIGN.md only",
  },
  {
    id: "no-tailwind-palette",
    re: /\b(?:bg|text|border|ring|fill)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    message: "stock Tailwind palette class — use a DESIGN.md token",
  },
  {
    id: "no-inline-font-family",
    re: /fontFamily\s*:\s*["'`]/g,
    message: "inline font-family — use font-sans / font-mono from the token layer",
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      yield* walk(full);
    } else if (EXT.test(entry)) {
      yield full;
    }
  }
}

export function guard() {
  const violations = [];
  for (const scanRoot of scanRoots) {
    for (const file of walk(join(root, scanRoot))) {
      const rel = relative(root, file);
      if (rel.endsWith("src/styles.css")) continue; // the token bridge lives here
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.includes("design-allow")) return;
        for (const rule of RULES) {
          rule.re.lastIndex = 0;
          const match = rule.re.exec(line);
          if (match) violations.push({ file: rel, line: i + 1, rule: rule.id, match: match[0], message: rule.message });
        }
      });
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = guard();
  if (violations.length === 0) {
    console.log("design: no hardcoded design values found");
  } else {
    for (const v of violations) console.error(`${v.file}:${v.line}  [${v.rule}] ${v.match} — ${v.message}`);
    console.error(`design: ${violations.length} violation(s)`);
    process.exit(1);
  }
}
