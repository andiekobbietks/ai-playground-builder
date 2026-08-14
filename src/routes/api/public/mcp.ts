/**
 * Edge MCP endpoint (Streamable HTTP, JSON-RPC 2.0).
 *
 * Tool surface is generated from the same Pydantic models as
 * `python/lampforge/mcp_server.py` — that file is the canonical
 * implementation, this one is what the browser Inspector talks to.
 */
import { createFileRoute } from "@tanstack/react-router";

import { mcpTools, seed } from "@/lib/lampforge";
import {
  assessEvidence,
  createExperience,
  evidenceFor,
  explain,
  getDecision,
  getLearner,
  listConcepts,
} from "@/lib/runtime";

const SERVER_INFO = { name: "lampforge", title: "LAMPForge", version: "0.1.0" };
const INSTRUCTIONS =
  "Tools for LAMPForge, a pedagogical runtime for WJEC Unit 4 LAMP projects. " +
  "Read the learner state before teaching: it decides whether to model (i_do), " +
  "co-construct (we_do) or step back (you_do). Never hand over code in you_do mode.";

const RESOURCES = [
  { uri: "lampforge://seed", name: "seed", title: "Seeded curriculum", mimeType: "application/json" },
];

const PROMPTS = [
  {
    name: "teach",
    title: "Teach a concept",
    description: "A teaching prompt bound to the gradual-release mode.",
    arguments: [
      { name: "concept_id", description: "Concept id", required: true },
      { name: "mode", description: "i_do | we_do | you_do", required: false },
    ],
  },
];

const text = (value: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>,
});

type Args = Record<string, unknown>;

function callTool(name: string, a: Args) {
  switch (name) {
    case "list_concepts":
      return text(
        listConcepts({
          stack: (a["stack"] as string) ?? undefined,
          depth: (a["depth"] as string) ?? undefined,
          query: (a["query"] as string) ?? undefined,
        }),
      );
    case "get_adr": {
      const decision = getDecision(String(a["id"] ?? ""));
      if (!decision) throw new Error(`No such ADR: ${String(a["id"])}`);
      return text({
        decision,
        ...(a["include_evidence"] === false ? {} : { evidence: evidenceFor(decision.id) }),
      });
    }
    case "create_experience":
      return text(
        createExperience({
          intent: String(a["intent"] ?? ""),
          mode: (a["mode"] as never) ?? "we_do",
          concept_ids: (a["concept_ids"] as string[]) ?? [],
          learner_id: String(a["learner_id"] ?? "demo-learner"),
        }),
      );
    case "explain": {
      const result = explain(String(a["concept_id"] ?? ""), (a["mode"] as never) ?? "we_do");
      if (!result) throw new Error(`No such concept: ${String(a["concept_id"])}`);
      return text(result);
    }
    case "assess_evidence":
      return text(
        assessEvidence(
          (a["concept_ids"] as string[]) ?? [],
          String(a["body"] ?? ""),
          String(a["learner_id"] ?? "demo-learner"),
        ),
      );
    case "get_learner_state":
      return text(getLearner(String(a["learner_id"] ?? "demo-learner")));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function handle(req: { id?: unknown; method: string; params?: Record<string, unknown> }) {
  const p = req.params ?? {};
  switch (req.method) {
    case "initialize":
      return {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: mcpTools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: t.readOnly },
        })),
      };
    case "tools/call":
      return callTool(String(p["name"]), (p["arguments"] ?? {}) as Args);
    case "resources/list":
      return { resources: RESOURCES };
    case "resources/read":
      return {
        contents: [
          { uri: "lampforge://seed", mimeType: "application/json", text: JSON.stringify(seed, null, 2) },
        ],
      };
    case "prompts/list":
      return { prompts: PROMPTS };
    case "prompts/get": {
      const args = (p["arguments"] ?? {}) as Record<string, string>;
      const mode = args["mode"] ?? "we_do";
      return {
        description: "A teaching prompt bound to the gradual-release mode.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Teach the concept '${args["concept_id"] ?? ""}' in ${mode} mode. ` +
                "In i_do, model the whole move and narrate each decision. " +
                "In we_do, do the first step and hand over the next. " +
                "In you_do, ask first and respond only to what the learner produces.",
            },
          },
        ],
      };
    }
    default:
      throw Object.assign(new Error(`Method not found: ${req.method}`), { code: -32601 });
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id",
  "access-control-allow-methods": "POST, GET, OPTIONS",
};

export const Route = createFileRoute("/api/public/mcp")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { headers: CORS }),
      GET: () =>
        new Response(JSON.stringify({ ...SERVER_INFO, transport: "streamable-http" }, null, 2), {
          headers: { ...CORS, "content-type": "application/json" },
        }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
            { status: 400, headers: { ...CORS, "content-type": "application/json" } },
          );
        }
        const batch = Array.isArray(body) ? body : [body];
        const out = batch.map((raw) => {
          const req = raw as { id?: unknown; method: string; params?: Record<string, unknown> };
          try {
            return { jsonrpc: "2.0", id: req.id ?? null, result: handle(req) };
          } catch (e) {
            const err = e as Error & { code?: number };
            return {
              jsonrpc: "2.0",
              id: req.id ?? null,
              error: { code: err.code ?? -32603, message: err.message },
            };
          }
        });
        const payload = Array.isArray(body) ? out : out[0];
        return new Response(JSON.stringify(payload, null, 2), {
          headers: { ...CORS, "content-type": "application/json" },
        });
      },
    },
  },
});
