#!/usr/bin/env node
/**
 * The single headless gate for design-system consistency.
 *
 *   1. lint    — @google/design.md validates DESIGN.md (refs, contrast, order)
 *   2. drift   — src/generated/design.tokens.css matches DESIGN.md
 *   3. guard   — no hardcoded design values anywhere in src/
 *
 * Exit 1 on any failure. Used by `npm run design:check` and by the Vite
 * plugin at dev-server start.
 */
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sync } from "./sync.mjs";
import { guard } from "./guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(root, "node_modules/.bin/designmd");

export function check({ fix = true, quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);
  const problems = [];

  // 1. lint DESIGN.md
  let report = { summary: { errors: 0, warnings: 0, infos: 0 }, findings: [] };
  try {
    report = JSON.parse(execFileSync(cli, ["lint", join(root, "DESIGN.md")], { encoding: "utf8" }));
  } catch (error) {
    if (error.stdout) {
      report = JSON.parse(error.stdout);
    } else {
      problems.push(`lint failed: ${error.message}`);
    }
  }
  for (const f of report.findings ?? []) {
    if (f.severity === "error") problems.push(`DESIGN.md [${f.rule}] ${f.message}`);
    else if (!quiet) log(`design: ${f.severity} [${f.rule}] ${f.message}`);
  }

  // 2. token drift
  try {
    const { changed } = sync({ check: !fix });
    if (changed) log("design: regenerated src/generated/design.tokens.css");
  } catch (error) {
    problems.push(error.message);
  }

  // 3. hardcoded values
  const violations = guard();
  for (const v of violations) problems.push(`${v.file}:${v.line} [${v.rule}] ${v.match} — ${v.message}`);

  return { problems, report, violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fix = !process.argv.includes("--ci");
  const { problems } = check({ fix });
  if (problems.length === 0) {
    console.log("design: system consistent (DESIGN.md ✓ tokens ✓ usage ✓)");
  } else {
    for (const p of problems) console.error(`design: ${p}`);
    process.exit(1);
  }
}
