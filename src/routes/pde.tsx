import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  BootstrapFrame,
  Chip,
  Json,
  ModeSwitch,
  Page,
  SectionTitle,
} from "@/components/lampforge/primitives";
import { conceptById, seed, type Decision, type PedagogyMode } from "@/lib/lampforge";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pde")({
  head: () => ({
    meta: [
      { title: "PDE — the Pedagogical Development Environment" },
      {
        name: "description",
        content:
          "An IDE whose assistant is bound to your learning mode: edit Bootstrap, PHP and SQL, preview the artefact live, trace a simulated request, and emit a decision record from every accepted change.",
      },
      { property: "og:title", content: "PDE — Pedagogical Development Environment" },
      {
        property: "og:description",
        content: "Files, preview, request trace, plan, checkpoints and ADR emission for a WJEC LAMP build.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pde,
});

type FileEntry = { path: string; language: string; body: string };

function initialFiles(): FileEntry[] {
  const component = seed.components[0];
  const decision = seed.decisions[0];
  return [
    {
      path: "public/index.php",
      language: "php",
      body: `<?php\nrequire __DIR__ . '/../src/db.php';\n$rooms = $pdo->query('SELECT id, name FROM rooms ORDER BY name')->fetchAll();\n?>\n<!doctype html>\n<html data-bs-theme="dark">\n<head><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"></head>\n<body class="p-4">\n${component?.html ?? "<p>Booking form goes here.</p>"}\n</body>\n</html>`,
    },
    {
      path: "src/db.php",
      language: "php",
      body: `<?php\n$pdo = new PDO('mysql:host=localhost;dbname=bookings;charset=utf8mb4', 'app', getenv('DB_PASS'), [\n  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,\n  PDO::ATTR_EMULATE_PREPARES => false,\n]);`,
    },
    {
      path: "src/create_booking.php",
      language: "php",
      body: `<?php\nrequire __DIR__ . '/db.php';\n$stmt = $pdo->prepare('INSERT INTO bookings (room_id, starts_at, learner_name) VALUES (?, ?, ?)');\n$stmt->execute([$_POST['room_id'], $_POST['starts_at'], trim($_POST['name'])]);\nheader('Location: /index.php?booked=1');`,
    },
    {
      path: "schema.sql",
      language: "sql",
      body: `CREATE TABLE rooms (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(64) NOT NULL UNIQUE\n);\n\nCREATE TABLE bookings (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  room_id INT NOT NULL,\n  starts_at DATETIME NOT NULL,\n  learner_name VARCHAR(80) NOT NULL,\n  CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES rooms(id),\n  UNIQUE KEY uq_slot (room_id, starts_at)\n);`,
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

function Pde() {
  const [store, setStore] = useStore();
  const mode = store.learner.mode as PedagogyMode;
  const [files, setFiles] = useState<FileEntry[]>(initialFiles);
  const [active, setActive] = useState(0);
  const [terminal, setTerminal] = useState<string[]>([
    "$ php -S localhost:8000 -t public",
    "PHP 8.3 Development Server started",
  ]);
  const file = files[active]!;

  const previewHtml = useMemo(() => {
    const php = files.find((f) => f.path === "public/index.php")?.body ?? "";
    const body = php.split("<body")[1] ?? "";
    return body.replace(/^[^>]*>/, "").replace("</body>", "").replace("</html>", "");
  }, [files]);

  function run() {
    setTerminal((t) => [
      ...t,
      "$ curl -X POST localhost:8000/src/create_booking.php -d room_id=2 -d starts_at='2026-09-01 09:00' -d name=Ada",
      "→ prepare: INSERT INTO bookings (room_id, starts_at, learner_name) VALUES (?, ?, ?)",
      "→ bind: [2, '2026-09-01 09:00', 'Ada']  (values never concatenated into SQL)",
      "← 302 Location: /index.php?booked=1   1 row affected (4.2ms)",
    ]);
  }

  function emitAdr() {
    const n = 100 + store.adrDrafts.length + 1;
    const draft: Decision = {
      ...(seed.decisions[0] as Decision),
      id: `ADR-${n}`,
      title: `Use a prepared statement for booking inserts (${file.path})`,
      status: "proposed",
      context: `Working in ${file.path} while in ${mode.toUpperCase()} mode.`,
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
                  onClick={() => setActive(i)}
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
            <Chip onClick={run}>run request</Chip>
            <Chip onClick={emitAdr}>emit ADR draft</Chip>
            <span className="font-mono text-[11px] text-muted-foreground">{file.path}</span>
          </div>

          <textarea
            value={file.body}
            spellCheck={false}
            onChange={(e) =>
              setFiles((fs) => fs.map((f, i) => (i === active ? { ...f, body: e.target.value } : f)))
            }
            className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-[11px] leading-relaxed outline-none"
          />

          <div className="border-t border-border">
            <SectionTitle>terminal · simulated request/response and query trace</SectionTitle>
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
