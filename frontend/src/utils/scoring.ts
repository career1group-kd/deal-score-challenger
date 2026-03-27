/**
 * Client-side scoring engine that mirrors the backend logic.
 * Enables instant preview when sliders change (<200ms).
 */

// ---------------------------------------------------------------
// Default lookup tables
// ---------------------------------------------------------------
export const DEFAULT_LOOKUPS: Record<string, Record<string, number | null>> = {
  finanzierung: {
    Selbstzahler: 1.0,
    Ratenzahlung: 0.8,
    "Arbeitgeber zahlt": 0.9,
    Bildungsgutschein: 0.6,
    "Noch unklar": 0.3,
    "Keine Angabe": 0.1,
  },
  decision: {
    Alleinentscheider: 1.0,
    "Ehepartner einbezogen": 0.7,
    "Arbeitgeber muss zustimmen": 0.5,
    "Noch nicht entschieden": 0.3,
    "Keine Angabe": 0.1,
  },
  reaktion: {
    "<24h": 1.0,
    "1-2 Tage": 0.7,
    "3-7 Tage": 0.4,
    ">7 Tage": 0.1,
    "Keine Angabe": 0.0,
  },
  next_step: {
    "FollowUp in der Zukunft": 1.0,
    "FollowUp nicht notwendig": 0.8,
    "FollowUp in der Vergangenheit": 0.3,
    "Kein FollowUp gesetzt": 0.0,
  },
  aktivitaet: {
    ">12": 1.0,
    "6-12": 0.7,
    "3-6": 0.4,
    "<3": 0.0,
  },
  aging: {
    "<15 Tage": 1.0,
    "15-30 Tage": 0.6,
    ">30 Tage": 0.2,
  },
  produktfit: {
    Perfekt: 1.0,
    Gut: 0.75,
    Mittel: 0.5,
    Schlecht: 0.2,
    "Keine Angabe": 0.1,
  },
  arbeitgeber_fit: {
    "Top-Arbeitgeber": 1.0,
    "Guter Arbeitgeber": 0.75,
    Durchschnittlich: 0.5,
    Kleinstunternehmen: 0.3,
    "Keine Angabe": 0.1,
  },
  unternehmensfit: {
    "Etabliertes Unternehmen": 1.0,
    Wachstum: 0.8,
    "Start-up": 0.5,
    Einzelunternehmer: 0.3,
    "Keine Angabe": 0.1,
  },
  unterlagen: {
    Vollstaendig: 1.0,
    "Fast vollstaendig": 0.7,
    Teilweise: 0.4,
    Fehlend: 0.1,
  },
  jc_status: {
    "BGS bewilligt": 1.0,
    "BGS beantragt": 0.7,
    "AVGS vorhanden": 0.6,
    "In Beratung": 0.4,
    "Kein Kontakt JC": 0.1,
  },
  setter_rating: {
    "9-10": 1.0,
    "6-8": 0.6,
    "1-5": 0.2,
    "Keine Angabe": 0.0,
  },
  roi: {
    Hoch: 1.0,
    Mittel: 0.6,
    Niedrig: 0.3,
    "Keine Angabe": 0.1,
  },
  budget: {
    "Ja, freigegeben": 1.0,
    "Ja, in Planung": 0.7,
    Teilweise: 0.4,
    Nein: 0.15,
    "Keine Angabe": 0.1,
  },
  deutsch_gate: {
    "C1-C2": null,
    "B1-B2": null,
    "A1-A2": 25,
    "Keine Angabe": null,
  },
  pc_internet_gate: {
    Ja: null,
    Nein: 35,
    "Keine Angabe": null,
  },
};

// ---------------------------------------------------------------
// Field simulation
// ---------------------------------------------------------------
export interface FieldSimulationRule {
  field: string;
  distribution: Record<string, number>;
}

export const DEFAULT_SIMULATIONS: Record<string, Record<string, number>> = {
  finanzierung: { "Nicht klar": 0.4, "Teilweise klar": 0.35, "Klar / bestaetigt": 0.25 },
  entscheidungssituation: { "Nicht bekannt": 0.35, "Bekannt": 0.4, "Committed / Freigabe klar": 0.25 },
  produktfit: { "Unklar": 0.3, "Passend": 0.45, "Sehr passend": 0.25 },
  arbeitgeber_fit: { "Unklar": 0.35, "Solide": 0.4, "Stark": 0.25 },
  unternehmensfit: { "Unklar": 0.35, "Solide": 0.4, "Stark": 0.25 },
  unterlagen: { "Unvollstaendig": 0.3, "Teilweise vollstaendig": 0.4, "Vollstaendig": 0.3 },
  jc_status: { "Nicht relevant": 0.2, "JC-Berater prueft WB": 0.35, "JC-Berater stimmt WB zu": 0.35, "JC-Berater lehnt WB ab": 0.1 },
  budget_vorhanden: { "Nicht klar": 0.35, "Teilweise klar": 0.4, "Klar / bestaetigt": 0.25 },
  roi_erwartung: { "Nicht klar": 0.35, "Teilweise klar": 0.4, "Klar / wirtschaftlich plausibel": 0.25 },
};

