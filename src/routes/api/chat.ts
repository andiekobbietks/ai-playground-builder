/**
 * Conversational pedagogy stream.
 *
 * Vercel AI SDK v7 over the Lovable AI Gateway. The tool surface mirrors the
 * MCP/Pydantic grammar, so every teaching move the model makes is also an
 * inspectable object the UI can render as generative UI.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { seed, MODE_LABEL, type PedagogyMode } from "@/lib/lampforge";
import {
  assessEvidence,
  createExperience,
  evidenceFor,
  explain,
  getDecision,
  getLearner,
  listConcepts,
} from "@/lib/runtime";

const MODE_RULES: Record<PedagogyMode, string> = {
  i_do: "I DO: model the whole move yourself and narrate every decision as you make it. Show the code.",
  we_do: "WE DO: do the first step, then hand the next step to the learner as a concrete question. Never finish the artefact for them.",
  you_do:
    "YOU DO: do not produce the code. Ask first, hold the success criteria, respond only to what the learner produces, and name the criterion each response meets or misses.",
};

function systemPrompt(mode: PedagogyMode) {
  const concepts = seed.concepts.map((c) => `${c.id} (${c.stack}/${c.depth}) — ${c.title}`).join("\n");
  const adrs = seed.decisions.map((d) => `${d.id} — ${d.title}`).join("\n");
  return `You are LAMPForge, a pedagogical runtime for WJEC Unit 4 (LAMP: Linux/Apache/MySQL/PHP, plus Bootstrap).

Current mode: ${MODE_LABEL[mode]}. ${MODE_RULES[mode]}

Teaching contract:
- Every artefact you produce must be inspectable, manipulable, traceable to code and traceable to the decision that produced it.
- Prefer calling a tool over describing from memory: tools return the canonical objects (concepts, ADRs, experiences, learner state) and the UI renders them beside your words.
- After a tool result, say the teaching move out loud: why this object, what to notice, what the learner does next.
- Use WJEC vocabulary precisely; correct loose language gently.
- Keep prose short. One idea per paragraph. End with exactly one question the learner can act on.

Concepts:
${concepts}

Decision records:
${adrs}`;
}

const modeEnum = z.enum(["i_do", "we_do", "you_do"]);

const tools = {
  list_concepts: tool({
    description: "List LAMP concepts in the curriculum graph, optionally filtered.",
    inputSchema: z.object({
      stack: z.string().optional(),
      depth: z.string().optional(),
      query: z.string().optional(),
    }),
    execute: async (a) =>
      listConcepts(JSON.parse(JSON.stringify(a)) as { stack?: string; depth?: string; query?: string }).map(({ id, title, stack, depth, summary }) => ({
      id,
      title,
      stack,
      depth,
      summary,
    })),
  }),
  explain_concept: tool({
    description: "Explain one concept at the learner's current pedagogy mode. Renders as a concept card.",
    inputSchema: z.object({ concept_id: z.string(), mode: modeEnum.optional() }),
    execute: async ({ concept_id, mode }) => explain(concept_id, mode ?? "we_do") ?? { error: "no such concept" },
  }),
  build_experience: tool({
    description:
      "Turn an intent into a structured experience: narration, live Bootstrap component, PHP and SQL. Renders as live UI.",
    inputSchema: z.object({
      intent: z.string(),
      mode: modeEnum.optional(),
      concept_ids: z.array(z.string()).optional(),
    }),
    execute: async (a) =>
      createExperience({ intent: a.intent, mode: a.mode ?? "we_do", concept_ids: a.concept_ids ?? [] }),
  }),
  show_adr: tool({
    description: "Fetch an Architectural Decision Record with its evidence. Renders as an ADR card.",
    inputSchema: z.object({ id: z.string() }),
    execute: async ({ id }) => {
      const decision = getDecision(id);
      if (!decision) return { error: `no such ADR: ${id}` };
      return { decision, evidence: evidenceFor(id) };
    },
  }),
  assess_evidence: tool({
    description: "Score a piece of learner evidence against the concepts it claims to demonstrate.",
    inputSchema: z.object({ concept_ids: z.array(z.string()), body: z.string() }),
    execute: async ({ concept_ids, body }) => assessEvidence(concept_ids, body),
  }),
  get_learner_state: tool({
    description: "Read the learner model before deciding how much to hand over.",
    inputSchema: z.object({}),
    execute: async () => getLearner(),
  }),
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI gateway key missing", { status: 500 });

        const { messages, mode } = (await request.json()) as {
          messages: UIMessage[];
          mode?: PedagogyMode;
        };

        const gateway = createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
        });

        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: systemPrompt(mode ?? "we_do"),
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(5),
        });

        return createUIMessageStreamResponse({
          stream: toUIMessageStream({ stream: result.stream, originalMessages: messages, sendReasoning: true, sendSources: true }),
        });
      },
    },
  },
});
