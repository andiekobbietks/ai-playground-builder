# LAMPForge — canonical Pydantic model

Everything the platform exposes is a **projection of the Pydantic models in
`lampforge/models.py`**. Nothing downstream re-declares the domain:

| Surface | Generated from | Emitted to |
| --- | --- | --- |
| OpenAPI contract | `api.py` (FastAPI) | `src/generated/openapi.json` |
| JSON Schemas | `models.py` | `src/generated/schemas.json` |
| MCP tool surface | `tool_io.py` | `src/generated/tools.json` |
| Seed curriculum | `seed.py` | `src/generated/seed.json` |

The TypeScript edge runtime (`src/lib/runtime.ts`, `src/routes/api/public/mcp.ts`)
mirrors this behaviour one-for-one so the browser surfaces work without a Python
process; this package is the source of truth.

## Setup (reproducible, pinned)

The SDK pins live in `pyproject.toml`. The FastMCP API this server targets is in
the **mcp 1.x** line — `mcp 2.0.0` relocated `mcp.server.fastmcp`, so it is
explicitly excluded.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e python            # installs pydantic, fastapi, mcp[cli]>=1.29,<2, uvicorn
```

## Regenerate the artefacts the web app consumes

```bash
python -m lampforge.generate     # writes the four files into src/generated/
```

The build is deterministic: re-running against unchanged models produces no diff.

## Run the MCP server

```bash
python -m lampforge.mcp_server                 # stdio (for `mcp dev` / official Inspector)
python -m lampforge.mcp_server --http          # Streamable HTTP at http://127.0.0.1:8000/mcp
mcp dev lampforge/mcp_server.py                # official Inspector, stdio
```

## Connect an inspector

Both the **official MCP Inspector** and the **[mcp-use inspector](https://github.com/mcp-use/inspector)**
speak the MCP Streamable HTTP transport. Point either at:

- the canonical Python server: `http://127.0.0.1:8000/mcp` (after `--http`)
- the deployed edge mirror: `https://<your-app>/api/public/mcp`

```bash
# mcp-use inspector, self-hosted
npx @mcp-use/inspector          # or: docker run -p 8080:8080 mcpuse/inspector:latest
# then add a "Streamable HTTP" connection to one of the URLs above
```

The app also ships an in-browser inspector at `/inspect` that talks to the edge
endpoint and shows every JSON-RPC frame.
