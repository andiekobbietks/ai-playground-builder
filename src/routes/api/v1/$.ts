import { createFileRoute } from "@tanstack/react-router";

import { seed } from "@/lib/lampforge";
import {
  assessEvidence,
  createExperience,
  evidenceFor,
  explain,
  getConcept,
  getDecision,
  getLearner,
  listConcepts,
  listDecisions,
} from "@/lib/runtime";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

const notFound = (detail: string) => json({ detail }, 404);

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = "/" + (params._splat ?? "");
        const url = new URL(request.url);
        const q = url.searchParams;
        const segs = path.split("/").filter(Boolean);

        if (path === "/concepts") {
          return json(
            listConcepts({
              stack: q.get("stack") ?? undefined,
              depth: q.get("depth") ?? undefined,
              query: q.get("query") ?? undefined,
            }),
          );
        }
        if (segs[0] === "concepts" && segs[1] && segs.length === 2) {
          const c = getConcept(segs[1]);
          return c ? json(c) : notFound("Concept not found");
        }
        if (path === "/adrs") return json(listDecisions(q.get("project_id") ?? undefined));
        if (segs[0] === "adrs" && segs[1] && segs.length === 2) {
          const d = getDecision(segs[1]);
          return d ? json(d) : notFound("ADR not found");
        }
        if (segs[0] === "adrs" && segs[1] && segs[2] === "evidence") return json(evidenceFor(segs[1]));
        if (segs[0] === "learner" && segs[1]) return json(getLearner(segs[1]));
        if (path === "/tasks") return json(seed.tasks);
        if (path === "/projects") return json(seed.projects);

        return notFound(`No operation for GET ${path}`);
      },
      POST: async ({ params, request }) => {
        const path = "/" + (params._splat ?? "");
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ detail: "Invalid JSON body" }, 422);
        }

        if (path === "/experiences") {
          if (typeof body.intent !== "string" || !body.intent.trim())
            return json({ detail: "`intent` is required" }, 422);
          return json(createExperience(body as never));
        }
        if (path === "/explain") {
          const result = explain(String(body.concept_id ?? ""), (body.mode as never) ?? "we_do");
          return result ? json(result) : notFound("Concept not found");
        }
        if (path === "/evidence/assess") {
          const ids = Array.isArray(body.concept_ids) ? (body.concept_ids as string[]) : [];
          return json(assessEvidence(ids, String(body.body ?? ""), String(body.learner_id ?? "demo-learner")));
        }

        return notFound(`No operation for POST ${path}`);
      },
    },
  },
});
