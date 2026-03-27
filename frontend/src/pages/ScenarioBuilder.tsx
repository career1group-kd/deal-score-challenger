import { useState, useCallback, useEffect } from "react";
import {
  Save,
  RotateCcw,
  AlertTriangle,
  Check,
  Info,
  Pencil,
  Copy,
  Trash2,
  Star,
  Plus,
  Loader2,
} from "lucide-react";
import WeightSlider from "../components/WeightSlider";
import GateConfigComponent from "../components/GateConfig";
import FieldSimulator from "../components/FieldSimulator";
import { useScenario } from "../hooks/useScenario";
import { scenarios as scenarioApi, deals as dealsApi } from "../api/client";
import {
  SEGMENT_CRITERIA,
  DEFAULT_WEIGHTS,
  sumSegmentWeights,
  DEFAULT_LOOKUPS,
  type Segment,
  type GateConfig,
} from "../utils/scoring";

interface ScenarioListItem {
  id: string;
  name: string;
  description?: string;
  is_baseline: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  weights: Record<string, number>;
  gates: GateConfig;
  bands: { hot_min: number; warm_min: number; nurture_min: number };
  lookups: Record<string, Record<string, number | null>>;
  simulations?: { rules: Array<{ field: string; distribution: Record<string, number> }> };
}

const SEGMENTS: Segment[] = ["Arbeitender", "Unternehmer", "Arbeitsloser"];
const SEGMENT_LABELS: Record<Segment, string> = {
  Arbeitender: "A - Arbeitender",
  Unternehmer: "B - Unternehmer",
  Arbeitsloser: "C - Arbeitsloser",
};

const GATE_LABELS: { key: keyof GateConfig; label: string }[] = [
  { key: "deutsch_gate", label: "Deutsch-Gate" },
  { key: "pc_internet_gate", label: "PC/Internet-Gate" },
  { key: "jc_ablehnung_gate", label: "JC-Ablehnung-Gate" },
];

// Lookup tables that are editable
const EDITABLE_LOOKUPS = [
  "finanzierung",
  "decision",
  "reaktion",
  "next_step",
  "aktivitaet",
  "aging",
  "produktfit",
  "arbeitgeber_fit",
  "unternehmensfit",
  "unterlagen",
  "jc_status",
  "setter_rating",
  "roi",
  "budget",
];

const LOOKUP_LABELS: Record<string, string> = {
  finanzierung: "Finanzierung",
  decision: "Entscheidungssituation",
  reaktion: "Reaktionsgeschwindigkeit",
  next_step: "Next Step",
  aktivitaet: "Aktivitaet",
  aging: "Aging",
  produktfit: "Produktfit",
  arbeitgeber_fit: "Arbeitgeber-Fit",
  unternehmensfit: "Unternehmensfit",
  unterlagen: "Unterlagen",
  jc_status: "JC-Status",
  setter_rating: "Setter-Rating",
  roi: "ROI-Erwartung",
  budget: "Budget",
};

// Maps lookup table name → { hubspot property, internal DB field }
const LOOKUP_HUBSPOT_META: Record<string, { property: string; dbField: string; derived?: string }> = {
  finanzierung: { property: "deal_score_funding_clarity", dbField: "finanzierung" },
  decision: { property: "deal_score_decision_clarity", dbField: "entscheidungssituation" },
  reaktion: { property: "notes_last_contacted", dbField: "reaktionsgeschwindigkeit", derived: "Berechnet aus letztem Kontakt-Datum" },
  next_step: { property: "notes_next_activity_date", dbField: "next_step", derived: "Berechnet aus naechster Aktivitaet" },
  aktivitaet: { property: "notes_next_activity_date", dbField: "aktivitaet", derived: "Berechnet aus geplanter Aktivitaet" },
  aging: { property: "hs_lastmodifieddate", dbField: "stage_aging", derived: "Berechnet aus letzter Aenderung" },
  produktfit: { property: "deal_score_product_fit", dbField: "produktfit" },
  arbeitgeber_fit: { property: "rating_company", dbField: "arbeitgeber_fit" },
  unternehmensfit: { property: "rating_company", dbField: "unternehmensfit" },
  unterlagen: { property: "deal_score_documents_complete", dbField: "unterlagen" },
  jc_status: { property: "jc_verifizierungsstatus", dbField: "jc_status" },
  setter_rating: { property: "rating_setter___closer", dbField: "setter_rating" },
  roi: { property: "—", dbField: "roi_erwartung" },
  budget: { property: "—", dbField: "budget_vorhanden" },
};

