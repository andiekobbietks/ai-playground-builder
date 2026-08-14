"""FastAPI projection of the canonical model.

This app is the authored source of the OpenAPI contract. `generate.py` dumps
`app.openapi()` to `src/generated/openapi.json`, which the web playground
renders and whose operations the edge handlers mirror one-for-one.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query

from . import runtime
from .models import (
    Concept,
    Decision,
    Depth,
    Evidence,
    Experience,
    ExperienceRequest,
    LearnerState,
    Project,
    Stack,
    Task,
)
from .tool_io import AssessEvidenceInput, AssessmentResult, ExplainInput

app = FastAPI(
    title="LAMPForge API",
    version="1.0.0",
    description=(
        "The grammar of the learning experience. Every operation below is a projection "
        "of the same Pydantic model that drives the MCP tools, the chat tools and the PDE."
    ),
)


@app.get("/concepts", response_model=List[Concept], tags=["concepts"], operation_id="listConcepts")
def list_concepts(
    stack: Optional[Stack] = Query(default=None, description="Filter by stack layer."),
    depth: Optional[Depth] = Query(default=None, description="Filter by depth."),
    query: Optional[str] = Query(default=None, description="Free-text match."),
) -> List[Concept]:
    """List the concepts in the curriculum graph."""
    return runtime.list_concepts(stack, depth, query)


@app.get("/concepts/{concept_id}", response_model=Concept, tags=["concepts"], operation_id="getConcept")
def get_concept(concept_id: str) -> Concept:
    """Fetch one concept with its vocabulary, errors and relationships."""
    concept = runtime.get_concept(concept_id)
    if concept is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    return concept


@app.get("/adrs", response_model=List[Decision], tags=["adrs"], operation_id="listAdrs")
def list_adrs(project_id: Optional[str] = None) -> List[Decision]:
    """List Architectural Decision Records."""
    return runtime.list_decisions(project_id)


@app.get("/adrs/{decision_id}", response_model=Decision, tags=["adrs"], operation_id="getAdr")
def get_adr(decision_id: str) -> Decision:
    """Fetch a full ADR: context, decision, alternatives, rationale, consequences."""
    decision = runtime.get_decision(decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail="ADR not found")
    return decision


@app.get(
    "/adrs/{decision_id}/evidence",
    response_model=List[Evidence],
    tags=["evidence"],
    operation_id="getAdrEvidence",
)
def get_adr_evidence(decision_id: str) -> List[Evidence]:
    """The evidence attached to a decision."""
    return runtime.evidence_for(decision_id)


@app.post("/experiences", response_model=Experience, tags=["experiences"], operation_id="createExperience")
def create_experience(request: ExperienceRequest) -> Experience:
    """Turn an intent into a structured experience: narration, renderable component, PHP and SQL."""
    return runtime.create_experience(request)


@app.post("/explain", tags=["experiences"], operation_id="explainConcept")
def explain(request: ExplainInput) -> dict:
    """Explain a concept at the learner's current pedagogy mode."""
    try:
        return runtime.explain(request.concept_id, request.mode)
    except KeyError as exc:  # pragma: no cover - contract shape
        raise HTTPException(status_code=404, detail="Concept not found") from exc


@app.get("/learner/{learner_id}", response_model=LearnerState, tags=["learner"], operation_id="getLearnerState")
def get_learner(learner_id: str) -> LearnerState:
    """The learner model: mode, mastery, retrieval history and interaction signals."""
    return runtime.get_learner(learner_id)


@app.post("/evidence/assess", response_model=AssessmentResult, tags=["evidence"], operation_id="assessEvidence")
def assess_evidence(request: AssessEvidenceInput) -> AssessmentResult:
    """Score a piece of learner evidence against the concepts it claims to demonstrate."""
    return runtime.assess_evidence(request.concept_ids, request.body, request.learner_id)


@app.get("/tasks", response_model=List[Task], tags=["projects"], operation_id="listTasks")
def list_tasks() -> List[Task]:
    """The task ladder for the current project."""
    return runtime.SEED.tasks


@app.get("/projects", response_model=List[Project], tags=["projects"], operation_id="listProjects")
def list_projects() -> List[Project]:
    """Learner projects and the decisions attached to them."""
    return runtime.SEED.projects
