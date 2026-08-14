/**
 * Browser-side state for LAMPForge.
 *
 * One `store` interface: learner model, ADR drafts and the "object under
 * inspection" that persists as you move between the four surfaces. Backed by
 * localStorage today; swappable for a server store without touching the UI.
 */
import { useCallback, useEffect, useState } from "react";

import { seed, type Decision, type LearnerState, type PedagogyMode } from "./lampforge";

const KEY = "lampforge.state.v1";

export type Focus = {
  kind: "concept" | "decision" | "operation" | "tool" | "file" | "component";
  id: string;
  label?: string;
} | null;

export type StoreState = {
  learner: LearnerState;
  focus: Focus;
  adrDrafts: Decision[];
  checkpoints: Array<{ id: string; label: string; mode: PedagogyMode; at: number }>;
};

const initial = (): StoreState => ({
  learner: seed.learner as LearnerState,
  focus: null,
  adrDrafts: [],
  checkpoints: [],
});

let state: StoreState = initial();
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial(), ...(JSON.parse(raw) as StoreState) };
  } catch {
    /* corrupt payload: start clean */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota: state stays in memory */
  }
}

export function setStore(patch: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
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

export function recordSignal(patch: Partial<LearnerState>) {
  setStore((s) => ({ learner: { ...s.learner, ...patch } }));
}
