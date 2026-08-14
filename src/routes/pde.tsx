import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { CodeEditor } from "@/components/lampforge/editor";
import {
  BootstrapFrame,
  Chip,
  Json,
  ModeSwitch,
  Page,
  SectionTitle,
} from "@/components/lampforge/primitives";
import { conceptById, seed, type Decision, type PedagogyMode } from "@/lib/lampforge";
import { engineFor, resetSql, run, type Engine, type RunResult } from "@/lib/runtimes";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pde")({
  head: () => ({
    meta: [
      { title: "PDE — the browser-native Pedagogical Development Environment" },
      {
        name: "description",
        content:
          "An IDE that really executes: CPython via Pyodide, SQLite via sql.js, PHP via php-wasm and live Bootstrap rendering — all in the browser, bound to your learning mode.",
      },
      { property: "og:title", content: "PDE — Pedagogical Development Environment" },
      {
        property: "og:description",
        content: "Run Python, SQL, PHP and Bootstrap in-browser on WebAssembly, then emit a decision record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pde,
});

type Lang = "python" | "sql" | "php" | "html" | "markdown";
type FileEntry = { path: string; language: Lang; body: string };

function initialFiles(): FileEntry[] {
  const component = seed.components[0];
  const decision = seed.decisions[0];
  return [
    {
      path: "pedagogy.py",
      language: "python",
      body: `"""The gradual-release rule, running for real on CPython (WebAssembly).

Change the learner signals, press Run, and watch the mode the runtime
would hand you next. This is the same rule the chat surface obeys.
"""
from dataclasses import dataclass

@dataclass
class Learner:
    mode: str = "we_do"
    accuracy: float = 0.62
    hint_requests: int = 2
    retries: int = 1
    successful_retrievals: int = 5
    failed_retrievals: int = 3

def next_mode(s: Learner) -> str:
    total = s.successful_retrievals + s.failed_retrievals
    rate = s.successful_retrievals / total if total else 0.0
    struggling = s.hint_requests >= 3 or s.retries >= 4 or s.accuracy < 0.5
    secure = s.accuracy >= 0.8 and rate >= 0.7 and s.hint_requests <= 1
    if struggling:
        return "i_do" if s.mode == "we_do" else "we_do"
    if secure:
        return "you_do" if s.mode == "we_do" else "we_do"
    return s.mode

me = Learner()
print("retrieval rate:", round(me.successful_retrievals / (me.successful_retrievals + me.failed_retrievals), 2))
print("current mode:  ", me.mode)
print("next mode:     ", next_mode(me))
`,
    },
    {
      path: "schema.sql",
      language: "sql",
      body: `CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  learner_name VARCHAR(80) NOT NULL,
  CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  UNIQUE KEY uq_slot (room_id, starts_at)
);

INSERT INTO rooms (name) VALUES ('Studio A'), ('Studio B');
INSERT INTO bookings (room_id, starts_at, learner_name)
VALUES (1, '2026-09-01 09:00', 'Ada'), (2, '2026-09-01 10:00', 'Grace');

SELECT b.id, r.name AS room, b.starts_at, b.learner_name
FROM bookings b JOIN rooms r ON r.id = b.room_id
ORDER BY b.starts_at;`,
    },
    {
      path: "create_booking.php",
      language: "php",
      body: `<?php
// Runs on a real PHP interpreter compiled to WebAssembly.
$post = ['room_id' => '2', 'starts_at' => '2026-09-01 09:00', 'name' => "  Ada'; DROP TABLE bookings; --  "];

$errors = [];
if (trim($post['name']) === '') { $errors[] = 'Name is required'; }
if (!preg_match('/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/', $post['starts_at'])) {
    $errors[] = 'Slot must be YYYY-MM-DD HH:MM';
}

printf("validated: %s\\n", $errors ? implode('; ', $errors) : 'ok');
printf("bound parameters: [%d, %s, %s]\\n", (int) $post['room_id'], $post['starts_at'], trim($post['name']));
echo "the value above is data, never statement structure — that is what binding buys you\\n";
`,
    },
    {
      path: "index.html",
      language: "html",
      body: `<div class="container py-4">
${component?.html ?? '<p class="text-body-secondary">Booking form goes here.</p>'}
</div>`,
    },
    {
      path: `docs/${decision?.id ?? "ADR-001"}.md`,
      language: "markdown",
      body: `# ${decision?.id}: ${decision?.title}\n\n## Context\n${decision?.context}\n\n## Decision\n${decision?.decision}\n\n## Rationale\n${decision?.rationale}`,
    },
  ];
}

const PLAN = [
  { id: "p1", label: "Model the rooms/bookings relationship", state: "done" },
  { id: "p2", label: "Build the booking form in Bootstrap", state: "done" },
  { id: "p3", label: "Insert with a prepared statement", state: "active" },
  { id: "p4", label: "Prevent double booking with a unique key", state: "queued" },
  { id: "p5", label: "Write the ADR and attach evidence", state: "queued" },
];

const ENGINE_LABEL: Record<Engine, string> = {
  python: "CPython 3.12 · Pyodide (WASM)",
  sql: "SQLite 3 · sql.js (WASM)",
  php: "PHP 8 · php-wasm (WASM)",
  html: "Bootstrap 5 · sandboxed iframe",
};

function Pde() {
  const [store, setStore] = useStore();
  const mode = store.learner.mode as PedagogyMode;
  const [files, setFiles] = useState<FileEntry[]>(initialFiles);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [terminal, setTerminal] = useState<string[]>([
    "LAMPForge PDE — every runtime below is real WebAssembly, loaded on first use.",
  ]);
  const file = files[active]!;
  const engine = engineFor(file.path);

  const previewHtml = useMemo(
    () => files.find((f) => f.path === "index.html")?.body ?? "",
    [files],
  );

  const execute = useCallback(async () => {
    setBusy(true);
    setTerminal((t) => [...t, `$ run ${file.path}   (${ENGINE_LABEL[engine]})`]);
    const res = await run(engine, file.body);
    setResult(res);
    setTerminal((t) => [
      ...t,
      ...res.lines.filter((l) => l !== ""),
      `${res.ok ? "✓" : "✗"} finished in ${res.ms.toFixed(0)}ms`,
    ]);
    setBusy(false);
  }, [engine, file.body, file.path]);

  const resetDatabase = useCallback(async () => {
    await resetSql();
    setResult(null);
    setTerminal((t) => [...t, "$ reset database", "in-memory SQLite dropped and recreated"]);
  }, []);

  function emitAdr() {
    const n = 100 + store.adrDrafts.length + 1;
    const draft: Decision = {
      ...(seed.decisions[0] as Decision),
      id: `ADR-${n}`,
      title: `Executed ${file.path} on ${ENGINE_LABEL[engine].split(" ·")[0]}`,
      status: "proposed",
      context: `Working in ${file.path} while in ${mode.toUpperCase()} mode. Last run ${
        result ? (result.ok ? "succeeded" : "failed") : "not yet performed"
      }.`,
      decision: "Bind user input as parameters rather than interpolating it into the SQL string.",
      rationale:
        "Parameter binding separates code from data, so a malicious value can never change the statement's structure.",
      evidence_ids: [],
    };
    setStore((s) => ({
      adrDrafts: [...s.adrDrafts, draft],
      checkpoints: [
        ...s.checkpoints,
        { id: draft.id, label: `ADR drafted from ${file.path}`, mode, at: Date.now() },
      ],
    }));
  }

  return (
    <Page>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <SectionTitle>files</SectionTitle>
          <ul className="p-2">
            {files.map((f, i) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(i);
                    setResult(null);
                  }}
                  className={cn(
                    "w-full truncate rounded-md px-2 py-1 text-left font-mono text-[11px]",
                    i === active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
          <SectionTitle>plan</SectionTitle>
          <ul className="space-y-1 p-2">
            {PLAN.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-[11px]">
                <span
                  className={cn(
                    "mt-1 inline-block size-1.5 shrink-0 rounded-full",
                    p.state === "done" ? "bg-chart-2" : p.state === "active" ? "bg-primary" : "bg-muted-foreground/40",
                  )}
                />
                <span className={p.state === "queued" ? "text-muted-foreground" : "text-foreground"}>{p.label}</span>
              </li>
            ))}
          </ul>
          <SectionTitle>checkpoints</SectionTitle>
          <ul className="space-y-1 p-2">
            {store.checkpoints.length === 0 ? (
              <li className="px-1 text-[11px] text-muted-foreground">
                Pedagogical states, not chat states. Emit one by accepting a change.
              </li>
            ) : null}
            {store.checkpoints.map((c) => (
              <li key={c.id + c.at} className="font-mono text-[11px] text-muted-foreground">
                <span className="text-primary">{c.mode}</span> · {c.label}
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <ModeSwitch mode={mode} onChange={(m) => setStore((s) => ({ learner: { ...s.learner, mode: m } }))} />
            <Chip onClick={busy ? undefined : execute}>{busy ? "running…" : "run"}</Chip>
            {engine === "sql" ? <Chip onClick={resetDatabase}>reset db</Chip> : null}
            <Chip onClick={emitAdr}>emit ADR draft</Chip>
            <span className="font-mono text-[11px] text-muted-foreground">
              {file.path} · {ENGINE_LABEL[engine]}
            </span>
          </div>

          <CodeEditor
            value={file.body}
            language={file.language}
            onChange={(next) => setFiles((fs) => fs.map((f, i) => (i === active ? { ...f, body: next } : f)))}
          />

          <div className="border-t border-border">
            <SectionTitle>terminal · real stdout from the WebAssembly runtimes</SectionTitle>
            <pre className="max-h-48 overflow-auto bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
              {terminal.join("\n")}
            </pre>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col overflow-auto border-t border-border lg:border-l lg:border-t-0">
          <SectionTitle>live preview</SectionTitle>
          <div className="p-3">
            <BootstrapFrame html={previewHtml} />
          </div>
          {result?.table ? (
            <>
              <SectionTitle>result set</SectionTitle>
              <div className="overflow-auto p-3">
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr>
                      {result.table.columns.map((c) => (
                        <th key={c} className="border-b border-border px-2 py-1 text-left text-primary">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td key={j} className="border-b border-border/50 px-2 py-1 text-muted-foreground">
                            {String(v ?? "NULL")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <SectionTitle>concepts in play</SectionTitle>
          <div className="flex flex-wrap gap-1 p-3">
            {(seed.decisions[0]?.concept_ids ?? []).map((id) => (
              <Chip key={id} title={conceptById(id)?.summary}>
                {conceptById(id)?.title ?? id}
              </Chip>
            ))}
          </div>
          <SectionTitle>ADR drafts</SectionTitle>
          <div className="space-y-2 p-3">
            {store.adrDrafts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Every accepted change can become a decision record against the Pydantic <code>Decision</code> model.
              </p>
            ) : null}
            {store.adrDrafts.map((d) => (
              <details key={d.id} className="rounded-md border border-border">
                <summary className="cursor-pointer px-2 py-1 font-mono text-[11px] text-primary">
                  {d.id} — {d.title}
                </summary>
                <Json value={d} className="max-h-56 rounded-none" />
              </details>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}
