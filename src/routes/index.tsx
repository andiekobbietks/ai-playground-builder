import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { BootstrapFrame, Chip, Json, MethodTag, Page, SectionTitle } from "@/components/lampforge/primitives";
import { SchemaView } from "@/components/lampforge/schema-view";
import {
  conceptById,
  decisionById,
  evidenceFor,
  openapi,
  operations,
  resolveRef,
  schemas,
  seed,
  tags,
  type Decision,
  type JsonSchema,
  type OperationEntry,
} from "@/lib/lampforge";
import { useFocus } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LAMPForge Playground — WJEC Unit 4 contracts you can run" },
      {
        name: "description",
        content:
          "A pedagogical Swagger playground over a Pydantic-authored contract: run LAMP endpoints live, read the JSON Schemas, and trace every response back to the decision record that produced it.",
      },
      { property: "og:title", content: "LAMPForge Playground — contracts you can run" },
      {
        property: "og:description",
        content: "Run the LAMP curriculum API, inspect its Pydantic schemas, and study the ADRs behind it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Playground,
});

type Panel = "contracts" | "schemas" | "decisions";

function sampleFor(schema: JsonSchema | undefined): unknown {
  if (!schema) return {};
  const resolved = schema.$ref ? resolveRef(schema.$ref) : schema;
  if (!resolved?.properties) return {};
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(resolved.properties)) {
    if (p.default !== undefined) out[k] = p.default;
    else if (p.enum?.[0]) out[k] = p.enum[0];
    else if (p.type === "array") out[k] = [];
    else if (p.type === "integer" || p.type === "number") out[k] = 1;
    else if (p.type === "boolean") out[k] = true;
    else out[k] = k === "intent" ? "Create a booking form." : "";
  }
  return out;
}

