/**
 * Browser-side state for LAMPForge.
 *
 * One `store` holds the learner model, ADR drafts, submitted evidence,
 * assessments, code runs and the "object under inspection" that persist as you
 * move between the surfaces — plus a `cohort` map so the teacher dashboard can
 * read every learner at once.
 *
 * Persistence is deliberately swappable. A `PersistenceAdapter` isolates *how*
 * state is stored; today the active adapter is `localStorageAdapter`, but a
 * server adapter can be dropped in with `setAdapter()` without touching a
 * single component — the UI only ever talks to `useStore`/`setStore`.
 */
import { useCallback, useEffect, useState } from "react";

import { seed, type Decision, type LearnerState, type PedagogyMode } from "./lampforge";

const KEY = "lampforge.state.v2";

export type Focus = {
  kind: "concept" | "decision" | "operation" | "tool" | "file" | "component";
  id: string;
  label?: string;
} | null;

export type EvidenceRecord = {
  id: string;
  concept_ids: string[];
  body: string;
  kind: string;
  verdict?: string;
  at: number;
};

export type AssessmentRecord = {
  id: string;
  concept_ids: string[];
  verdict: string;
  reasoning: string;
  next_mode: string;
  at: number;
};

export type RunRecord = {
  id: string;
  file: string;
  engine: string;
  ok: boolean;
  ms: number;
  summary?: string;
  at: number;
};

export type Checkpoint = { id: string; label: string; mode: PedagogyMode; at: number };

/** Everything the dashboard needs to render one learner. */
export type CohortMember = {
  learner: LearnerState;
  adrDrafts: Decision[];
  checkpoints: Checkpoint[];
  evidence: EvidenceRecord[];
  assessments: AssessmentRecord[];
  runs: RunRecord[];
  updatedAt: number;
};

export type StoreState = {
  /** Id of the learner currently driving the four surfaces. */
  learnerId: string;
  learner: LearnerState;
  focus: Focus;
  adrDrafts: Decision[];
  checkpoints: Checkpoint[];
  evidence: EvidenceRecord[];
  assessments: AssessmentRecord[];
  runs: RunRecord[];
  /** Every learner (including the active one), keyed by learner_id. */
  cohort: Record<string, CohortMember>;
};

/* ---------------------------------------------------------------- adapter */

export interface PersistenceAdapter {
  readonly name: string;
  load(): StoreState | null;
  save(state: StoreState): void;
}

/** Default adapter: the browser's localStorage. */
export const localStorageAdapter: PersistenceAdapter = {
  name: "localStorage",
  load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoreState) : null;
    } catch {
      return null; // corrupt payload: start clean
    }
  },
  save(state) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota: state stays in memory */
    }
  },
};

let adapter: PersistenceAdapter = localStorageAdapter;

/** Swap the persistence backend (e.g. a server adapter) at runtime. */
export function setAdapter(next: PersistenceAdapter) {
  adapter = next;
  hydrated = false;
  hydrate();
  listeners.forEach((l) => l());
}

/* -------------------------------------------------------------- seed data */

const ACTIVE_ID = (seed.learner as LearnerState).learner_id;

function member(patch: Partial<CohortMember> & { learner: LearnerState }): CohortMember {
  return {
    adrDrafts: [],
    checkpoints: [],
    evidence: [],
    assessments: [],
    runs: [],
    updatedAt: Date.now(),
    ...patch,
  };
}

/** A small seeded cohort so the teacher dashboard is meaningful on first load. */
function seedCohort(): Record<string, CohortMember> {
  const base = seed.learner as LearnerState;
  const conceptIds = seed.concepts.map((c) => c.id);
  const at = Date.now();
  const peers: Array<[string, Partial<LearnerState>, Partial<CohortMember>]> = [
    [
      "amara-okafor",
      {
        mode: "you_do",
        accuracy: 0.88,
        hint_requests: 0,
        successful_retrievals: 14,
        failed_retrievals: 2,
        mastered_concept_ids: conceptIds.slice(0, 4),
        emerging_concept_ids: conceptIds.slice(4, 6),
      },
      {
        assessments: [
          {
            id: "as-amara-1",
            concept_ids: [conceptIds[3] ?? "crud"],
            verdict: "secure",
            reasoning: "Used 5 of 6 target vocabulary items; gave a reason for the choice.",
            next_mode: "you_do",
            at: at - 1000 * 60 * 40,
          },
        ],
        runs: [
          { id: "r-amara-1", file: "schema.sql", engine: "sql", ok: true, ms: 46, summary: "3 rows", at: at - 1000 * 60 * 38 },
        ],
      },
    ],
    [
      "ben-carter",
      {
        mode: "we_do",
        accuracy: 0.61,
        hint_requests: 2,
        successful_retrievals: 6,
        failed_retrievals: 4,
        mastered_concept_ids: conceptIds.slice(0, 2),
        emerging_concept_ids: conceptIds.slice(2, 5),
      },
      {
        evidence: [
          {
            id: "ev-ben-1",
            concept_ids: [conceptIds[2] ?? "crud"],
            body: "I bound the parameters with a prepared statement so the input can't change the SQL.",
            kind: "explanation",
            verdict: "developing",
            at: at - 1000 * 60 * 22,
          },
        ],
        runs: [
          { id: "r-ben-1", file: "create_booking.php", engine: "php", ok: false, ms: 120, summary: "validation failed", at: at - 1000 * 60 * 20 },
        ],
      },
    ],
    [
      "chen-wei",
      {
        mode: "i_do",
        accuracy: 0.44,
        hint_requests: 4,
        retries: 3,
        successful_retrievals: 3,
        failed_retrievals: 6,
        mastered_concept_ids: conceptIds.slice(0, 1),
        emerging_concept_ids: conceptIds.slice(1, 4),
      },
      {},
    ],
  ];

  const cohort: Record<string, CohortMember> = {};
  for (const [id, l, extra] of peers) {
    cohort[id] = member({ learner: { ...base, ...l, learner_id: id }, ...extra });
  }
  return cohort;
}

