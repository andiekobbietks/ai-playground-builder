"""LAMPForge canonical domain model.

This is the single source of truth for the whole platform. The OpenAPI
contract, the JSON Schemas, the MCP tool surface and the chat tool schemas
are all *projections* of the Pydantic models defined here.

Nothing downstream re-declares the domain. Run `python -m lampforge.generate`
to emit the artefacts the web runtime consumes.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Enumerations — the vocabulary of the learning runtime
# --------------------------------------------------------------------------


class PedagogyMode(str, Enum):
    """Gradual release of responsibility."""

    I_DO = "i_do"
    WE_DO = "we_do"
    YOU_DO = "you_do"


class Depth(str, Enum):
    FOUNDATION = "foundation"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Stack(str, Enum):
    HTML = "html"
    CSS = "css"
    BOOTSTRAP = "bootstrap"
    PHP = "php"
    MYSQL = "mysql"
    JAVASCRIPT = "javascript"
    ARCHITECTURE = "architecture"


class DecisionStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    SUPERSEDED = "superseded"


class DecisionType(str, Enum):
    DATA_ARCHITECTURE = "data_architecture"
    INTERFACE_DESIGN = "interface_design"
    ALGORITHM = "algorithm"
    SECURITY = "security"
    PLANNING = "planning"
    TESTING = "testing"


class RelationKind(str, Enum):
    REQUIRES = "requires"
    USES = "uses"
    DEMONSTRATED_BY = "demonstrated_by"
    EVIDENCED_BY = "evidenced_by"
    ASSESSED_AGAINST = "assessed_against"
    SUPERSEDES = "supersedes"


class EvidenceKind(str, Enum):
    CODE = "code"
    SCHEMA = "schema"
    TEST = "test"
    EXPLANATION = "explanation"
    ARTEFACT = "artefact"
    INTERACTION = "interaction"


# --------------------------------------------------------------------------
# Core objects
# --------------------------------------------------------------------------


class Relationship(BaseModel):
    """A typed edge in the learning graph."""

    kind: RelationKind
    target: str = Field(description="Stable id of the related object.")
    note: Optional[str] = None


class Concept(BaseModel):
    id: str = Field(description="Stable slug, e.g. 'crud'.")
    title: str
    stack: Stack
    depth: Depth
    summary: str
    vocabulary: List[str] = Field(default_factory=list)
    common_errors: List[str] = Field(default_factory=list)
    code_example: Optional[str] = None
    relationships: List[Relationship] = Field(default_factory=list)
    wjec_reference: Optional[str] = Field(
        default=None, description="WJEC Unit 4 specification reference."
    )


class Skill(BaseModel):
    id: str
    title: str
    concept_ids: List[str] = Field(default_factory=list)
    observable_behaviour: str = Field(
        description="What the learner can be seen doing when they hold this skill."
    )


class Task(BaseModel):
    id: str
    title: str
    prompt: str
    concept_ids: List[str] = Field(default_factory=list)
    difficulty: int = Field(description="1 (recall) to 5 (transfer).")
    mode: PedagogyMode
    success_criteria: List[str] = Field(default_factory=list)


class Intent(BaseModel):
    """The parsed shape of anything a learner asks, from any surface."""

    verb: str = Field(description="explain | build | inspect | assess | trace | compare")
    subject: str = Field(description="Concept, ADR, artefact or file id.")
    mode: PedagogyMode = PedagogyMode.WE_DO
    surface: str = Field(default="chat", description="chat | voice | swagger | mcp | pde")
    raw: Optional[str] = None


class Evidence(BaseModel):
    id: str
    kind: EvidenceKind
    concept_ids: List[str] = Field(default_factory=list)
    decision_id: Optional[str] = None
    body: str
    created_at: Optional[datetime] = None


class Decision(BaseModel):
    """An Architectural Decision Record, authored by or with the learner."""

    id: str = Field(description="e.g. 'ADR-018'.")
    title: str
    status: DecisionStatus
    type: DecisionType
    depth: Depth
    project_id: str
    context: str
    decision: str
    alternatives: List[str] = Field(default_factory=list)
    rationale: str
    consequences: List[str] = Field(default_factory=list)
    evidence_ids: List[str] = Field(default_factory=list)
    concept_ids: List[str] = Field(default_factory=list)
    word_count_target: int = Field(
        default=250, description="Suggested NEA word budget for this decision type."
    )


class UIComponent(BaseModel):
    """A renderable Bootstrap artefact returned by an experience."""

    id: str
    label: str
    bootstrap_classes: List[str] = Field(default_factory=list)
    html: str
    concept_ids: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class Tool(BaseModel):
    """A capability exposed to agents over MCP."""

    name: str
    title: str
    description: str
    read_only: bool = True
    input_schema_ref: str = Field(description="Name of the Pydantic input model.")


class LearnerState(BaseModel):
    learner_id: str
    mode: PedagogyMode
    accuracy: float = Field(description="Rolling proportion correct, 0-1.")
    median_response_ms: int
    retries: int
    hint_requests: int
    idle_seconds: int
    successful_retrievals: int
    failed_retrievals: int
    seconds_since_last_exposure: int
    task_difficulty: int
    mastered_concept_ids: List[str] = Field(default_factory=list)
    emerging_concept_ids: List[str] = Field(default_factory=list)


class ExperienceRequest(BaseModel):
    """What a learner asks the runtime to produce."""

    intent: str = Field(description="Natural language, e.g. 'Create a booking form.'")
    mode: PedagogyMode = PedagogyMode.WE_DO
    concept_ids: List[str] = Field(default_factory=list)
    learner_id: str = "demo-learner"


class Experience(BaseModel):
    """A structured experience description — the multi-representation object."""

    id: str
    intent: Intent
    mode: PedagogyMode
    narration: str = Field(description="What the runtime says while presenting this.")
    component: UIComponent
    php: Optional[str] = None
    sql: Optional[str] = None
    concept_ids: List[str] = Field(default_factory=list)
    decision_id: Optional[str] = None
    follow_up_questions: List[str] = Field(default_factory=list)
    affordances: List[str] = Field(
        default_factory=lambda: [
            "inspect",
            "manipulate",
            "ask_why",
            "trace_to_code",
            "trace_to_decision",
        ]
    )


class Project(BaseModel):
    id: str
    title: str
    brief: str
    concept_ids: List[str] = Field(default_factory=list)
    decision_ids: List[str] = Field(default_factory=list)
    files: List[str] = Field(default_factory=list)


class Seed(BaseModel):
    """Everything the runtime boots with."""

    concepts: List[Concept]
    skills: List[Skill]
    tasks: List[Task]
    decisions: List[Decision]
    evidence: List[Evidence]
    components: List[UIComponent]
    projects: List[Project]
    learner: LearnerState
    tools: List[Tool]
