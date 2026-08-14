/**
 * Headless design-system enforcement, wired into the dev server.
 *
 * - on start: lint DESIGN.md, regenerate the token layer, report drift/usage
 * - on DESIGN.md change: regenerate tokens so the theme hot-reloads
 * - on src/** change: re-run the usage guard and surface violations in the
 *   terminal (warnings only; the build gate is `npm run design:check --ci`)
 */
import { check } from "./check.mjs";
import { guard } from "./guard.mjs";

export function designMdPlugin() {
  let lastSignature = "";

  const report = (label) => {
    const { problems } = check({ fix: true, quiet: true });
    const signature = problems.join("|");
    if (signature === lastSignature) return;
    lastSignature = signature;
    if (problems.length === 0) {
      console.log(`\x1b[32m[design]\x1b[0m ${label}: DESIGN.md ✓ tokens ✓ usage ✓`);
    } else {
      console.log(`\x1b[33m[design]\x1b[0m ${label}: ${problems.length} issue(s)`);
      for (const p of problems.slice(0, 12)) console.log(`  ${p}`);
    }
  };

  return {
    name: "lampforge:design-md",
    apply: "serve",
    configureServer(server) {
      report("boot");
      server.watcher.add("DESIGN.md");
      server.watcher.on("change", (file) => {
        if (file.endsWith("DESIGN.md")) return report("DESIGN.md changed");
        if (/src[\\/].+\.(tsx|ts|css)$/.test(file)) {
          const violations = guard();
          if (violations.length) {
            console.log(`\x1b[33m[design]\x1b[0m ${violations.length} hardcoded value(s) in src/`);
            for (const v of violations.slice(0, 8)) console.log(`  ${v.file}:${v.line} ${v.match}`);
          }
        }
      });
    },
  };
}

export default designMdPlugin;
