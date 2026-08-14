/**
 * Edge mirror of `python/lampforge/runtime.py`.
 *
 * The Python module is the canonical implementation; this file exists because
 * the app's HTTP + MCP endpoints run on the edge. Behaviour must stay
 * one-for-one: same filters, same mode transitions, same experience shape.
 */
import {
  seed,
  type Concept,
  type Decision,
  type Evidence,
  type LearnerState,
  type PedagogyMode,
  type UIComponent,
} from "./lampforge";

export const MODE_NARRATION: Record<PedagogyMode, string> = {
  i_do: "Watch first. I'll build it and narrate every decision as I make it.",
  we_do: "We'll build this together. I'll start it; you decide the next move.",
  you_do: "Your turn. I'll hold the criteria and answer questions, but the moves are yours.",
};

export function listConcepts(opts: { stack?: string; depth?: string; query?: string } = {}): Concept[] {
  let items = seed.concepts as Concept[];
  if (opts.stack) items = items.filter((c) => c.stack === opts.stack);
  if (opts.depth) items = items.filter((c) => c.depth === opts.depth);
  if (opts.query) {
    const q = opts.query.toLowerCase();
    items = items.filter(
      (c) => c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q),
    );
  }
  return items;
}

export const getConcept = (id: string): Concept | undefined => seed.concepts.find((c) => c.id === id);

export const listDecisions = (projectId?: string): Decision[] =>
  projectId ? seed.decisions.filter((d) => d.project_id === projectId) : (seed.decisions as Decision[]);

export const getDecision = (id: string): Decision | undefined => seed.decisions.find((d) => d.id === id);

export const evidenceFor = (decisionId: string): Evidence[] =>
  seed.evidence.filter((e) => e.decision_id === decisionId);

export const getLearner = (learnerId = "demo-learner"): LearnerState => ({
  ...(seed.learner as LearnerState),
  learner_id: learnerId,
});

export function nextMode(state: LearnerState): PedagogyMode {
  const total = state.successful_retrievals + state.failed_retrievals;
  const retrievalRate = total ? state.successful_retrievals / total : 0;
  const struggling = state.hint_requests >= 3 || state.retries >= 4 || state.accuracy < 0.5;
  const secure = state.accuracy >= 0.8 && retrievalRate >= 0.7 && state.hint_requests <= 1;
  const mode = state.mode as PedagogyMode;
  if (struggling) return mode === "we_do" ? "i_do" : "we_do";
  if (secure) return mode === "we_do" ? "you_do" : "we_do";
  return mode;
}

export function explain(conceptId: string, mode: PedagogyMode = "we_do") {
  const concept = getConcept(conceptId);
  if (!concept) return null;
  const body =
    mode === "i_do"
      ? `${concept.summary} Here is the worked form: ${concept.code_example ?? "see the artefact"}`
      : mode === "we_do"
        ? `${concept.summary} Given that, what would you change first?`
        : `Before I say anything: describe ${concept.title.toLowerCase()} in your own words, then I'll respond to what you said.`;
  return {
    concept,
    mode,
    narration: MODE_NARRATION[mode],
    body,
    watch_for: concept.common_errors,
    vocabulary: concept.vocabulary,
  };
}

export function assessEvidence(conceptIds: string[], body: string, learnerId = "demo-learner") {
  const text = body.toLowerCase();
  let hits = 0;
  let total = 0;
  for (const cid of conceptIds) {
    const concept = getConcept(cid);
    if (!concept) continue;
    for (const word of concept.vocabulary) {
      total += 1;
      if (text.includes(word.toLowerCase())) hits += 1;
    }
  }
  const ratio = total ? hits / total : 0;
  const justified = ["because", "so that", "instead of", "trade-off", "rather than"].some((w) =>
    text.includes(w),
  );
  const verdict = ratio >= 0.4 && justified ? "secure" : ratio >= 0.2 || justified ? "developing" : "not_evidenced";
  return {
    concept_ids: conceptIds,
    verdict,
    reasoning:
      `Used ${hits} of ${total} target vocabulary items` +
      (justified ? "; gave a reason for the choice." : "; stated the choice without a reason."),
    next_mode: nextMode(getLearner(learnerId)),
    suggested_decision_id:
      seed.decisions.find((d) => conceptIds.some((c) => d.concept_ids.includes(c)))?.id ?? null,
  };
}

