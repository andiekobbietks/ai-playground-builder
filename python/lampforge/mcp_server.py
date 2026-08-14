"""LAMPForge MCP server, written with the official Python MCP SDK.

    pip install -e python                          # installs the pinned SDK
    python -m lampforge.mcp_server                 # stdio (official Inspector)
    python -m lampforge.mcp_server --http          # Streamable HTTP on :8000/mcp
    mcp dev python/lampforge/mcp_server.py         # official Inspector, stdio

Connect the mcp-use inspector (npx @mcp-use/inspector) or the official
Inspector to the HTTP transport at http://localhost:8000/mcp — the same
Streamable HTTP grammar the app's edge endpoint (/api/public/mcp) speaks.

Every tool's input schema is a Pydantic model from `tool_io.py`, so this server
and the HTTP API expose the same grammar. The app's edge MCP endpoint mirrors
this tool surface exactly; this file is the canonical implementation.

The SDK pin lives in `pyproject.toml`: FastMCP here targets the mcp 1.x API
(`mcp.server.fastmcp`), which mcp 2.0.0 relocated, so 2.x is excluded there.
"""

from __future__ import annotations

import argparse
import json

from mcp.server.fastmcp import FastMCP

from . import runtime
from .models import Depth, ExperienceRequest, PedagogyMode, Stack

mcp = FastMCP(
    "lampforge",
    instructions=(
        "Tools for LAMPForge, a pedagogical runtime for WJEC Unit 4 LAMP projects. "
        "Read the learner state before teaching: it decides whether to model (i_do), "
        "co-construct (we_do) or step back (you_do). Never hand over code in you_do mode."
    ),
)


@mcp.tool()
def list_concepts(stack: Stack | None = None, depth: Depth | None = None, query: str | None = None) -> str:
    """List the LAMP concepts in the curriculum graph."""
    items = runtime.list_concepts(stack, depth, query)
    return json.dumps([c.model_dump(mode="json") for c in items], indent=2)


@mcp.tool()
def get_adr(id: str, include_evidence: bool = True) -> str:
    """Fetch a full Architectural Decision Record with its evidence and concept links."""
    decision = runtime.get_decision(id)
    if decision is None:
        raise ValueError(f"No such ADR: {id}")
    payload = {"decision": decision.model_dump(mode="json")}
    if include_evidence:
        payload["evidence"] = [e.model_dump(mode="json") for e in runtime.evidence_for(id)]
    return json.dumps(payload, indent=2)


@mcp.tool()
def create_experience(
    intent: str,
    mode: PedagogyMode = PedagogyMode.WE_DO,
    concept_ids: list[str] | None = None,
    learner_id: str = "demo-learner",
) -> str:
    """Turn an intent into a structured experience: narration, Bootstrap component, PHP and SQL."""
    request = ExperienceRequest(
        intent=intent, mode=mode, concept_ids=concept_ids or [], learner_id=learner_id
    )
    return json.dumps(runtime.create_experience(request).model_dump(mode="json"), indent=2)


@mcp.tool()
def explain(concept_id: str, mode: PedagogyMode = PedagogyMode.WE_DO) -> str:
    """Explain a concept at the learner's current pedagogy mode."""
    return json.dumps(runtime.explain(concept_id, mode), indent=2, default=str)


@mcp.tool()
def assess_evidence(concept_ids: list[str], body: str, learner_id: str = "demo-learner") -> str:
    """Score a piece of learner evidence against the concepts it claims to demonstrate."""
    result = runtime.assess_evidence(concept_ids, body, learner_id)
    return json.dumps(result.model_dump(mode="json"), indent=2)


@mcp.tool()
def get_learner_state(learner_id: str = "demo-learner") -> str:
    """Return the learner model: mode, mastery, retrieval history and interaction signals."""
    return json.dumps(runtime.get_learner(learner_id).model_dump(mode="json"), indent=2)


@mcp.resource("lampforge://seed")
def seed_resource() -> str:
    """The full seeded curriculum, projects and decisions."""
    return runtime.SEED.model_dump_json(indent=2)


@mcp.prompt()
def teach(concept_id: str, mode: str = "we_do") -> str:
    """A teaching prompt bound to the gradual-release mode."""
    return (
        f"Teach the concept '{concept_id}' in {mode} mode. "
        "In i_do, model the whole move and narrate each decision. "
        "In we_do, do the first step and hand over the next. "
        "In you_do, ask first and respond only to what the learner produces."
    )


def main() -> None:
    """Run over stdio by default, or Streamable HTTP with --http.

    Both transports serve the identical tool surface; the HTTP transport is
    what a browser inspector (official or mcp-use) connects to.
    """
    parser = argparse.ArgumentParser(description="LAMPForge MCP server")
    parser.add_argument(
        "--http",
        action="store_true",
        help="Serve Streamable HTTP at http://<host>:<port>/mcp instead of stdio.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="HTTP host (default 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port (default 8000).")
    args = parser.parse_args()

    if args.http:
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        mcp.run(transport="streamable-http")
    else:
        mcp.run()


if __name__ == "__main__":
    main()
