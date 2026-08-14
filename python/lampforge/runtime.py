"""Pure runtime logic shared by the FastAPI app and the MCP server.

Deliberately free of framework imports so both surfaces are thin projections.
"""

from __future__ import annotations

from typing import List, Optional

from .models import (
    Concept,
    Decision,
    Depth,
    Evidence,
    Experience,
    ExperienceRequest,
    Intent,
    LearnerState,
    PedagogyMode,
    Stack,
    UIComponent,
)
from .seed import build_seed
from .tool_io import AssessmentResult

SEED = build_seed()


# --------------------------------------------------------------------------
# Reads
# --------------------------------------------------------------------------


def list_concepts(
    stack: Optional[Stack] = None,
    depth: Optional[Depth] = None,
    query: Optional[str] = None,
) -> List[Concept]:
    items = SEED.concepts
    if stack:
        items = [c for c in items if c.stack == stack]
    if depth:
        items = [c for c in items if c.depth == depth]
    if query:
        q = query.lower()
        items = [c for c in items if q in c.title.lower() or q in c.summary.lower()]
    return items


def get_concept(concept_id: str) -> Optional[Concept]:
    return next((c for c in SEED.concepts if c.id == concept_id), None)


def list_decisions(project_id: Optional[str] = None) -> List[Decision]:
    if project_id:
        return [d for d in SEED.decisions if d.project_id == project_id]
    return SEED.decisions


def get_decision(decision_id: str) -> Optional[Decision]:
    return next((d for d in SEED.decisions if d.id == decision_id), None)


def evidence_for(decision_id: str) -> List[Evidence]:
    return [e for e in SEED.evidence if e.decision_id == decision_id]


def get_learner(learner_id: str = "demo-learner") -> LearnerState:
    return SEED.learner.model_copy(update={"learner_id": learner_id})


# --------------------------------------------------------------------------
# Pedagogy
# --------------------------------------------------------------------------

_MODE_NARRATION = {
    PedagogyMode.I_DO: "Watch first. I'll build it and narrate every decision as I make it.",
    PedagogyMode.WE_DO: "We'll build this together. I'll start it; you decide the next move.",
    PedagogyMode.YOU_DO: "Your turn. I'll hold the criteria and answer questions, but the moves are yours.",
}


def next_mode(state: LearnerState) -> PedagogyMode:
    """Gradual release, driven by the interaction signals."""
    retrieval_total = state.successful_retrievals + state.failed_retrievals
    retrieval_rate = state.successful_retrievals / retrieval_total if retrieval_total else 0.0
    struggling = state.hint_requests >= 3 or state.retries >= 4 or state.accuracy < 0.5
    secure = state.accuracy >= 0.8 and retrieval_rate >= 0.7 and state.hint_requests <= 1

    if struggling:
        return PedagogyMode.I_DO if state.mode == PedagogyMode.WE_DO else PedagogyMode.WE_DO
    if secure:
        return PedagogyMode.YOU_DO if state.mode == PedagogyMode.WE_DO else PedagogyMode.WE_DO
    return state.mode


def explain(concept_id: str, mode: PedagogyMode = PedagogyMode.WE_DO) -> dict:
    concept = get_concept(concept_id)
    if concept is None:
        raise KeyError(concept_id)
    if mode == PedagogyMode.I_DO:
        body = f"{concept.summary} Here is the worked form: {concept.code_example or 'see the artefact'}"
    elif mode == PedagogyMode.WE_DO:
        body = f"{concept.summary} Given that, what would you change first?"
    else:
        body = f"Before I say anything: describe {concept.title.lower()} in your own words, then I'll respond to what you said."
    return {
        "concept": concept.model_dump(),
        "mode": mode.value,
        "narration": _MODE_NARRATION[mode],
        "body": body,
        "watch_for": concept.common_errors,
        "vocabulary": concept.vocabulary,
    }


def assess_evidence(concept_ids: List[str], body: str, learner_id: str = "demo-learner") -> AssessmentResult:
    """Heuristic assessment. The chat runtime replaces this with a model call."""
    text = body.lower()
    hits = 0
    total = 0
    for cid in concept_ids:
        concept = get_concept(cid)
        if not concept:
            continue
        for word in concept.vocabulary:
            total += 1
            if word.lower() in text:
                hits += 1
    ratio = hits / total if total else 0.0
    justified = any(w in text for w in ("because", "so that", "instead of", "trade-off", "rather than"))

    if ratio >= 0.4 and justified:
        verdict = "secure"
    elif ratio >= 0.2 or justified:
        verdict = "developing"
    else:
        verdict = "not_evidenced"

    reasoning = (
        f"Used {hits} of {total} target vocabulary items"
        + ("; gave a reason for the choice." if justified else "; stated the choice without a reason.")
    )
    state = get_learner(learner_id)
    suggested = next(
        (d.id for d in SEED.decisions if any(c in d.concept_ids for c in concept_ids)),
        None,
    )
    return AssessmentResult(
        concept_ids=concept_ids,
        verdict=verdict,
        reasoning=reasoning,
        next_mode=next_mode(state),
        suggested_decision_id=suggested,
    )


