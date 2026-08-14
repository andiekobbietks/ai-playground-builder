# LAMPForge — Product Requirements Document

**Status:** living document · **Version:** 1.0 · **Owner:** LAMPForge Studio
**Scope:** the four product surfaces (`/`, `/inspector`, `/pde`, `/chat`), the contract
layer that feeds them, and the design system that constrains them.

---

## 1. Problem

WJEC Unit 4 (LAMP: Linux, Apache, MySQL, PHP — plus Bootstrap on the front end) is
taught as a pile of disconnected artefacts: slide decks that describe code, code that
never runs, exam vocabulary detached from the thing it names, and decisions that exist
only in the teacher's head. A learner can pass a knowledge check about prepared
statements and still write an injectable query, because nothing in the material ever
made the decision visible, runnable, and traceable at the same time.

LAMPForge exists to collapse that distance. Every teaching object in the system is:

1. **Inspectable** — you can open it and see its shape (a JSON Schema, an AST, an ADR).
2. **Manipulable** — you can change it and immediately see the consequence.
3. **Traceable to code** — the prose is generated from, or joined to, the actual source.
4. **Traceable to the decision** — every artefact links to the ADR that produced it.

Those four properties are the acceptance bar for **every** feature below. A feature that
teaches but cannot be inspected is not done.

## 2. Pedagogical model (non-negotiable)

### 2.1 Gradual release — the mode triad

| Mode | Token | Contract |
|---|---|---|
| **I DO** | `mode-i-do` | The system performs the whole move and narrates every decision as it makes it. Code is shown in full. |
| **WE DO** | `mode-we-do` | The system performs the first step, then hands the next concrete step to the learner. It never finishes the artefact. |
| **YOU DO** | `mode-you-do` | The system produces no solution code. It holds the success criteria, asks first, and responds only to what the learner produced — naming the criterion each response meets or misses. |

Mode is **global learner state**, not a per-surface toggle. Changing mode in `/chat`
changes what `/pde` will scaffold and what `/` reveals in a study card. This is enforced
by a single store (`src/lib/store.ts`) shared by all four surfaces.

### 2.2 The learner model

Eight signals drive adaptation: `accuracy`, `median_response_ms`, `retries`,
`hint_requests`, `idle_seconds`, `successful_retrievals` / `failed_retrievals`,
`seconds_since_last_exposure`, `task_difficulty`. Plus two concept sets:
`mastered_concept_ids` and `emerging_concept_ids`.

The model is **visible to the learner at all times** on `/chat`. Adaptation that a
learner cannot see is manipulation, not pedagogy.

### 2.3 Conversational pedagogy

The tutor's job is not to answer. It is to make the next teaching move, then hand back
control. Enforced in the system prompt and observable in the UI:

- Prefer a **tool call** over recall — tools return canonical objects, the UI renders them.
- After each tool result, **name the move**: why this object, what to notice, what next.
- **Short prose.** One idea per paragraph.
- **End with exactly one actionable question.**
- Correct loose vocabulary gently, using WJEC terms.

## 3. Architecture lineage

### 3.1 Pydantic is the source of truth

The domain is defined once, in Python, with Pydantic. Everything else is generated or
mirrors it.

```
python/lampforge/models.py     ← canonical domain model (Pydantic)
python/lampforge/seed.py       ← curriculum content: concepts, ADRs, evidence, components
python/lampforge/tool_io.py    ← MCP tool input/output models
python/lampforge/runtime.py    ← pedagogical logic (explain, build, assess)
python/lampforge/api.py        ← FastAPI app → OpenAPI contract
python/lampforge/mcp_server.py ← MCP server (Python SDK) over the same tools
python/lampforge/generate.py   ← emits the artefacts below
        │
        ▼
src/generated/openapi.json     ← 11 paths, the contract the Playground teaches
src/generated/schemas.json     ← 14 JSON Schemas, the Schema Explorer's material
src/generated/seed.json        ← 12 concepts · 6 ADRs · 7 evidence · 3 components · 3 tasks
src/generated/tools.json       ← 6 MCP tools with schemas + annotations
        │
        ▼
src/lib/lampforge.ts           ← typed accessors over the generated JSON
src/lib/runtime.ts             ← edge-safe TS mirror of runtime.py (live execution)
```

**Why a mirror and not a Python host?** The app deploys to an edge Worker runtime with no
Python. The Python package is the *specification and the reference implementation*; the
TypeScript mirror is the *deployment target*. `generate.py` is the seam that keeps them
honest — any content or contract change is made in Python and regenerated, never edited
in `src/generated/`.

### 3.2 Runtime surfaces

| Route | Purpose |
|---|---|
| `src/routes/api/v1/$.ts` | Catch-all server route implementing the OpenAPI contract — what the Playground actually calls. |
| `src/routes/api/public/mcp.ts` | JSON-RPC 2.0 MCP endpoint (`initialize`, `tools/list`, `tools/call`, `resources/*`, `prompts/*`) — what the Inspector actually calls. |
| `src/routes/api/chat.ts` | Vercel AI SDK v7 stream over the Lovable AI Gateway, with the 6 pedagogy tools bound as generative UI. |

## 4. Surfaces and acceptance criteria

### 4.1 `/` — Contract Playground & ADR Studio

The Swagger experience, rebuilt as a teaching instrument rather than a reference dump.

**Acceptance criteria**

- **AC-P1** Every one of the 11 operations is listed with method token colouring
  (`method-get` / `method-post`), path, summary, and its `operationId`.
- **AC-P2** Selecting an operation shows request schema, response schema and a **Try it**
  panel that issues a real request to `/api/v1/*` and renders the live response.
- **AC-P3** The Schema Explorer expands any of the 14 schemas recursively — every field
  shows type, required-ness, description and enum members.
