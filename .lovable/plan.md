# LAMPForge — Swagger playground, MCP Inspector, PDE and Pedagogical Chat

Four routes, one canonical model. The model is **Pydantic**, not TypeScript/Zod — Python is the source of truth and everything else is a projection of it.

## Canonical model — Pydantic

`python/lampforge/models.py` defines `Concept`, `Skill`, `Task`, `Intent`, `Evidence`, `Decision (ADR)`, `Tool`, `UIComponent`, `Relationship`, `LearnerState`, `Experience`.

From those Pydantic models we generate, and commit into the app:
- `openapi.json` — the enterprise OpenAPI 3.1 contract (FastAPI's `.openapi()`)
- `schemas.json` — per-model JSON Schema (`model_json_schema()`)
- `seed.json` — the WJEC Unit 4 booking-system content

`python/lampforge/mcp_server.py` is the real **MCP Python SDK** server over the same models. `python/lampforge/api.py` is the FastAPI app. Both runnable locally by you; both readable inside the app.

The TanStack app never re-declares the domain in TS. It imports the generated JSON and derives types from it, so the grammar has exactly one author.

## Routes

**`/` — the Swagger playground (full contracts + study experience)**
Custom-built Swagger UI over the generated `openapi.json`, not the stock widget, so it carries pedagogy:
- operation cards grouped by tag: `/concepts`, `/adrs`, `/experiences`, `/learner`, `/evidence`, `/projects`
- schema explorer showing the Pydantic-generated JSON Schema, with model relationships
- **Try it out** hitting live edge endpoints in this app that mirror the FastAPI handlers, returning real JSON
- the links layer on every operation and ADR: `View JSON Schema`, `Open OpenAPI`, `View ADR`, `Inspect implementation`, `Ask about this decision`
- `POST /experiences` returns a structured experience description, and the playground renders it as **live Bootstrap UI beside the raw JSON**: endpoint → structured experience → rendered UI → interaction → underlying response
- ADR view: Context / Decision / Alternatives / Rationale / Consequences / Evidence / Learning connection, with the evidence graph as a navigable set of links

**`/inspect` — MCP Inspector**
Rebuild of the open-source MCP Inspector layout: server/connection pane, Tools / Resources / Prompts tabs, argument forms generated from the tool schemas, response viewer, JSON-RPC history log. It connects to a live MCP endpoint the app serves at `/api/public/mcp`, whose tool surface is generated from the same Pydantic schemas as the Python server (`list_concepts`, `get_adr`, `create_experience`, `explain`, `assess_evidence`, `get_learner_state`). The Python server file is viewable side by side as the canonical implementation.

**`/pde` — Pedagogical Development Environment**
Built from the AI Elements IDE example primitives: `FileTree`, `CodeBlock`, `Terminal`, `Plan`, `Queue`/`Task`, `Checkpoint`, `Conversation`, `PromptInput` — plus a live preview iframe of the learner's Bootstrap artefact.
What makes it a PDE rather than an IDE: the assistant's behaviour is bound to the learner's mode (I DO / WE DO / YOU DO), every accepted change can emit an ADR draft against the Pydantic `Decision` model, checkpoints are pedagogical states not just conversation states, and each artefact links back to the decision that produced it.
PHP/MySQL are authored files plus a simulated request/response and query trace. Export ships a zipped Bootstrap + PHP + `schema.sql` skeleton.

**`/chat` — conversational pedagogy**
Vercel AI SDK UI (`useChat`, `DefaultChatTransport`) streaming from a server route via the Lovable AI Gateway.
- explicit mode selector plus automatic I DO → WE DO → YOU DO transitions driven by learner state
- server-side tools whose schemas come from the generated Pydantic JSON Schema, rendered as **inline generative UI**: a live Bootstrap component, an ADR card, a Swagger operation, a code diff, an ERD — each carrying "inspect it, manipulate it, ask why it works, trace it back to the code, connect it to the decision that produced it"
- streamed reasoning shown as the teaching move, not hidden
- learner model updated from accuracy, response time, retries, hint requests, idle duration, retrieval success, time since last exposure, task difficulty

## Technical notes

- Chat/PDE UI is built from installed **AI Elements** components (`conversation`, `message`, `prompt-input`, `tool`, `file-tree`, `code-block`, `terminal`, `plan`, `queue`, `task`, `checkpoint`, `shimmer`).
- The published app runs on the TypeScript edge runtime, so the live "Try it out" and MCP endpoints are edge handlers driven by the generated contract; the Python FastAPI + MCP SDK server is the canonical, runnable reference in `python/`. A single generation script keeps them in lockstep.
- State (learner model, ADRs, projects, chat) sits behind one `store` interface, backed by browser storage for now; when you wire your Supabase it swaps at that interface with no change to the four surfaces.
- Needs a Lovable AI key for the chat and PDE assistant — provisioned during the build.
- Design: dark technical workbench, monospace accents, no generic AI-purple. Top rail switches route; the object under inspection persists across routes.

## Build order

1. `python/` Pydantic models + FastAPI + MCP server; generation script → `openapi.json`, `schemas.json`, `seed.json`
2. `/` Swagger playground with live Try-it-out and the ADR/links layer
3. `/inspect` MCP Inspector + live `/api/public/mcp`
4. `/chat` AI SDK UI with pedagogy modes and inline generative UI
5. `/pde` file tree, editor, preview, terminal, plan/queue, checkpoints, ADR emission, zip export
