"""Input models for the MCP tool surface.

Each MCP tool's `inputSchema` is `model_json_schema()` of one of these, so the
tool contract and the API contract are generated from the same declarations.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from .models import Depth, PedagogyMode, Stack


class ListConceptsInput(BaseModel):
    stack: Optional[Stack] = Field(default=None, description="Filter by stack layer.")
    depth: Optional[Depth] = Field(default=None, description="Filter by depth.")
    query: Optional[str] = Field(default=None, description="Free-text match on title and summary.")


class GetAdrInput(BaseModel):
    id: str = Field(description="ADR id, e.g. 'ADR-018'.")
    include_evidence: bool = Field(default=True)


class ExplainInput(BaseModel):
    concept_id: str
    mode: PedagogyMode = PedagogyMode.WE_DO
    learner_id: str = "demo-learner"


class AssessEvidenceInput(BaseModel):
    concept_ids: List[str]
    body: str = Field(description="What the learner wrote, built or said.")
    learner_id: str = "demo-learner"


class GetLearnerStateInput(BaseModel):
    learner_id: str = "demo-learner"


class AssessmentResult(BaseModel):
    concept_ids: List[str]
    verdict: str = Field(description="secure | developing | not_evidenced")
    reasoning: str
    next_mode: PedagogyMode
    suggested_decision_id: Optional[str] = None
