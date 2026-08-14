# LAMPForge — Swagger, MCP Inspector, PDE and Pedagogical Chat

One app, four connected surfaces over a single canonical model. Everything in the app is a projection of the same objects: concepts, ADRs, tasks, evidence, learner state.

## The four surfaces

**1. EXPLORE — the enterprise Swagger**
A hand-built OpenAPI 3.1 spec for the LAMPForge API, rendered in a custom Swagger UI (not the stock widget) so it can carry pedagogy. Every operation card has:
- schema view, example request/response
- a real **Try it out** that hits live endpoints in this app and returns actual JSON
- the links layer: `View JSON Schema`, `Open OpenAPI`, `View ADR`, `Ask about this decision`

Operation groups: `/concepts`, `/adrs`, `/experiences`, `/learner`, `/evidence`, `/projects`, `/mcp`.

`POST /experiences` is the special one: it returns a **structured experience description**, and the playground renders it as live Bootstrap UI beside the raw JSON — endpoint → structured experience → rendered UI → interaction → underlying response.

**2. INSPECT — the MCP Inspector**
A faithful rebuild of the open-source MCP Inspector layout (server pane, connection status, tabs for Tools / Resources / Prompts, request/response history, JSON-RPC log) wired to a real MCP server exposed by this app at `/api/public/mcp` over Streamable HTTP. Tools: `list_concepts`, `get_adr`, `create_experience`, `explain`, `assess_evidence`, `get_learner_state`.

Alongside it, the same server written with the **Python MCP SDK** lives in `mcp-python/` as the canonical, copyable artefact — readable inside the app's file viewer, runnable locally by you, and identical in tool surface to the live TypeScript one.

**3. BUILD — the PDE (Pedagogical Development Environment)**
The AI-IDE chassis, made pedagogical: file tree, code editor, live preview iframe of the learner's HTML/CSS/Bootstrap artefact, a streaming terminal pane, task queue, and checkpoints. What makes it a PDE rather than an IDE: every action can emit an ADR draft, the assistant refuses to just hand over code when the learner's mode is YOU DO, and each artefact links back to the decision that produced it.

PHP/MySQL are represented as authored files plus a simulated request/response trace (no PHP runtime in the browser) so the WJEC transactional-website shape is teachable end to end. Project export ships a zipped Bootstrap + PHP + `schema.sql` skeleton.

**4. CHAT — conversational pedagogy**
Vercel AI SDK UI chat streaming from the Lovable AI Gateway (Google Gemini by default). This is where I DO → WE DO → YOU DO lives:
- an explicit mode selector, plus automatic mode transitions driven by learner state
- tool calls that render **generative UI inline**: a rendered Bootstrap component, an ADR card, a Swagger operation, a code diff, an ERD
- "inspect it, manipulate it, ask why it works, trace it back to the code, and connect it to the decision that produced it" — every inline artefact carries those affordances
- the learner model tracked from the signals you listed (accuracy, response time, retries, hint requests, idle duration, retrieval success, time since last exposure, task difficulty)

## Shared spine

- **Canonical domain model** in TypeScript + Zod: `Concept`, `Skill`, `Task`, `Intent`, `Evidence`, `Decision (ADR)`, `Tool`, `UIComponent`, `Relationship`. The OpenAPI spec, the MCP tool schemas and the chat tools are all generated from these same schemas — one grammar, five projections.
- **Seed content**: WJEC Unit 4 LAMP vocabulary — a booking-system project with ~20 concepts and ~18 worked ADRs, so every surface has real material on first load.
- **Design**: dark technical workbench, monospace accents, no purple-gradient look. Left rail switches surface; the object you're inspecting persists across surfaces.

## Technical notes

- TanStack Start, TypeScript. Server routes under `src/routes/api/` back the Swagger Try-it-out and the MCP endpoint; chat streams from a server route via the AI SDK.
- Live MCP is TypeScript (`src/lib/mcp/`); `mcp-python/` holds the equivalent `mcp` Python SDK server as source-of-truth artefact and reference implementation.
- Lovable Cloud/Supabase is currently disabled for your account, so this build keeps learner state, ADRs and projects in browser storage behind a single `store` interface. When you enable Cloud (or wire your own Supabase), that interface swaps to real persistence without touching the surfaces.
- Requires a Lovable AI key for the chat; I'll provision it as part of the build.

## Build order

1. Domain model + seed content + app shell with the four-surface rail
2. OpenAPI spec + Swagger surface + live Try-it-out endpoints
3. MCP server (TS live + Python source) + Inspector surface
4. Chat surface with pedagogy modes and inline generative UI
5. PDE surface: file tree, editor, preview, terminal, checkpoints, ADR emission, zip export