export default function ScenarioBuilder() {
  const {
    editingId,
    weights,
    gates,
    bands,
    lookups,
    simulations,
    scenarioName,
    scenarioDescription,
    isDirty,
    setWeight,
    setGate,
    setBand,
    setLookup,
    setScenarioName,
    setScenarioDescription,
    resetToDefaults,
    resetWeight,
    loadScenario,
  } = useScenario();

  const [activeTab, setActiveTab] = useState<Segment>("Arbeitender");
  const [activeSection, setActiveSection] = useState<
    "weights" | "lookups" | "gates" | "bands" | "simulation"
  >("weights");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fillRates, setFillRates] = useState<Record<string, number>>({});
  const [totalDeals, setTotalDeals] = useState(0);
  const [scenarioList, setScenarioList] = useState<ScenarioListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadScenarioList = useCallback(() => {
    setListLoading(true);
    scenarioApi
      .getScenarios()
      .then((res) => setScenarioList(res as ScenarioListItem[]))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    loadScenarioList();
  }, [loadScenarioList]);

  useEffect(() => {
    dealsApi.getFieldFillRates().then((res) => {
      setFillRates(res.fill_rates);
      setTotalDeals(res.total_deals);
    }).catch(() => {});
  }, []);

  const currentSum = sumSegmentWeights(activeTab, weights);

  const buildSimulationsPayload = () => {
    const rules = Object.entries(simulations)
      .filter(([, dist]) => Object.keys(dist).length > 0)
      .map(([field, distribution]) => ({ field, distribution }));
    return { rules };
  };

  const handleSave = useCallback(async () => {
    if (!scenarioName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: scenarioName,
        description: scenarioDescription,
        weights,
        gates,
        bands,
        lookups,
        simulations: buildSimulationsPayload(),
      };
      if (editingId) {
        await scenarioApi.updateScenario(editingId, payload);
      } else {
        await scenarioApi.createScenario(payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadScenarioList();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [scenarioName, scenarioDescription, weights, gates, bands, lookups, simulations, editingId, loadScenarioList]);

  const handleEdit = (scenario: ScenarioListItem) => {
    loadScenario({
      id: scenario.id,
      weights: scenario.weights as any,
      gates: scenario.gates,
      bands: scenario.bands,
      lookups: scenario.lookups,
      simulations: scenario.simulations,
      name: scenario.name,
      description: scenario.description,
    });
  };

  const handleDuplicate = (scenario: ScenarioListItem) => {
    loadScenario({
      weights: scenario.weights as any,
      gates: scenario.gates,
      bands: scenario.bands,
      lookups: scenario.lookups,
      simulations: scenario.simulations,
      name: `${scenario.name} (Kopie)`,
      description: scenario.description,
    });
    // No id = will create new on save
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await scenarioApi.deleteScenario(id);
      if (editingId === id) {
        resetToDefaults();
      }
      loadScenarioList();
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const handleSetBaseline = async (id: string) => {
    try {
      await scenarioApi.setBaseline(id);
      loadScenarioList();
    } catch {
      // silent
    }
  };

  const handleNew = () => {
    resetToDefaults();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Szenario-Builder</h1>
          <p className="text-sm text-slate-400 mt-1">
            {editingId ? `Bearbeite: ${scenarioName}` : "Neues Szenario erstellen"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editingId && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neues Szenario
            </button>
          )}
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Zuruecksetzen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !scenarioName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved
              ? "Gespeichert"
              : editingId
              ? "Szenario aktualisieren"
              : "Szenario speichern"}
          </button>
        </div>
      </div>

      {/* Existing scenarios list */}
      {scenarioList.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            Gespeicherte Szenarien ({scenarioList.length})
          </h3>
          <div className="space-y-2">
            {scenarioList.map((sc) => (
              <div
                key={sc.id}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  editingId === sc.id
                    ? "bg-blue-900/30 border-blue-500/50"
                    : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {sc.is_baseline && (
                    <Star className="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">
                        {sc.name}
                      </span>
                      {sc.is_baseline && (
                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-medium shrink-0">
                          Baseline
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 shrink-0">
                        v{sc.version}
                      </span>
                    </div>
                    {sc.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {sc.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  {!sc.is_baseline && (
                    <button
                      onClick={() => handleSetBaseline(sc.id)}
                      className="p-1.5 text-slate-500 hover:text-amber-400 rounded transition-colors"
                      title="Als Baseline setzen"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(sc)}
                    className="p-1.5 text-slate-500 hover:text-blue-400 rounded transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(sc)}
                    className="p-1.5 text-slate-500 hover:text-green-400 rounded transition-colors"
                    title="Duplizieren"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(sc.id)}
                    disabled={deleting === sc.id}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors disabled:opacity-50"
                    title="Loeschen"
                  >
                    {deleting === sc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {listLoading && scenarioList.length === 0 && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lade Szenarien...
        </div>
      )}

      {/* Name + Description */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 font-medium mb-1">
              Szenario-Name
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="z.B. Aggressiveres Scoring Q2"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 font-medium mb-1">
              Beschreibung
            </label>
            <input
              type="text"
              value={scenarioDescription}
              onChange={(e) => setScenarioDescription(e.target.value)}
              placeholder="Optionale Beschreibung..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
        {isDirty && (
          <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Ungespeicherte Aenderungen
          </p>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        {(
          [
            { key: "weights", label: "Gewichte" },
            { key: "lookups", label: "Lookup-Tabellen" },
            { key: "gates", label: "Gates" },
            { key: "bands", label: "Score-Baender" },
            { key: "simulation", label: "Feld-Simulation" },
          ] as const
        ).map((sec) => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSection === sec.key
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* Weights section */}
      {activeSection === "weights" && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl">
          {/* Segment tabs */}
          <div className="flex border-b border-slate-700/50">
            {SEGMENTS.map((seg) => (
              <button
                key={seg}
                onClick={() => setActiveTab(seg)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === seg
                    ? "text-white border-b-2 border-blue-500 bg-slate-700/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {SEGMENT_LABELS[seg]}
              </button>
            ))}
          </div>

          {/* Weight sum indicator */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">
                Summe Max-Gewichte:
              </span>
              <span
                className={`text-sm font-bold ${
                  Math.abs(currentSum - 100) < 0.1
                    ? "text-green-400"
                    : "text-amber-400"
                }`}
              >
                {currentSum.toFixed(1)} / 100
              </span>
              {Math.abs(currentSum - 100) >= 0.1 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Summe weicht von 100 ab
                </span>
              )}
            </div>
          </div>

          {/* Sliders */}
          <div className="px-6 py-4 space-y-1">
            {SEGMENT_CRITERIA[activeTab].map((criterion) => (
              <WeightSlider
                key={criterion.weightKey}
                label={criterion.label}
                weightKey={criterion.weightKey}
                value={
                  (weights as unknown as Record<string, number>)[criterion.weightKey] ?? 0
                }
                defaultValue={
                  (DEFAULT_WEIGHTS as unknown as Record<string, number>)[
                    criterion.weightKey
                  ] ?? 0
                }
                max={
                  ((DEFAULT_WEIGHTS as unknown as Record<string, number>)[
                    criterion.weightKey
                  ] ?? 0) * 2
                }
                onChange={setWeight}
                onReset={resetWeight}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lookups section */}
      {activeSection === "lookups" && (
        <div className="space-y-4">
          {totalDeals > 0 && (
            <p className="text-xs text-slate-500">
              Datenbasis: {totalDeals.toLocaleString("de-DE")} Deals aus HubSpot
            </p>
          )}
          {EDITABLE_LOOKUPS.map((tableName) => {
            const entries = Object.entries(
              lookups[tableName] ?? DEFAULT_LOOKUPS[tableName] ?? {}
            );
            const meta = LOOKUP_HUBSPOT_META[tableName];
            const rate = meta ? fillRates[meta.dbField] : undefined;
            return (
              <div
                key={tableName}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {LOOKUP_LABELS[tableName] ?? tableName}
                    </h3>
                    {meta && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        HubSpot-Property:{" "}
                        <code className="text-slate-400 bg-slate-900 px-1 py-0.5 rounded">
                          {meta.property}
                        </code>
                        {meta.derived && (
                          <span className="ml-2 text-slate-500 italic">{meta.derived}</span>
                        )}
                      </p>
                    )}
                  </div>
                  {rate !== undefined && (
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${rate > 50 ? "bg-green-500" : rate > 20 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-mono w-14 text-right ${rate > 50 ? "text-green-400" : rate > 20 ? "text-amber-400" : "text-red-400"}`}>
                        {rate.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-500">befuellt</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {entries.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center gap-3 py-1"
                    >
                      <span className="text-xs text-slate-400 w-44 shrink-0 truncate">
                        {key}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={typeof val === "number" ? val : 0}
                        onChange={(e) =>
                          setLookup(
                            tableName,
                            key,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gates section */}
      {activeSection === "gates" && (
        <div className="space-y-3">
          {GATE_LABELS.map((g) => (
            <GateConfigComponent
              key={g.key}
              label={g.label}
              gateName={g.key}
              rule={gates[g.key]}
              onChange={(name, rule) =>
                setGate(name as keyof GateConfig, rule)
              }
            />
          ))}
        </div>
      )}

      {/* Simulation section */}
      {activeSection === "simulation" && <FieldSimulator />}

      {/* Bands section */}
      {activeSection === "bands" && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-6">
          <h3 className="text-sm font-semibold text-white">
            Score-Band Schwellenwerte
          </h3>

          {/* Visual band preview */}
          <div className="flex h-8 rounded-lg overflow-hidden">
            <div
              className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium"
              style={{
                width: `${bands.nurture_min}%`,
              }}
            >
              Cold (0-{bands.nurture_min})
            </div>
            <div
              className="bg-yellow-500 flex items-center justify-center text-xs text-white font-medium"
              style={{
                width: `${bands.warm_min - bands.nurture_min}%`,
              }}
            >
              Nurture ({bands.nurture_min}-{bands.warm_min})
            </div>
            <div
              className="bg-orange-500 flex items-center justify-center text-xs text-white font-medium"
              style={{
                width: `${bands.hot_min - bands.warm_min}%`,
              }}
            >
              Warm ({bands.warm_min}-{bands.hot_min})
            </div>
            <div
              className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
              style={{
                width: `${100 - bands.hot_min}%`,
              }}
            >
              Hot ({bands.hot_min}-100)
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            {[
              {
                key: "hot_min" as const,
                label: "Hot (Minimum)",
                color: "text-red-400",
              },
              {
                key: "warm_min" as const,
                label: "Warm (Minimum)",
                color: "text-orange-400",
              },
              {
                key: "nurture_min" as const,
                label: "Nurture (Minimum)",
                color: "text-yellow-400",
              },
            ].map((b) => (
              <div key={b.key} className="flex items-center gap-4">
                <span className={`text-sm font-medium w-40 ${b.color}`}>
                  {b.label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={bands[b.key]}
                  onChange={(e) =>
                    setBand(b.key, parseFloat(e.target.value))
                  }
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-blue-500"
                />
                <span className="w-12 text-right text-sm font-mono text-white">
                  {bands[b.key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Erklaerung */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white">So funktioniert das Scoring</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400 leading-relaxed">
          <div className="space-y-3">
            <div>
              <h4 className="text-slate-300 font-medium mb-1">Segment-Rechner</h4>
              <p>
                Jeder Deal wird anhand seines Segments (<strong className="text-slate-300">Arbeitender</strong>,{" "}
                <strong className="text-slate-300">Unternehmer</strong> oder{" "}
                <strong className="text-slate-300">Arbeitsloser</strong>) mit einem eigenen Rechner bewertet.
                Jeder Rechner hat 10 Kriterien, deren Gewichte in Summe 100 ergeben.
              </p>
            </div>

            <div>
              <h4 className="text-slate-300 font-medium mb-1">Lookup-Tabellen</h4>
              <p>
                Der Rohwert jedes Kriteriums (z.B. &quot;Klar / bestaetigt&quot;) wird ueber eine Lookup-Tabelle
                in einen normierten Wert zwischen 0.0 und 1.0 uebersetzt. Dieser wird mit dem Gewicht
                multipliziert, um den Teilscore zu berechnen.
              </p>
            </div>

            <div>
              <h4 className="text-slate-300 font-medium mb-1">Gate-/Cap-Logik</h4>
              <p>
                Gates begrenzen den Gesamtscore unabhaengig von der Gewichtung.
                Beispiel: Hat ein Kontakt nur Deutschkenntnisse auf A1-B1 Niveau,
                wird der Score auf max. 25 gedeckelt. Der niedrigste Cap gewinnt.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-slate-300 font-medium mb-1">Score-Baender</h4>
              <p>
                Der finale Score (0-100) wird in Baender eingeteilt:{" "}
                <strong className="text-red-400">Hot</strong> (80-100),{" "}
                <strong className="text-orange-400">Warm</strong> (60-79),{" "}
                <strong className="text-yellow-400">Nurture</strong> (40-59),{" "}
                <strong className="text-blue-400">Cold</strong> (0-39).
                Die Schwellenwerte sind konfigurierbar.
              </p>
            </div>

            <div>
              <h4 className="text-slate-300 font-medium mb-1">Feld-Simulation</h4>
              <p>
                Viele HubSpot-Felder sind noch nicht befuellt. Die Simulation weist fehlenden Feldern
                Werte zu, basierend auf konfigurierbaren Wahrscheinlichkeitsverteilungen.
              </p>
              <p className="mt-1">
                Die Zuweisung ist <strong className="text-slate-300">deterministisch</strong> (Hash aus Deal-ID + Feldname),
                d.h. derselbe Deal erhaelt bei jedem Durchlauf denselben simulierten Wert.
                Ueber alle Deals hinweg entspricht die Verteilung den eingestellten Prozenten.
              </p>
            </div>

            <div>
              <h4 className="text-slate-300 font-medium mb-1">Workflow</h4>
              <p>
                1. Szenario hier konfigurieren und speichern &rarr;
                2. Im <strong className="text-slate-300">Deal-Explorer</strong> das Szenario anwenden und Einzeldeals pruefen &rarr;
                3. Im <strong className="text-slate-300">Backtest</strong> die Auswirkungen auf die gesamte Deal-Basis analysieren.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