- **AC-P4** Each operation carries a **pedagogy panel**: what this endpoint teaches, the
  concepts it exercises, and the ADR that shaped it.
- **AC-P5** ADR Studio lists all 6 ADRs with context / decision / consequences /
  alternatives-considered and the evidence attached to each.
- **AC-P6** Every ADR is deep-linkable (`/#adr-<id>`) so chat citations land on it.
- **AC-P7** Selecting anything sets global focus; that focus survives navigation to the
  other three surfaces.

### 4.2 `/inspector` — MCP Inspector

The open-source Inspector experience, in-app, against our own server.

- **AC-I1** Live registry of the 6 tools with title, description, annotations
  (read-only / destructive / idempotent hints) and full input schema.
- **AC-I2** Resources and prompts listed from the same server, via real
  `resources/list` and `prompts/list` calls.
- **AC-I3** A form generated from each tool's input schema; **Call tool** issues a real
  JSON-RPC request and renders the structured result.
- **AC-I4** A JSON-RPC transcript pane showing every request and response frame,
  including `id`, method and elapsed time — the wire is never hidden.
- **AC-I5** Errors surface as JSON-RPC error objects, not as toast text.

### 4.3 `/pde` — Pedagogical Development Environment

The IDE surface, built from AI Elements primitives, where the learner produces.

- **AC-D1** File tree + editor over the working project, with the live Bootstrap preview
  rendered in a sandboxed frame.
- **AC-D2** A **plan** pane (AI Elements `Plan` / `Task`) showing the steps the tutor has
  committed to, with per-step state.
- **AC-D3** Mode gating: in **YOU DO** the environment refuses to write solution code and
  shows success criteria instead.
- **AC-D4** **Emit ADR** captures the current decision as a draft ADR in the store; drafts
  appear alongside the seeded 6 in ADR Studio.
- **AC-D5** Checkpoints record `{label, mode, timestamp}` so a session has a history.
- **AC-D6** Terminal/console output is rendered with the AI Elements `Terminal` primitive.

### 4.4 `/chat` — Conversational pedagogy

The heart of the product. Vercel AI SDK v7 `useChat` + AI Elements, streaming.

- **AC-C1** Streaming responses via `DefaultChatTransport` → `/api/chat`, with visible
  `submitted` / `streaming` / `ready` / `error` states and a working **stop**.
- **AC-C2** Markdown rendering through `MessageResponse` (Streamdown): code blocks,
  tables, math and mermaid.
- **AC-C3** **Reasoning** parts render in a collapsible `Reasoning` block that auto-opens
  while streaming and auto-closes when it ends; a **teaching move** toggle hides it.
- **AC-C4** **Generative UI per tool** — each tool result renders as its own object:
  - `build_experience` → narration + live Bootstrap frame + PHP + SQL + affordances
  - `explain_concept` → concept card with vocabulary, common errors, code example
  - `show_adr` → the same `AdrView` component the Playground uses (one component, two surfaces)
  - `list_concepts` → clickable concept chips
  - `assess_evidence` / `get_learner_state` → inspectable `Tool` block with raw I/O
  - anything in flight → `Tool` header with live state and input
- **AC-C5** **Sources**: every object the tutor touched becomes a citation linking back
  into the contract (`/#adr-…`, `/#concept-…`, `/#op-…`), de-duplicated per message.
- **AC-C6** **Message actions**: copy, regenerate, and *take to the PDE*.
- **AC-C7** **Mode-aware suggestions** — the suggestion row offers only moves the current
  mode permits (I DO asks for demonstration; YOU DO asks for assessment).
- **AC-C8** The learner model panel is always visible and updates from the store.
- **AC-C9** Every rendered object can be pinned to global focus (**keep in focus**).
- **AC-C10** No layout shift or hidden scroll traps: the conversation owns its scroll and
  offers a scroll-to-bottom affordance.

## 5. Design system requirements

- **DS-1** `DESIGN.md` at the repo root is the single source of design truth: 18 colour
  tokens, 6 typography roles, 3 radii, 5 spacing steps, 22 component groups.
- **DS-2** Tokens are exported to `src/generated/design.tokens.css` by
  `scripts/design/sync.mjs`; the file is generated, never hand-edited.
- **DS-3** `scripts/design/guard.mjs` fails the build on any hardcoded colour, raw hex,
  stock Tailwind palette class, arbitrary `bg-[#…]` or inline font family in `src/`.
- **DS-4** `scripts/design/check.mjs` chains lint → token drift → usage guard and runs
  headlessly, both as `bun run design:check` and as a Vite plugin on dev start and on any
  `DESIGN.md` change.
- **DS-5** Semantic tokens only in components. The mode triad and the HTTP verb colours
  are tokens (`mode-i-do`, `mode-we-do`, `mode-you-do`, `method-get`, `method-post`) so
  pedagogy and protocol are visually consistent across all four surfaces.
- **DS-6** Type: IBM Plex Sans for prose, JetBrains Mono for machine truth. Machine truth
  (schemas, JSON-RPC frames, code, learner metrics) is *always* monospace.

## 6. Non-goals (current version)

- No server-side persistence. State is browser-local (`lampforge.state.v1`) so the whole
  system runs without a backend. The store interface is written to be swappable.
- No multi-learner / teacher dashboard.
- No authentication.
- No live PHP/MySQL execution — PHP and SQL are shown, explained and reasoned about; the
  runnable surface is Bootstrap in a sandboxed frame.

## 7. Definition of done

A change is done when: `bun run design:check` is clean, `tsgo --noEmit` is clean, the
Python generator has been re-run if any contract or content changed, and the touched
surface still satisfies every AC listed above for it.
