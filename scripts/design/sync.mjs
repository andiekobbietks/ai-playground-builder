#!/usr/bin/env node
/**
 * DESIGN.md -> Tailwind v4 theme.
 *
 * Reads the canonical DESIGN.md at the repo root, runs the @google/design.md
 * `export --format css-tailwind` emitter, and writes the result to
 * src/generated/design.tokens.css, which src/styles.css imports.
 *
 * The generated file is the ONLY place raw design values may appear in the
 * app. Everything else consumes them as Tailwind utilities.
 *
 *   node scripts/design/sync.mjs            # write the file
 *   node scripts/design/sync.mjs --check    # fail if the file is out of date
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(root, "DESIGN.md");
const target = join(root, "src/generated/design.tokens.css");
const cli = join(root, "node_modules/.bin/designmd");

const HEADER = `/* ------------------------------------------------------------------------
 * GENERATED FILE — DO NOT EDIT.
 * Source: DESIGN.md (root)   Emitter: @google/design.md export css-tailwind
 * Regenerate: npm run design:sync
 * ---------------------------------------------------------------------- */
`;

export function emit() {
  if (!existsSync(cli)) throw new Error("@google/design.md is not installed (node_modules/.bin/designmd missing)");
  const css = execFileSync(cli, ["export", "--format", "css-tailwind", source], {
    encoding: "utf8",
  });
  return HEADER + css.trimEnd() + "\n";
}

export function sync({ check = false } = {}) {
  const next = emit();
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (current === next) return { changed: false, target };
  if (check) {
    const err = new Error("src/generated/design.tokens.css is out of date with DESIGN.md — run: npm run design:sync");
    err.code = "DESIGN_DRIFT";
    throw err;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, next);
  return { changed: true, target };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { changed } = sync({ check: process.argv.includes("--check") });
    console.log(changed ? "design: tokens regenerated from DESIGN.md" : "design: tokens already in sync");
  } catch (error) {
    console.error(`design: ${error.message}`);
    process.exit(1);
  }
}
