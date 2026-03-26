import { useState, useEffect } from "react";
import { useScenario } from "../hooks/useScenario";
import { DEFAULT_SIMULATIONS } from "../utils/scoring";
import { deals as dealsApi } from "../api/client";
import { RotateCcw } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  finanzierung: "Finanzierung",
  entscheidungssituation: "Entscheidung",
  produktfit: "Produktfit",
  arbeitgeber_fit: "Arbeitgeber-Fit",
  unternehmensfit: "Unternehmensfit",
  unterlagen: "Unterlagen",
  jc_status: "JC-Status",
  budget_vorhanden: "Budget",
  roi_erwartung: "ROI-Erwartung",
};

const SIMULATABLE_FIELDS = Object.keys(DEFAULT_SIMULATIONS);

function DistributionBar({ distribution }: { distribution: Record<string, number> }) {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-purple-500",
    "bg-cyan-500",
    "bg-pink-500",
  ];
  const entries = Object.entries(distribution);
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-700 w-full">
      {entries.map(([, prob], i) => (
        <div
          key={i}
          className={colors[i % colors.length]}
          style={{ width: `${(prob * 100).toFixed(1)}%` }}
        />
      ))}
    </div>
  );
}

function FieldBlock({ field, fillRate }: { field: string; fillRate?: number }) {
  const simulations = useScenario((s) => s.simulations);
  const setSimulation = useScenario((s) => s.setSimulation);

  const distribution = simulations[field] ?? DEFAULT_SIMULATIONS[field] ?? {};
  const entries = Object.entries(distribution);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  const sumOk = Math.abs(sum - 1) < 0.015;

  const filled = fillRate ?? 0;
  const missing = Math.max(0, 100 - filled);

  const handleChange = (key: string, pct: number) => {
    const newDist = { ...distribution, [key]: pct / 100 };
    setSimulation(field, newDist);
  };

  const handleReset = () => {
    if (DEFAULT_SIMULATIONS[field]) {
      setSimulation(field, { ...DEFAULT_SIMULATIONS[field] });
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">
          {FIELD_LABELS[field] ?? field}
        </span>
        <div className="flex items-center gap-2">
          {!sumOk && (
            <span className="text-xs text-amber-400">
              {(sum * 100).toFixed(0)}% (muss 100% sein)
            </span>
          )}
          <button
            onClick={handleReset}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Auf Standard zuruecksetzen"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fill rate indicator */}
      {fillRate !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-700 flex-1">
            <div className="bg-green-500 h-full" style={{ width: `${filled}%` }} />
            <div className="bg-amber-500/40 h-full" style={{ width: `${missing}%` }} />
          </div>
          <span className="text-[10px] text-slate-500 w-28 text-right shrink-0">
            <span className="text-green-400">{filled.toFixed(1)}%</span>
            {" vorhanden, "}
            <span className="text-amber-400">{missing.toFixed(1)}%</span>
            {" simuliert"}
          </span>
        </div>
      )}

      <DistributionBar distribution={distribution} />

      <div className="space-y-1">
        {entries.map(([value, prob]) => (
          <div key={value} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-48 shrink-0 truncate" title={value}>
              {value}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(prob * 100)}
              onChange={(e) => handleChange(value, parseFloat(e.target.value) || 0)}
              className="w-16 px-1.5 py-0.5 text-xs bg-slate-800 border border-slate-700 rounded text-white text-center"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Maps simulation field name → DB column name for fill rate lookup
const FIELD_DB_MAP: Record<string, string> = {
  finanzierung: "finanzierung",
  entscheidungssituation: "entscheidungssituation",
  produktfit: "produktfit",
  arbeitgeber_fit: "arbeitgeber_fit",
  unternehmensfit: "unternehmensfit",
  unterlagen: "unterlagen",
  jc_status: "jc_status",
  budget_vorhanden: "budget_vorhanden",
  roi_erwartung: "roi_erwartung",
};

export default function FieldSimulator() {
  const simulationsEnabled = useScenario((s) => s.simulationsEnabled);
  const toggleSimulations = useScenario((s) => s.toggleSimulations);
  const resetSimulations = useScenario((s) => s.resetSimulations);
  const [fillRates, setFillRates] = useState<Record<string, number>>({});
  const [totalDeals, setTotalDeals] = useState(0);

  useEffect(() => {
    dealsApi.getFieldFillRates().then((res) => {
      setFillRates(res.fill_rates);
      setTotalDeals(res.total_deals);
    }).catch(() => {});
  }, []);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Feld-Simulation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Simuliere fehlende HubSpot-Felder mit angenommenen Verteilungen
            {totalDeals > 0 && (
              <span className="text-slate-500"> — {totalDeals.toLocaleString("de-DE")} Deals</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetSimulations}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Alle zuruecksetzen
          </button>
          <button
            onClick={toggleSimulations}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              simulationsEnabled ? "bg-blue-600" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                simulationsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-xs text-slate-400">
            {simulationsEnabled ? "Ein" : "Aus"}
          </span>
        </div>
      </div>

      {/* Fields */}
      {simulationsEnabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {SIMULATABLE_FIELDS.map((field) => {
            const dbField = FIELD_DB_MAP[field] ?? field;
            return (
              <FieldBlock
                key={field}
                field={field}
                fillRate={fillRates[dbField]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
