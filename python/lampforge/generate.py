"""Generate the artefacts the web runtime consumes.

    /tmp/pyenv/bin/python -m lampforge.generate

Emits into src/generated/:
  openapi.json  — the enterprise contract (FastAPI, from the Pydantic models)
  schemas.json  — per-model JSON Schema (model_json_schema)
  seed.json     — the WJEC Unit 4 booking-system content
  tools.json    — the MCP tool surface with generated input schemas
"""

from __future__ import annotations

import json
from pathlib import Path

from .api import app
from .models import (
    Concept,
    Decision,
    Evidence,
    Experience,
    ExperienceRequest,
    Intent,
    LearnerState,
    Project,
    Relationship,
    Skill,
    Task,
    Tool,
    UIComponent,
)
from .seed import build_seed
from .tool_io import (
    AssessEvidenceInput,
    AssessmentResult,
    ExplainInput,
    GetAdrInput,
    GetLearnerStateInput,
    ListConceptsInput,
)

OUT = Path(__file__).resolve().parents[2] / "src" / "generated"

MODELS = [
    Concept,
    Skill,
    Task,
    Intent,
    Evidence,
    Decision,
    UIComponent,
    Relationship,
    LearnerState,
    ExperienceRequest,
    Experience,
    Project,
    Tool,
    AssessmentResult,
]

TOOL_INPUTS = {
    "ListConceptsInput": ListConceptsInput,
    "GetAdrInput": GetAdrInput,
    "ExperienceRequest": ExperienceRequest,
    "ExplainInput": ExplainInput,
    "AssessEvidenceInput": AssessEvidenceInput,
    "GetLearnerStateInput": GetLearnerStateInput,
}


def write(name: str, payload: object) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(OUT.parents[2])}")


def main() -> None:
    seed = build_seed()

    write("openapi.json", app.openapi())
    write("schemas.json", {m.__name__: m.model_json_schema() for m in MODELS})
    write("seed.json", json.loads(seed.model_dump_json()))
    write(
        "tools.json",
        [
            {
                "name": t.name,
                "title": t.title,
                "description": t.description,
                "readOnly": t.read_only,
                "inputSchema": TOOL_INPUTS[t.input_schema_ref].model_json_schema(),
            }
            for t in seed.tools
        ],
    )


if __name__ == "__main__":
    main()