# --------------------------------------------------------------------------
# Experiences — the multi-representation learning object
# --------------------------------------------------------------------------

_PHP_BY_COMPONENT = {
    "ui-booking-form": (
        "<?php\n"
        "$errors = [];\n"
        "if ($_SERVER['REQUEST_METHOD'] === 'POST') {\n"
        "    $name  = trim($_POST['name'] ?? '');\n"
        "    $email = trim($_POST['email'] ?? '');\n"
        "    if ($name === '') { $errors[] = 'Name is required'; }\n"
        "    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'Invalid email format'; }\n"
        "    if (!$errors) {\n"
        "        $stmt = $pdo->prepare('INSERT INTO bookings (customer_id, slot_id) VALUES (?, ?)');\n"
        "        $stmt->execute([$customerId, $slotId]);\n"
        "    }\n"
        "}\n"
    ),
    "ui-booking-table": (
        "<?php\n"
        "$stmt = $pdo->prepare(\n"
        "    'SELECT b.id, c.full_name, s.starts_at, b.status\n"
        "     FROM bookings b\n"
        "     JOIN customers c ON c.id = b.customer_id\n"
        "     JOIN slots s ON s.id = b.slot_id\n"
        "     ORDER BY s.starts_at'\n"
        ");\n"
        "$stmt->execute();\n"
        "$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);\n"
    ),
    "ui-validation-errors": (
        "<?php\n"
        "// Re-render the form with the submitted values preserved.\n"
        "$old = fn(string $k) => htmlspecialchars($_POST[$k] ?? '', ENT_QUOTES);\n"
    ),
}

_SQL_BY_COMPONENT = {
    "ui-booking-form": (
        "INSERT INTO bookings (customer_id, slot_id, status)\n"
        "VALUES (?, ?, 'pending');"
    ),
    "ui-booking-table": (
        "SELECT b.id, c.full_name, s.starts_at, b.status\n"
        "FROM bookings b\n"
        "JOIN customers c ON c.id = b.customer_id\n"
        "JOIN slots s ON s.id = b.slot_id\n"
        "ORDER BY s.starts_at;"
    ),
}


def _pick_component(intent: str, concept_ids: List[str]) -> UIComponent:
    text = intent.lower()
    if any(w in text for w in ("error", "invalid", "validation", "fail")):
        return next(c for c in SEED.components if c.id == "ui-validation-errors")
    if any(w in text for w in ("table", "list", "bookings", "read", "report")):
        return next(c for c in SEED.components if c.id == "ui-booking-table")
    if concept_ids and "crud" in concept_ids:
        return next(c for c in SEED.components if c.id == "ui-booking-table")
    return next(c for c in SEED.components if c.id == "ui-booking-form")


def create_experience(request: ExperienceRequest) -> Experience:
    component = _pick_component(request.intent, request.concept_ids)
    concept_ids = request.concept_ids or component.concept_ids
    decision = next(
        (d for d in SEED.decisions if any(c in d.concept_ids for c in concept_ids)),
        None,
    )
    if request.mode == PedagogyMode.I_DO:
        follow_ups = [
            f"Why is {component.bootstrap_classes[0]} the outer class here?",
            "Which line would break first if the input were unlabelled?",
        ]
    elif request.mode == PedagogyMode.WE_DO:
        follow_ups = [
            "What should happen when the slot is already taken?",
            "Where would you put the server-side check, and why there?",
        ]
    else:
        follow_ups = [
            "Rebuild this from the schema alone, then compare.",
            "State the consequence you accepted by choosing this layout.",
        ]

    return Experience(
        id=f"exp-{abs(hash(request.intent)) % 100000:05d}",
        intent=Intent(
            verb="build",
            subject=component.id,
            mode=request.mode,
            surface="swagger",
            raw=request.intent,
        ),
        mode=request.mode,
        narration=_MODE_NARRATION[request.mode],
        component=component,
        php=_PHP_BY_COMPONENT.get(component.id),
        sql=_SQL_BY_COMPONENT.get(component.id),
        concept_ids=concept_ids,
        decision_id=decision.id if decision else None,
        follow_up_questions=follow_ups,
    )
