# LAMPForge

A pedagogical runtime for WJEC Unit 4 (Linux · Apache · MySQL · PHP, plus Bootstrap).

Four surfaces over one contract. Everything the system teaches is an object you can open,
change, run, and trace back to the decision that produced it.

| Surface | Route | What it is |
|---|---|---|
| **Contract Playground & ADR Studio** | `/` | Swagger, rebuilt as a study instrument: 11 live operations, 14 recursive schemas, 6 ADRs with evidence. |
| **MCP Inspector** | `/inspector` | The Inspector experience in-app, wired to our own JSON-RPC 2.0 MCP server. |
| **PDE** | `/pde` | Pedagogical Development Environment — files, editor, plan, live preview, checkpoints, ADR emission. |
| **Conversational pedagogy** | `/chat` | Streaming tutor (Vercel AI SDK v7 + AI Elements) that answers in generative UI, not paragraphs. |

Product requirements, acceptance criteria and the full rationale live in [`PRD.md`](./PRD.md).
The design system lives in [`DESIGN.md`](./DESIGN.md).

---

## The idea

Most LAMP teaching material describes code that never runs and hides the decisions that
shaped it. LAMPForge holds a stricter bar for every artefact it produces:

1. **Inspectable** — open it, see its shape.
2. **Manipulable** — change it, see the consequence.
3. **Traceable to code** — the prose is joined to the source.
4. **Traceable to the decision** — every artefact links to its ADR.

On top of that sits gradual release. **I DO** models and narrates. **WE DO** starts and
hands over. **YOU DO** refuses to write the code and holds the success criteria instead.
Mode is global state: switch it in `/chat` and `/pde` changes what it will scaffold.

## Lineage: Pydantic is the source of truth

The domain exists once, in Python. Everything in `src/generated/` is emitted from it, and
nothing there is edited by hand.

```
python/lampforge/
  models.py       canonical domain model (Pydantic)
  seed.py         curriculum: 12 concepts · 6 ADRs · 7 evidence · 3 components · 3 tasks
  tool_io.py      MCP tool input/output models
  runtime.py      pedagogical logic: explain, build experience, assess evidence
  api.py          FastAPI app → the OpenAPI contract
  mcp_server.py   MCP server (Python SDK) over the same six tools
  generate.py     the seam: emits the four artefacts below
        │
        ▼
src/generated/openapi.json    11 paths
src/generated/schemas.json    14 JSON Schemas
src/generated/seed.json       all curriculum content
src/generated/tools.json      6 MCP tools + annotations
        │
        ▼
src/lib/lampforge.ts   typed accessors over the generated JSON
src/lib/runtime.ts     edge-safe TypeScript mirror of runtime.py
```

**Why the mirror?** The app deploys to an edge Worker runtime with no Python. The Python
package is the specification and reference implementation; the TypeScript mirror is the
deployment target. To change content or contract: edit Python, re-run the generator.

```bash
python3 -m lampforge.generate      # from ./python, writes src/generated/*.json
```

## Runtime map

```
src/routes/
  index.tsx                 Contract Playground + ADR Studio  (AdrView is shared with /chat)
  inspect.tsx               MCP Inspector
  pde.tsx                   Pedagogical Development Environment
  chat.tsx                  Conversational pedagogy
  api/v1/$.ts               catch-all implementing the OpenAPI contract
  api/public/mcp.ts         JSON-RPC 2.0 MCP endpoint
  api/chat.ts               AI SDK v7 stream over the Lovable AI Gateway
src/lib/store.ts            browser-local learner model, focus, ADR drafts, checkpoints
src/components/lampforge/   TopRail, AppShell, BootstrapFrame, Chip, Json, ModeSwitch, SchemaView
src/components/ai-elements/ vendored AI Elements primitives
```

### The six tools

`list_concepts` · `explain_concept` · `build_experience` · `show_adr` ·
`assess_evidence` · `get_learner_state`

They are defined once in Pydantic (`tool_io.py`), served three ways — as REST operations
(`/api/v1`), as MCP tools (`/api/public/mcp`), and as chat tools bound to generative UI
(`/api/chat`) — so the same grammar drives the Playground, the Inspector and the tutor.

### How the chat surface works

`useChat` (`@ai-sdk/react`) with a `DefaultChatTransport` posting `{ messages, mode }` to
`/api/chat`, which runs `streamText` against the Lovable AI Gateway with the six tools
bound and `stepCountIs(5)`, then returns a UI message stream with reasoning and sources
enabled.

The client renders the stream part by part:

- `text` → `MessageResponse` (Streamdown markdown: code, tables, math, mermaid)
- `reasoning` → collapsible `Reasoning`, auto-open while streaming; toggled by **teaching move**
- `tool-build_experience` → narration + live Bootstrap frame + PHP + SQL + affordances
- `tool-explain_concept` → concept card (vocabulary, common errors, example)
- `tool-show_adr` → the Playground's own `AdrView`
- `tool-list_concepts` → clickable concept chips
- anything else / in flight → the AI Elements `Tool` block with raw input and output

Every object the tutor touched becomes a **Source** citation linking back into the
contract, and every rendered object can be pinned to global **focus** so it follows you to
the other surfaces. Suggestions below the composer are mode-aware.

## Design system enforcement

`DESIGN.md` (Google DESIGN.md format, `@google/design.md`) is the only place a colour,
type role, radius or spacing step is defined: 18 colours including the `mode-i-do` /
`mode-we-do` / `mode-you-do` triad and the `method-get` / `method-post` verbs, 6
typography roles (IBM Plex Sans prose, JetBrains Mono machine truth), 22 component groups.

```bash
bun run design:lint     # lint DESIGN.md itself
bun run design:sync     # regenerate src/generated/design.tokens.css
bun run design:check    # lint → token drift → source usage guard  (CI gate)
```

`scripts/design/guard.mjs` fails on any hardcoded colour, raw hex, stock Tailwind palette
class or inline font family under `src/`. `scripts/design/vite-plugin-design-md.mjs` runs
the whole gate at dev-server start and on every `DESIGN.md` change, so drift is caught
while you type rather than in review.

## Development

```bash
bun install
bun run dev            # http://localhost:8080
bun run design:check
npx tsgo --noEmit      # typecheck
```

Environment: `LOVABLE_API_KEY` (server-side) powers `/api/chat`. Everything else runs
without configuration — learner state, ADR drafts and checkpoints persist in
`localStorage` under `lampforge.state.v1`.

## Stack

TanStack Start v1 (React 19, Vite 7, edge Worker target) · Tailwind CSS v4 via
`src/styles.css` · shadcn/ui + vendored AI Elements · Vercel AI SDK v7 · Pydantic +
FastAPI + the MCP Python SDK as the contract source.

## Status and non-goals

No server persistence, no auth, no teacher dashboard, and no live PHP/MySQL execution yet
— PHP and SQL are shown and reasoned about; Bootstrap is what actually runs, in a
sandboxed frame. The store interface is deliberately swappable for a backend.
