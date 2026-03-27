import { create } from "zustand";
import type {
  ScenarioWeights,
  GateConfig,
  GateRule,
  BandThresholds,
} from "../utils/scoring";
import {
  DEFAULT_WEIGHTS,
  DEFAULT_GATES,
  DEFAULT_BANDS,
  DEFAULT_LOOKUPS,
  DEFAULT_SIMULATIONS,
} from "../utils/scoring";

interface ScenarioState {
  editingId: string | null;
  weights: ScenarioWeights;
  gates: GateConfig;
  bands: BandThresholds;
  lookups: Record<string, Record<string, number | null>>;
  scenarioName: string;
  scenarioDescription: string;
  isDirty: boolean;
  simulations: Record<string, Record<string, number>>;
  simulationsEnabled: boolean;

  setWeight: (key: string, value: number) => void;
  setGate: (gateName: keyof GateConfig, rule: Partial<GateRule>) => void;
  setBand: (key: keyof BandThresholds, value: number) => void;
  setLookup: (table: string, key: string, value: number) => void;
  setScenarioName: (name: string) => void;
  setScenarioDescription: (desc: string) => void;
  resetToDefaults: () => void;
  resetWeight: (key: string) => void;
  setSimulation: (field: string, distribution: Record<string, number>) => void;
  toggleSimulations: () => void;
  resetSimulations: () => void;
  loadScenario: (scenario: {
    id?: string;
    weights: ScenarioWeights;
    gates: GateConfig;
    bands: BandThresholds;
    lookups: Record<string, Record<string, number | null>>;
    simulations?: { rules: Array<{ field: string; distribution: Record<string, number> }> };
    name?: string;
    description?: string;
  }) => void;
  clearEditing: () => void;
}

export const useScenario = create<ScenarioState>((set) => ({
  editingId: null,
  weights: { ...DEFAULT_WEIGHTS },
  gates: structuredClone(DEFAULT_GATES),
  bands: { ...DEFAULT_BANDS },
  lookups: structuredClone(DEFAULT_LOOKUPS),
  scenarioName: "",
  scenarioDescription: "",
  isDirty: false,
  simulations: structuredClone(DEFAULT_SIMULATIONS),
  simulationsEnabled: false,

  setWeight: (key, value) =>
    set((state) => ({
      weights: { ...state.weights, [key]: value },
      isDirty: true,
    })),

  setGate: (gateName, rule) =>
    set((state) => ({
      gates: {
        ...state.gates,
        [gateName]: { ...state.gates[gateName], ...rule },
      },
      isDirty: true,
    })),

  setBand: (key, value) =>
    set((state) => ({
      bands: { ...state.bands, [key]: value },
      isDirty: true,
    })),

  setLookup: (table, key, value) =>
    set((state) => ({
      lookups: {
        ...state.lookups,
        [table]: { ...state.lookups[table], [key]: value },
      },
      isDirty: true,
    })),

  setScenarioName: (name) => set({ scenarioName: name }),
  setScenarioDescription: (desc) => set({ scenarioDescription: desc }),

  resetToDefaults: () =>
    set({
      editingId: null,
      weights: { ...DEFAULT_WEIGHTS },
      gates: structuredClone(DEFAULT_GATES),
      bands: { ...DEFAULT_BANDS },
      lookups: structuredClone(DEFAULT_LOOKUPS),
      scenarioName: "",
      scenarioDescription: "",
      isDirty: false,
    }),

  resetWeight: (key) =>
    set((state) => ({
      weights: {
        ...state.weights,
        [key]: (DEFAULT_WEIGHTS as unknown as Record<string, number>)[key] ?? 0,
      },
      isDirty: true,
    })),

  setSimulation: (field, distribution) =>
    set((state) => ({
      simulations: { ...state.simulations, [field]: { ...distribution } },
      isDirty: true,
    })),

  toggleSimulations: () =>
    set((state) => ({ simulationsEnabled: !state.simulationsEnabled })),

  resetSimulations: () =>
    set({
      simulations: structuredClone(DEFAULT_SIMULATIONS),
      isDirty: true,
    }),

  loadScenario: (scenario) => {
    // Convert simulation rules array to flat dict
    const sims: Record<string, Record<string, number>> = structuredClone(DEFAULT_SIMULATIONS);
    if (scenario.simulations?.rules) {
      for (const rule of scenario.simulations.rules) {
        sims[rule.field] = { ...rule.distribution };
      }
    }
    set({
      editingId: scenario.id ?? null,
      weights: { ...scenario.weights },
      gates: structuredClone(scenario.gates),
      bands: { ...scenario.bands },
      lookups: structuredClone(scenario.lookups),
      simulations: sims,
      scenarioName: scenario.name ?? "",
      scenarioDescription: scenario.description ?? "",
      isDirty: false,
    });
  },

  clearEditing: () => set({ editingId: null }),
}));