/**
 * Deterministic hash-based simulation: given a dealId + field + distribution,
 * pick a value from the distribution in a repeatable way.
 */
export function simulateFieldValue(
  dealId: string,
  field: string,
  distribution: Record<string, number>
): string {
  // Simple string hash
  const seed = `${dealId}:${field}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  // Map hash to [0, 1)
  const rand = Math.abs(hash % 10000) / 10000;

  const entries = Object.entries(distribution);
  let cumulative = 0;
  for (const [value, prob] of entries) {
    cumulative += prob;
    if (rand < cumulative) return value;
  }
  // Fallback to last entry
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
export interface ScenarioWeights {
  a_lead: number;
  a_setter: number;
  a_finanzierung: number;
  a_decision: number;
  a_reaktion: number;
  a_next_step: number;
  a_aktivitaet: number;
  a_aging: number;
  a_produkt: number;
  a_ag_fit: number;

  b_lead: number;
  b_setter: number;
  b_budget: number;
  b_roi: number;
  b_reaktion: number;
  b_next_step: number;
  b_aktivitaet: number;
  b_aging: number;
  b_produkt: number;
  b_company: number;

  c_lead: number;
  c_setter: number;
  c_amt: number;
  c_reaktion: number;
  c_next_step: number;
  c_aktivitaet: number;
  c_aging: number;
  c_produkt: number;
  c_unterlagen: number;
  c_jc: number;
}

export interface GateRule {
  enabled: boolean;
  cap: number;
}

export interface GateConfig {
  deutsch_gate: GateRule;
  pc_internet_gate: GateRule;
  jc_ablehnung_gate: GateRule;
}

export interface BandThresholds {
  hot_min: number;
  warm_min: number;
  nurture_min: number;
}

export interface ScoreComponent {
  field: string;
  label: string;
  raw_value: string | null;
  lookup_value: number;
  weight: number;
  weighted_score: number;
}

export interface GateResult {
  gate_name: string;
  triggered: boolean;
  cap_value: number | null;
  reason: string | null;
}

export interface DealData {
  [key: string]: string | number | null | undefined;
}

export interface ScoreResult {
  raw_score: number;
  gate_caps: GateResult[];
  final_score: number;
  band: string;
  components: ScoreComponent[];
}

// ---------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------
function lookupValue(
  tableName: string,
  key: string | null | undefined,
  overrides?: Record<string, Record<string, number | null>>
): number {
  if (!key) return 0;
  const base = { ...(DEFAULT_LOOKUPS[tableName] || {}) };
  if (overrides && overrides[tableName]) {
    Object.assign(base, overrides[tableName]);
  }
  const val = base[key];
  return typeof val === "number" ? val : 0;
}

// ---------------------------------------------------------------
// Segment criteria definitions
// ---------------------------------------------------------------
export type Segment = "Arbeitender" | "Unternehmer" | "Arbeitsloser";

interface CriterionDef {
  weightKey: string;
  lookupTable: string;
  dealField: string;
  label: string;
  isNumeric?: boolean;
}

export const SEGMENT_CRITERIA: Record<Segment, CriterionDef[]> = {
  Arbeitender: [
    { weightKey: "a_lead", lookupTable: "", dealField: "lead_score", label: "Lead-Score", isNumeric: true },
    { weightKey: "a_setter", lookupTable: "setter_rating", dealField: "setter_rating", label: "Setter-Rating" },
    { weightKey: "a_finanzierung", lookupTable: "finanzierung", dealField: "finanzierung", label: "Finanzierung" },
    { weightKey: "a_decision", lookupTable: "decision", dealField: "decision", label: "Entscheidungssituation" },
    { weightKey: "a_reaktion", lookupTable: "reaktion", dealField: "reaktion", label: "Reaktionsgeschwindigkeit" },
    { weightKey: "a_next_step", lookupTable: "next_step", dealField: "next_step", label: "Next Step" },
    { weightKey: "a_aktivitaet", lookupTable: "aktivitaet", dealField: "aktivitaet", label: "Aktivitaet" },
    { weightKey: "a_aging", lookupTable: "aging", dealField: "aging", label: "Aging" },
    { weightKey: "a_produkt", lookupTable: "produktfit", dealField: "produktfit", label: "Produktfit" },
    { weightKey: "a_ag_fit", lookupTable: "arbeitgeber_fit", dealField: "arbeitgeber_fit", label: "Arbeitgeber-Fit" },
  ],
  Unternehmer: [
    { weightKey: "b_lead", lookupTable: "", dealField: "lead_score", label: "Lead-Score", isNumeric: true },
    { weightKey: "b_setter", lookupTable: "setter_rating", dealField: "setter_rating", label: "Setter-Rating" },
    { weightKey: "b_budget", lookupTable: "budget", dealField: "budget", label: "Budget" },
    { weightKey: "b_roi", lookupTable: "roi", dealField: "roi", label: "ROI" },
    { weightKey: "b_reaktion", lookupTable: "reaktion", dealField: "reaktion", label: "Reaktionsgeschwindigkeit" },
    { weightKey: "b_next_step", lookupTable: "next_step", dealField: "next_step", label: "Next Step" },
    { weightKey: "b_aktivitaet", lookupTable: "aktivitaet", dealField: "aktivitaet", label: "Aktivitaet" },
    { weightKey: "b_aging", lookupTable: "aging", dealField: "aging", label: "Aging" },
    { weightKey: "b_produkt", lookupTable: "produktfit", dealField: "produktfit", label: "Produktfit" },
    { weightKey: "b_company", lookupTable: "unternehmensfit", dealField: "unternehmensfit", label: "Unternehmensfit" },
  ],
  Arbeitsloser: [
    { weightKey: "c_lead", lookupTable: "", dealField: "lead_score", label: "Lead-Score", isNumeric: true },
    { weightKey: "c_setter", lookupTable: "setter_rating", dealField: "setter_rating", label: "Setter-Rating" },
    { weightKey: "c_amt", lookupTable: "jc_status", dealField: "amt_foerderung", label: "Amt/Foerderung" },
    { weightKey: "c_reaktion", lookupTable: "reaktion", dealField: "reaktion", label: "Reaktionsgeschwindigkeit" },
    { weightKey: "c_next_step", lookupTable: "next_step", dealField: "next_step", label: "Next Step" },
    { weightKey: "c_aktivitaet", lookupTable: "aktivitaet", dealField: "aktivitaet", label: "Aktivitaet" },
    { weightKey: "c_aging", lookupTable: "aging", dealField: "aging", label: "Aging" },
    { weightKey: "c_produkt", lookupTable: "produktfit", dealField: "produktfit", label: "Produktfit" },
    { weightKey: "c_unterlagen", lookupTable: "unterlagen", dealField: "unterlagen", label: "Unterlagen" },
    { weightKey: "c_jc", lookupTable: "jc_status", dealField: "jc_status", label: "JC-Status" },
  ],
};

// ---------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------
export function calculateDealScore(
  deal: DealData,
  segment: Segment,
  weights: ScenarioWeights,
  gates: GateConfig,
  bands: BandThresholds,
  lookupOverrides?: Record<string, Record<string, number | null>>,
  simulations?: Record<string, Record<string, number>> | null
): ScoreResult {
  const criteria = SEGMENT_CRITERIA[segment];
  if (!criteria) {
    return { raw_score: 0, gate_caps: [], final_score: 0, band: "Cold", components: [] };
  }

  // Build effective deal data with simulations applied to null fields
  const effectiveDeal: DealData = { ...deal };
  if (simulations) {
    const dealId = String(deal["id"] ?? deal["deal_id"] ?? "unknown");
    for (const [field, distribution] of Object.entries(simulations)) {
      if (effectiveDeal[field] == null || effectiveDeal[field] === "" || effectiveDeal[field] === "Keine Angabe") {
        effectiveDeal[field] = simulateFieldValue(dealId, field, distribution);
      }
    }
  }

  const components: ScoreComponent[] = [];
  let rawScore = 0;

  for (const c of criteria) {
    const weight = (weights as unknown as Record<string, number>)[c.weightKey] ?? 0;
    const rawValue = effectiveDeal[c.dealField];
    let lv = 0;

    if (c.isNumeric) {
      // Lead score: already 0-100, normalise to 0-1
      const num = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue || "0"));
      lv = Math.min(Math.max(num / 100, 0), 1);
    } else {
      lv = lookupValue(c.lookupTable, rawValue as string | null, lookupOverrides);
    }

    const weightedScore = lv * weight;
    rawScore += weightedScore;

    components.push({
      field: c.dealField,
      label: c.label,
      raw_value: rawValue != null ? String(rawValue) : null,
      lookup_value: lv,
      weight,
      weighted_score: weightedScore,
    });
  }

  // Gate logic
  const gateCaps: GateResult[] = [];
  let finalScore = rawScore;

  // Deutsch gate
  if (gates.deutsch_gate.enabled) {
    const deutschVal = deal["deutsch"] as string | null;
    const capVal = lookupValue("deutsch_gate", deutschVal, lookupOverrides);
    if (capVal && capVal > 0) {
      gateCaps.push({
        gate_name: "Deutsch-Gate",
        triggered: true,
        cap_value: gates.deutsch_gate.cap,
        reason: `Deutsch: ${deutschVal} -> Cap ${gates.deutsch_gate.cap}`,
      });
      finalScore = Math.min(finalScore, gates.deutsch_gate.cap);
    } else {
      gateCaps.push({ gate_name: "Deutsch-Gate", triggered: false, cap_value: null, reason: null });
    }
  }

  // PC/Internet gate
  if (gates.pc_internet_gate.enabled) {
    const pcVal = deal["pc_internet"] as string | null;
    const capVal = lookupValue("pc_internet_gate", pcVal, lookupOverrides);
    if (capVal && capVal > 0) {
      gateCaps.push({
        gate_name: "PC/Internet-Gate",
        triggered: true,
        cap_value: gates.pc_internet_gate.cap,
        reason: `PC/Internet: ${pcVal} -> Cap ${gates.pc_internet_gate.cap}`,
      });
      finalScore = Math.min(finalScore, gates.pc_internet_gate.cap);
    } else {
      gateCaps.push({ gate_name: "PC/Internet-Gate", triggered: false, cap_value: null, reason: null });
    }
  }

  // JC Ablehnung gate (only for Arbeitsloser)
  if (gates.jc_ablehnung_gate.enabled && segment === "Arbeitsloser") {
    const jcAblehnung = deal["jc_ablehnung"] as string | null;
    if (jcAblehnung === "Ja" || jcAblehnung === "ja") {
      gateCaps.push({
        gate_name: "JC-Ablehnung-Gate",
        triggered: true,
        cap_value: gates.jc_ablehnung_gate.cap,
        reason: `JC Ablehnung -> Cap ${gates.jc_ablehnung_gate.cap}`,
      });
      finalScore = Math.min(finalScore, gates.jc_ablehnung_gate.cap);
    } else {
      gateCaps.push({ gate_name: "JC-Ablehnung-Gate", triggered: false, cap_value: null, reason: null });
    }
  }

  finalScore = Math.round(Math.max(0, Math.min(100, finalScore)) * 100) / 100;

  // Band assignment
  let band = "Cold";
  if (finalScore >= bands.hot_min) band = "Hot";
  else if (finalScore >= bands.warm_min) band = "Warm";
  else if (finalScore >= bands.nurture_min) band = "Nurture";

  return { raw_score: rawScore, gate_caps: gateCaps, final_score: finalScore, band, components };
}

// ---------------------------------------------------------------
// Default weights
// ---------------------------------------------------------------
export const DEFAULT_WEIGHTS: ScenarioWeights = {
  a_lead: 22, a_setter: 18, a_finanzierung: 12, a_decision: 12,
  a_reaktion: 8, a_next_step: 5, a_aktivitaet: 4, a_aging: 4,
  a_produkt: 5, a_ag_fit: 10,

  b_lead: 22, b_setter: 18, b_budget: 12, b_roi: 12,
  b_reaktion: 8, b_next_step: 5, b_aktivitaet: 4, b_aging: 4,
  b_produkt: 5, b_company: 10,

  c_lead: 22, c_setter: 18, c_amt: 12, c_reaktion: 8,
  c_next_step: 5, c_aktivitaet: 4, c_aging: 4, c_produkt: 5,
  c_unterlagen: 10, c_jc: 12,
};

export const DEFAULT_GATES: GateConfig = {
  deutsch_gate: { enabled: true, cap: 25 },
  pc_internet_gate: { enabled: true, cap: 35 },
  jc_ablehnung_gate: { enabled: true, cap: 10 },
};

export const DEFAULT_BANDS: BandThresholds = {
  hot_min: 80,
  warm_min: 60,
  nurture_min: 40,
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
export function getBandColor(band: string): string {
  switch (band) {
    case "Hot": return "#ef4444";
    case "Warm": return "#f97316";
    case "Nurture": return "#eab308";
    case "Cold": return "#3b82f6";
    default: return "#6b7280";
  }
}

export function getBandBgClass(band: string): string {
  switch (band) {
    case "Hot": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "Warm": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Nurture": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Cold": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function getSegmentWeightKeys(segment: Segment): string[] {
  return SEGMENT_CRITERIA[segment].map((c) => c.weightKey);
}

export function sumSegmentWeights(segment: Segment, weights: ScenarioWeights): number {
  return getSegmentWeightKeys(segment).reduce(
    (sum, key) => sum + ((weights as unknown as Record<string, number>)[key] ?? 0),
    0
  );
}