const PHP_BY_COMPONENT: Record<string, string> = {
  "ui-booking-form": `<?php
$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name  = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    if ($name === '') { $errors[] = 'Name is required'; }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'Invalid email format'; }
    if (!$errors) {
        $stmt = $pdo->prepare('INSERT INTO bookings (customer_id, slot_id) VALUES (?, ?)');
        $stmt->execute([$customerId, $slotId]);
    }
}
`,
  "ui-booking-table": `<?php
$stmt = $pdo->prepare(
    'SELECT b.id, c.full_name, s.starts_at, b.status
     FROM bookings b
     JOIN customers c ON c.id = b.customer_id
     JOIN slots s ON s.id = b.slot_id
     ORDER BY s.starts_at'
);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
`,
  "ui-validation-errors": `<?php
// Re-render the form with the submitted values preserved.
$old = fn(string $k) => htmlspecialchars($_POST[$k] ?? '', ENT_QUOTES);
`,
};

const SQL_BY_COMPONENT: Record<string, string> = {
  "ui-booking-form": `INSERT INTO bookings (customer_id, slot_id, status)
VALUES (?, ?, 'pending');`,
  "ui-booking-table": `SELECT b.id, c.full_name, s.starts_at, b.status
FROM bookings b
JOIN customers c ON c.id = b.customer_id
JOIN slots s ON s.id = b.slot_id
ORDER BY s.starts_at;`,
};

function pickComponent(intent: string, conceptIds: string[]): UIComponent {
  const text = intent.toLowerCase();
  const byId = (id: string) => seed.components.find((c) => c.id === id) as UIComponent;
  if (["error", "invalid", "validation", "fail"].some((w) => text.includes(w)))
    return byId("ui-validation-errors");
  if (["table", "list", "bookings", "read", "report"].some((w) => text.includes(w)))
    return byId("ui-booking-table");
  if (conceptIds.includes("crud")) return byId("ui-booking-table");
  return byId("ui-booking-form");
}

export type ExperienceRequestInput = {
  intent: string;
  mode?: PedagogyMode;
  concept_ids?: string[];
  learner_id?: string;
};

export function createExperience(request: ExperienceRequestInput) {
  const mode = request.mode ?? "we_do";
  const component = pickComponent(request.intent, request.concept_ids ?? []);
  const conceptIds = request.concept_ids?.length ? request.concept_ids : component.concept_ids;
  const decision = seed.decisions.find((d) => conceptIds.some((c) => d.concept_ids.includes(c)));

  const followUps =
    mode === "i_do"
      ? [
          `Why is ${component.bootstrap_classes[0]} the outer class here?`,
          "Which line would break first if the input were unlabelled?",
        ]
      : mode === "we_do"
        ? [
            "What should happen when the slot is already taken?",
            "Where would you put the server-side check, and why there?",
          ]
        : [
            "Rebuild this from the schema alone, then compare.",
            "State the consequence you accepted by choosing this layout.",
          ];

  let hash = 0;
  for (const ch of request.intent) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  return {
    id: `exp-${String(hash % 100000).padStart(5, "0")}`,
    intent: {
      verb: "build",
      subject: component.id,
      mode,
      surface: "swagger",
      raw: request.intent,
    },
    mode,
    narration: MODE_NARRATION[mode],
    component,
    php: PHP_BY_COMPONENT[component.id] ?? null,
    sql: SQL_BY_COMPONENT[component.id] ?? null,
    concept_ids: conceptIds,
    decision_id: decision?.id ?? null,
    follow_up_questions: followUps,
  };
}

export type Experience = ReturnType<typeof createExperience>;
