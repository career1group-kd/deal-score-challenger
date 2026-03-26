import type { ScenarioWeights } from "../utils/scoring";
import { DEFAULT_WEIGHTS } from "../utils/scoring";

interface ScenarioSummary {
  id: string;
  name: string;
  weights: ScenarioWeights;
  is_baseline?: boolean;
}

interface Props {
  scenarios: ScenarioSummary[];
}

const WEIGHT_LABELS: Record<string, string> = {
  a_lead: "Lead-Score (A)",
  a_setter: "Setter-Rating (A)",
  a_finanzierung: "Finanzierung (A)",
  a_decision: "Entscheidung (A)",
  a_reaktion: "Reaktion (A)",
  a_next_step: "Next Step (A)",
  a_aktivitaet: "Aktivitaet (A)",
  a_aging: "Aging (A)",
  a_produkt: "Produktfit (A)",
  a_ag_fit: "AG-Fit (A)",
  b_lead: "Lead-Score (B)",
  b_setter: "Setter-Rating (B)",
  b_budget: "Budget (B)",
  b_roi: "ROI (B)",
  b_reaktion: "Reaktion (B)",
  b_next_step: "Next Step (B)",
  b_aktivitaet: "Aktivitaet (B)",
  b_aging: "Aging (B)",
  b_produkt: "Produktfit (B)",
  b_company: "Unternehmensfit (B)",
  c_lead: "Lead-Score (C)",
  c_setter: "Setter-Rating (C)",
  c_amt: "Amt/Foerderung (C)",
  c_reaktion: "Reaktion (C)",
  c_next_step: "Next Step (C)",
  c_aktivitaet: "Aktivitaet (C)",
  c_aging: "Aging (C)",
  c_produkt: "Produktfit (C)",
  c_unterlagen: "Unterlagen (C)",
  c_jc: "JC-Status (C)",
};

export default function ScenarioComparisonTable({ scenarios }: Props) {
  const weightKeys = Object.keys(DEFAULT_WEIGHTS);

  if (scenarios.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
        <p className="text-slate-400">
          Keine Szenarien zum Vergleichen vorhanden.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium sticky left-0 bg-slate-800 z-10">
                Gewicht
              </th>
              {scenarios.map((s) => (
                <th
                  key={s.id}
                  className="text-center px-4 py-3 text-white font-semibold min-w-[120px]"
                >
                  {s.name}
                  {s.is_baseline && (
                    <span className="ml-2 text-xs text-blue-400">(Basis)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weightKeys.map((key) => {
              const baseVal = scenarios[0]
                ? (scenarios[0].weights as unknown as Record<string, number>)[key]
                : (DEFAULT_WEIGHTS as unknown as Record<string, number>)[key];

              return (
                <tr
                  key={key}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20"
                >
                  <td className="px-4 py-2 text-slate-300 sticky left-0 bg-slate-800/80 z-10">
                    {WEIGHT_LABELS[key] ?? key}
                  </td>
                  {scenarios.map((s) => {
                    const val = (s.weights as unknown as Record<string, number>)[key] ?? 0;
                    const isDiff = val !== baseVal;
                    return (
                      <td
                        key={s.id}
                        className={`text-center px-4 py-2 font-mono ${
                          isDiff
                            ? "text-amber-400 bg-amber-500/10 font-bold"
                            : "text-slate-400"
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