function Playground() {
  const [panel, setPanel] = useState<Panel>("contracts");
  const [tag, setTag] = useState<string>(tags[0] ?? "concepts");
  const [selected, setSelected] = useState<OperationEntry>(operations[0]!);
  const [model, setModel] = useState<string>("Concept");
  const [adr, setAdr] = useState<Decision>(seed.decisions[0] as Decision);
  const [, setFocus] = useFocus();

  const shown = useMemo(() => operations.filter((o) => o.tag === tag), [tag]);

  return (
    <Page>
      <div className="border-b border-border bg-card/40 px-4 py-3">
        <h1 className="font-mono text-lg font-semibold tracking-tight">
          {openapi.info.title} <span className="text-muted-foreground">v{openapi.info.version}</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {openapi.info.description ??
            "Every operation, schema and decision below is a projection of the Pydantic models in python/lampforge."}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {(["contracts", "schemas", "decisions"] as Panel[]).map((p) => (
            <Chip key={p} active={panel === p} onClick={() => setPanel(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      {panel === "contracts" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-border lg:border-b-0 lg:border-r">
            <SectionTitle>tags</SectionTitle>
            <ul className="p-2">
              {tags.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => {
                      setTag(t);
                      const first = operations.find((o) => o.tag === t);
                      if (first) setSelected(first);
                    }}
                    className={cn(
                      "w-full rounded-md px-2 py-1 text-left font-mono text-xs",
                      t === tag ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0">
            <SectionTitle right={<span className="font-mono text-[11px] text-muted-foreground">{shown.length} operations</span>}>
              {tag}
            </SectionTitle>
            <div className="space-y-2 p-3">
              {shown.map((entry) => (
                <OperationCard
                  key={entry.method + entry.path}
                  entry={entry}
                  open={selected.method === entry.method && selected.path === entry.path}
                  onOpen={() => {
                    setSelected(entry);
                    setFocus({ kind: "operation", id: `${entry.method} ${entry.path}` });
                  }}
                  onOpenAdr={(d) => {
                    setAdr(d);
                    setPanel("decisions");
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {panel === "schemas" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="overflow-auto border-b border-border lg:border-b-0 lg:border-r">
            <SectionTitle>pydantic models</SectionTitle>
            <ul className="p-2">
              {Object.keys(schemas).map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setModel(name)}
                    className={cn(
                      "w-full rounded-md px-2 py-1 text-left font-mono text-xs",
                      name === model ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 overflow-auto">
            <SectionTitle>{model}</SectionTitle>
            <div className="space-y-4 p-4">
              {schemas[model]?.description ? (
                <p className="max-w-prose text-sm text-muted-foreground">{schemas[model]?.description}</p>
              ) : null}
              <SchemaView schema={schemas[model] as JsonSchema} onSelectModel={setModel} />
              <details className="rounded-md border border-border">
                <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  raw JSON Schema (model_json_schema())
                </summary>
                <Json value={schemas[model]} className="rounded-none" />
              </details>
            </div>
          </div>
        </div>
      ) : null}

      {panel === "decisions" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="overflow-auto border-b border-border lg:border-b-0 lg:border-r">
            <SectionTitle>decision records</SectionTitle>
            <ul className="p-2">
              {seed.decisions.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdr(d as Decision);
                      setFocus({ kind: "decision", id: d.id });
                    }}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left",
                      d.id === adr.id ? "bg-primary/15" : "hover:bg-accent",
                    )}
                  >
                    <span className="font-mono text-[11px] text-primary">{d.id}</span>
                    <span className="block text-xs text-foreground">{d.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 overflow-auto">
            <AdrView decision={adr} />
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function OperationCard({
  entry,
  open,
  onOpen,
  onOpenAdr,
}: {
  entry: OperationEntry;
  open: boolean;
  onOpen: () => void;
  onOpenAdr: (d: Decision) => void;
}) {
  const { method, path, op } = entry;
  const pathParams = (op.parameters ?? []).filter((p) => p.in === "path");
  const queryParams = (op.parameters ?? []).filter((p) => p.in === "query");
  const bodySchema = op.requestBody?.content["application/json"]?.schema;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const p of op.parameters ?? []) v[p.name] = p.name === "learner_id" ? "demo-learner" : "";
    if (pathParams[0]?.name.endsWith("id") && path.includes("adrs")) v[pathParams[0].name] = seed.decisions[0]!.id;
    if (path.includes("concepts") && pathParams[0]) v[pathParams[0].name] = seed.concepts[0]!.id;
    return v;
  });
  const [body, setBody] = useState(() => JSON.stringify(sampleFor(bodySchema), null, 2));
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [busy, setBusy] = useState(false);

  const linkedDecision = useMemo(() => {
    const tagged = seed.decisions.find((d) => op.description?.includes(d.id) ?? false);
    return (tagged ?? seed.decisions[0]) as Decision;
  }, [op.description]);

  async function run() {
    setBusy(true);
    try {
      let url = "/api/v1" + path.replace(/^\/api\/v1/, "");
      for (const p of pathParams) url = url.replace(`{${p.name}}`, encodeURIComponent(values[p.name] ?? ""));
      const qs = new URLSearchParams();
      for (const p of queryParams) if (values[p.name]) qs.set(p.name, values[p.name]!);
      if ([...qs].length) url += `?${qs.toString()}`;
      const res = await fetch(url, {
        method,
        ...(method === "POST" ? { headers: { "content-type": "application/json" }, body } : {}),
      });
      setResponse({ status: res.status, data: await res.json() });
    } catch (e) {
      setResponse({ status: 0, data: { error: String(e) } });
    } finally {
      setBusy(false);
    }
  }

  const experience =
    response?.data && typeof response.data === "object" && "component" in (response.data as object)
      ? (response.data as { narration: string; component: { html: string; label: string }; php?: string; sql?: string; follow_up_questions?: string[] })
      : null;

  return (
    <article className={cn("rounded-lg border bg-card/40", open ? "border-primary/50" : "border-border")}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <MethodTag method={method} />
        <code className="font-mono text-xs text-foreground">{path}</code>
        <span className="truncate text-xs text-muted-foreground">{op.summary}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-3">
          {op.description ? <p className="max-w-prose text-sm text-muted-foreground">{op.description}</p> : null}

          <div className="flex flex-wrap gap-1">
            <Chip title="Jump to the generated JSON Schema">View JSON Schema</Chip>
            <Chip title="This operation comes from python/lampforge/api.py">Open OpenAPI</Chip>
            <Chip onClick={() => onOpenAdr(linkedDecision)}>View ADR {linkedDecision.id}</Chip>
            <Chip title="python/lampforge/runtime.py mirrored at src/lib/runtime.ts">Inspect implementation</Chip>
          </div>

          {(pathParams.length || queryParams.length) ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[...pathParams, ...queryParams].map((p) => (
                <label key={p.name} className="block">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.name} <em className="not-italic text-primary/70">{p.in}</em>
                    {p.required ? <span className="text-destructive">*</span> : null}
                  </span>
                  <input
                    value={values[p.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                    placeholder={p.schema?.enum?.join(" | ") ?? p.description ?? p.name}
                    className="mt-1 w-full rounded-md border border-border bg-input px-2 py-1 font-mono text-xs outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
          ) : null}

          {bodySchema ? (
            <label className="block">
              <span className="font-mono text-[11px] text-muted-foreground">request body</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={Math.min(12, body.split("\n").length + 1)}
                className="mt-1 w-full rounded-md border border-border bg-input p-2 font-mono text-[11px] outline-none focus:border-primary"
              />
            </label>
          ) : null}

          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "running…" : "Try it out"}
          </button>

          {response ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <SectionTitle>
                  response <span className="text-primary">{response.status}</span>
                </SectionTitle>
                <Json value={response.data} className="max-h-96" />
              </div>
              <div>
                <SectionTitle>rendered experience</SectionTitle>
                {experience ? (
                  <div className="space-y-2 p-1">
                    <p className="text-sm text-foreground">{experience.narration}</p>
                    <BootstrapFrame html={experience.component.html} />
                    {experience.php ? (
                      <details className="rounded-md border border-border">
                        <summary className="cursor-pointer px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                          php
                        </summary>
                        <Json value={experience.php} className="rounded-none" />
                      </details>
                    ) : null}
                    {experience.sql ? (
                      <details className="rounded-md border border-border">
                        <summary className="cursor-pointer px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                          sql
                        </summary>
                        <Json value={experience.sql} className="rounded-none" />
                      </details>
                    ) : null}
                    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {(experience.follow_up_questions ?? []).map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="p-3 text-xs text-muted-foreground">
                    This operation returns data, not an experience. Call <code>POST /experiences</code> to see the
                    endpoint → structured experience → rendered UI chain.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AdrView({ decision }: { decision: Decision }) {
  const evidence = evidenceFor(decision.id);
  const blocks: Array<[string, string | string[]]> = [
    ["Context", decision.context],
    ["Decision", decision.decision],
    ["Alternatives", decision.alternatives],
    ["Rationale", decision.rationale],
    ["Consequences", decision.consequences],
  ];
  return (
    <div className="space-y-4 p-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-primary">{decision.id}</span>
          <Chip>{decision.status}</Chip>
          <Chip>{decision.type}</Chip>
          <Chip>{decision.depth}</Chip>
          <Chip title="Suggested NEA word budget">{decision.word_count_target} words</Chip>
        </div>
        <h2 className="mt-1 text-lg font-semibold">{decision.title}</h2>
      </header>

      {blocks.map(([label, value]) => (
        <section key={label}>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</h3>
          {Array.isArray(value) ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground/90">
              {value.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 max-w-prose text-sm text-foreground/90">{value}</p>
          )}
        </section>
      ))}

      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Evidence</h3>
        <div className="mt-1 space-y-2">
          {evidence.length ? (
            evidence.map((e) => (
              <div key={e.id} className="rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <Chip>{e.kind}</Chip>
                  <span className="font-mono text-[11px] text-muted-foreground">{e.id}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-foreground/80">{e.body}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No evidence attached yet.</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Learning connection</h3>
        <div className="mt-1 flex flex-wrap gap-1">
          {decision.concept_ids.map((id) => (
            <Chip key={id} title={conceptById(id)?.summary}>
              {conceptById(id)?.title ?? id}
            </Chip>
          ))}
        </div>
      </section>
    </div>
  );
}

export { decisionById };
