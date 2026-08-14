import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import mcpServerSource from "../../python/lampforge/mcp_server.py?raw";
import { Chip, Json, Page, SectionTitle } from "@/components/lampforge/primitives";
import { SchemaView } from "@/components/lampforge/schema-view";
import { mcpTools, type JsonSchema } from "@/lib/lampforge";
import { useFocus } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inspect")({
  head: () => ({
    meta: [
      { title: "MCP Inspector — LAMPForge tool surface" },
      {
        name: "description",
        content:
          "Connect to the LAMPForge MCP server, call its tools with schema-generated forms, read resources and prompts, and watch every JSON-RPC frame.",
      },
      { property: "og:title", content: "MCP Inspector — LAMPForge tool surface" },
      {
        property: "og:description",
        content: "Tools, resources, prompts and a live JSON-RPC log for the LAMPForge MCP server.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inspector,
});

type Frame = { dir: "out" | "in"; at: number; payload: unknown };
type Tab = "tools" | "resources" | "prompts" | "source";

let rpcId = 0;

function Inspector() {
  const [endpoint, setEndpoint] = useState("/api/public/mcp");
  const [connected, setConnected] = useState<null | { serverInfo: { name: string; version: string }; instructions?: string }>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [tab, setTab] = useState<Tab>("tools");
  const [toolName, setToolName] = useState(mcpTools[0]?.name ?? "");
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<Array<{ name: string; title?: string; description?: string; inputSchema: JsonSchema }>>([]);
  const [resources, setResources] = useState<Array<{ uri: string; name: string; title?: string }>>([]);
  const [prompts, setPrompts] = useState<Array<{ name: string; title?: string; description?: string }>>([]);
  const [, setFocus] = useFocus();

  const rpc = useCallback(
    async (method: string, params?: Record<string, unknown>) => {
      const req = { jsonrpc: "2.0", id: ++rpcId, method, ...(params ? { params } : {}) };
      setFrames((f) => [...f, { dir: "out", at: Date.now(), payload: req }]);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify(req),
      });
      const json = (await res.json()) as { result?: unknown; error?: { message: string } };
      setFrames((f) => [...f, { dir: "in", at: Date.now(), payload: json }]);
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
    [endpoint],
  );

  const connect = useCallback(async () => {
    setError(null);
    try {
      const init = (await rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "lampforge-inspector", version: "0.1.0" },
      })) as { serverInfo: { name: string; version: string }; instructions?: string };
      setConnected(init);
      setTools(((await rpc("tools/list")) as { tools: typeof tools }).tools);
      setResources(((await rpc("resources/list")) as { resources: typeof resources }).resources);
      setPrompts(((await rpc("prompts/list")) as { prompts: typeof prompts }).prompts);
    } catch (e) {
      setError(String(e));
      setConnected(null);
    }
  }, [rpc]);

  useEffect(() => {
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = tools.find((t) => t.name === toolName) ?? mcpTools.find((t) => t.name === toolName);
  const schema = active?.inputSchema as JsonSchema | undefined;
  const props = schema?.properties ?? {};

  async function callTool() {
    setError(null);
    setResult(null);
    const parsed: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(props)) {
      const raw = args[k];
      if (raw === undefined || raw === "") continue;
      const t = p.type ?? (p.anyOf?.find((a) => a.type !== "null")?.type ?? "string");
      if (t === "array") parsed[k] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      else if (t === "integer" || t === "number") parsed[k] = Number(raw);
      else if (t === "boolean") parsed[k] = raw === "true";
      else parsed[k] = raw;
    }
    try {
      setResult(await rpc("tools/call", { name: toolName, arguments: parsed }));
      setFocus({ kind: "tool", id: toolName });
    } catch (e) {
      setError(String(e));
    }
  }

  async function readResource(uri: string) {
    setError(null);
    try {
      setResult(await rpc("resources/read", { uri }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function getPrompt(name: string) {
    setError(null);
    try {
      setResult(await rpc("prompts/get", { name, arguments: { concept_id: "crud", mode: "we_do" } }));
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <Page>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* connection + registry */}
        <aside className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <SectionTitle>connection</SectionTitle>
          <div className="space-y-2 p-3">
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-2 py-1 font-mono text-xs outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void connect()}
                className="rounded-md bg-primary px-2.5 py-1 font-mono text-xs font-semibold text-primary-foreground"
              >
                {connected ? "reconnect" : "connect"}
              </button>
              <span
                className={cn(
                  "font-mono text-[11px]",
                  connected ? "text-chart-2" : "text-muted-foreground",
                )}
              >
                {connected ? `● ${connected.serverInfo.name} v${connected.serverInfo.version}` : "○ disconnected"}
              </span>
            </div>
            {connected?.instructions ? (
              <p className="text-[11px] leading-snug text-muted-foreground">{connected.instructions}</p>
            ) : null}
          </div>

          <div className="flex gap-1 border-y border-border px-2 py-1.5">
            {(["tools", "resources", "prompts", "source"] as Tab[]).map((t) => (
              <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
                {t}
              </Chip>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {tab === "tools"
              ? (tools.length ? tools : mcpTools).map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setToolName(t.name);
                      setArgs({});
                      setResult(null);
                    }}
                    className={cn(
                      "block w-full rounded-md px-2 py-1.5 text-left",
                      t.name === toolName ? "bg-primary/15" : "hover:bg-accent",
                    )}
                  >
                    <span className="font-mono text-xs text-foreground">{t.name}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{t.description}</span>
                  </button>
                ))
              : null}
            {tab === "resources"
              ? resources.map((r) => (
                  <button
                    key={r.uri}
                    type="button"
                    onClick={() => void readResource(r.uri)}
                    className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="font-mono text-xs">{r.uri}</span>
                    <span className="block text-[11px] text-muted-foreground">{r.title ?? r.name}</span>
                  </button>
                ))
              : null}
            {tab === "prompts"
              ? prompts.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => void getPrompt(p.name)}
                    className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="font-mono text-xs">{p.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.description}</span>
                  </button>
                ))
              : null}
            {tab === "source" ? (
              <p className="p-1 text-[11px] leading-snug text-muted-foreground">
                The canonical server is the Python MCP SDK implementation on the right. This edge endpoint mirrors its
                tool surface because both are generated from the same Pydantic models.
              </p>
            ) : null}
          </div>
        </aside>

        {/* main pane */}
        <div className="flex min-h-0 flex-col overflow-auto">
          {tab === "source" ? (
            <>
              <SectionTitle right={<Chip>python/lampforge/mcp_server.py</Chip>}>canonical implementation</SectionTitle>
              <Json value={mcpServerSource} className="m-3" />
            </>
          ) : (
            <>
              <SectionTitle right={active ? <Chip>{("readOnly" in (active as object)) && (active as { readOnly?: boolean }).readOnly ? "read-only" : "mutating"}</Chip> : null}>
                {toolName || "select a tool"}
              </SectionTitle>
              <div className="space-y-4 p-3">
                {active?.description ? (
                  <p className="max-w-prose text-sm text-muted-foreground">{active.description}</p>
                ) : null}

                {Object.keys(props).length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(props).map(([name, p]) => {
                      const options = p.enum ?? p.anyOf?.find((a) => a.enum)?.enum;
                      return (
                        <label key={name} className="block">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {name}
                            {schema?.required?.includes(name) ? <span className="text-destructive">*</span> : null}{" "}
                            <em className="not-italic text-primary/70">
                              {p.type ?? p.anyOf?.find((a) => a.type !== "null")?.type ?? "string"}
                            </em>
                          </span>
                          {options ? (
                            <select
                              value={args[name] ?? ""}
                              onChange={(e) => setArgs((a) => ({ ...a, [name]: e.target.value }))}
                              className="mt-1 w-full rounded-md border border-border bg-input px-2 py-1 font-mono text-xs"
                            >
                              <option value="">—</option>
                              {options.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={args[name] ?? ""}
                              onChange={(e) => setArgs((a) => ({ ...a, [name]: e.target.value }))}
                              placeholder={p.type === "array" ? "comma,separated" : (p.description ?? "")}
                              className="mt-1 w-full rounded-md border border-border bg-input px-2 py-1 font-mono text-xs outline-none focus:border-primary"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">This tool takes no arguments.</p>
                )}

                <button
                  type="button"
                  onClick={() => void callTool()}
                  className="rounded-md bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground"
                >
                  Run tool
                </button>

                {error ? (
                  <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
                    {error}
                  </p>
                ) : null}

                {result ? (
                  <div>
                    <SectionTitle>result</SectionTitle>
                    <Json value={result} className="max-h-[420px]" />
                  </div>
                ) : null}

                {schema ? (
                  <details className="rounded-md border border-border">
                    <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      input schema (generated from Pydantic)
                    </summary>
                    <div className="p-3">
                      <SchemaView schema={schema} />
                    </div>
                  </details>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* history */}
        <aside className="flex min-h-0 flex-col border-t border-border lg:border-l lg:border-t-0">
          <SectionTitle right={<Chip onClick={() => setFrames([])}>clear</Chip>}>json-rpc history</SectionTitle>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
            {frames.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">No frames yet.</p>
            ) : null}
            {frames
              .slice()
              .reverse()
              .map((f, i) => (
                <details key={frames.length - i} className="rounded-md border border-border" open={i < 1}>
                  <summary className="cursor-pointer px-2 py-1 font-mono text-[11px]">
                    <span className={f.dir === "out" ? "text-chart-4" : "text-chart-2"}>
                      {f.dir === "out" ? "→" : "←"}
                    </span>{" "}
                    {(f.payload as { method?: string }).method ?? "response"}{" "}
                    <span className="text-muted-foreground">
                      {new Date(f.at).toLocaleTimeString(undefined, { hour12: false })}
                    </span>
                  </summary>
                  <Json value={f.payload} className="max-h-64 rounded-none" />
                </details>
              ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}