function initial(): StoreState {
  const learner = seed.learner as LearnerState;
  const state: StoreState = {
    learnerId: ACTIVE_ID,
    learner,
    focus: null,
    adrDrafts: [],
    checkpoints: [],
    evidence: [],
    assessments: [],
    runs: [],
    cohort: seedCohort(),
  };
  return syncCohort(state);
}

/* --------------------------------------------------------------- internals */

/** Fold the active learner's flat fields back into the cohort snapshot. */
function syncCohort(s: StoreState): StoreState {
  const snapshot: CohortMember = {
    learner: s.learner,
    adrDrafts: s.adrDrafts,
    checkpoints: s.checkpoints,
    evidence: s.evidence,
    assessments: s.assessments,
    runs: s.runs,
    updatedAt: Date.now(),
  };
  return { ...s, cohort: { ...s.cohort, [s.learnerId]: snapshot } };
}

let state: StoreState = initial();
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const loaded = adapter.load();
  if (loaded) state = syncCohort({ ...initial(), ...loaded });
}

function persist() {
  adapter.save(state);
}

export function setStore(patch: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = syncCohort({ ...state, ...next });
  persist();
  listeners.forEach((l) => l());
}

export function getStore(): StoreState {
  return state;
}

/** Subscribe a component to the store. SSR renders the seed default. */
export function useStore(): [StoreState, typeof setStore] {
  const [, force] = useState(0);
  useEffect(() => {
    hydrate();
    const l = () => force((n) => n + 1);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [state, setStore];
}

export function useFocus(): [Focus, (f: Focus) => void] {
  const [s] = useStore();
  const set = useCallback((f: Focus) => setStore({ focus: f }), []);
  return [s.focus, set];
}

/* --------------------------------------------------------------- recorders */

const rid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function recordSignal(patch: Partial<LearnerState>) {
  setStore((s) => ({ learner: { ...s.learner, ...patch } }));
}

/** Persist a piece of evidence the learner handed in. */
export function recordEvidence(input: { concept_ids: string[]; body: string; kind?: string; verdict?: string }) {
  const record: EvidenceRecord = {
    id: rid("ev"),
    concept_ids: input.concept_ids,
    body: input.body,
    kind: input.kind ?? "explanation",
    ...(input.verdict !== undefined ? { verdict: input.verdict } : {}),
    at: Date.now(),
  };
  setStore((s) => ({ evidence: [record, ...s.evidence] }));
  return record;
}

/** Persist an assessment result against the active learner. */
export function recordAssessment(input: {
  concept_ids: string[];
  verdict: string;
  reasoning: string;
  next_mode: string;
}) {
  const record: AssessmentRecord = { id: rid("as"), at: Date.now(), ...input };
  setStore((s) => ({ assessments: [record, ...s.assessments] }));
  return record;
}

/** Persist a code run (from the PDE or the chat's live runner). */
export function recordRun(input: { file: string; engine: string; ok: boolean; ms: number; summary?: string }) {
  const record: RunRecord = { id: rid("run"), at: Date.now(), ...input };
  setStore((s) => ({ runs: [record, ...s.runs].slice(0, 200) }));
  return record;
}

/** Switch which learner drives the surfaces (used by the teacher dashboard). */
export function switchLearner(learnerId: string) {
  setStore((s) => {
    const m = s.cohort[learnerId];
    if (!m) return {};
    return {
      learnerId,
      learner: m.learner,
      adrDrafts: m.adrDrafts,
      checkpoints: m.checkpoints,
      evidence: m.evidence,
      assessments: m.assessments,
      runs: m.runs,
    };
  });
}
