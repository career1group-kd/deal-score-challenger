import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import ScenarioComparisonTable from "../components/ScenarioComparisonTable";
import KPICard from "../components/KPICard";
import { analytics, scenarios as scenarioApi } from "../api/client";
import { getBandColor, type ScenarioWeights, DEFAULT_WEIGHTS } from "../utils/scoring";

interface ScenarioOption {
  id: string;
  name: string;
  is_baseline?: boolean;
  weights: ScenarioWeights;
}

interface BandMigration {
  [fromBand: string]: { [toBand: string]: number };
}

interface CompareData {
  scenario_a_id: string;
  scenario_b_id: string;
  score_deltas: Record<string, number>;
  band_migration: BandMigration;
  win_rate_comparison: Record<string, Record<string, number>>;
}

const BANDS = ["Hot", "Warm", "Nurture", "Cold"];

// Demo compare data
const DEMO_MIGRATION: BandMigration = {
  Hot: { Hot: 35, Warm: 5, Nurture: 2, Cold: 0 },
  Warm: { Hot: 8, Warm: 60, Nurture: 7, Cold: 3 },
  Nurture: { Hot: 0, Warm: 12, Nurture: 70, Cold: 13 },
  Cold: { Hot: 0, Warm: 2, Nurture: 15, Cold: 118 },
};

export default function Comparison() {
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOption[]>([]);
  const [scenarioA, setScenarioA] = useState("");
  const [scenarioB, setScenarioB] = useState("");
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    scenarioApi
      .getScenarios()
      .then((res) => setScenarioOptions(res as ScenarioOption[]))
      .catch(() => {
        setScenarioOptions([
          {
            id: "demo-1",
            name: "Baseline v1",
            is_baseline: true,
            weights: { ...DEFAULT_WEIGHTS },
          },
          {
            id: "demo-2",
            name: "Aggressiv Q2",
            weights: {
              ...DEFAULT_WEIGHTS,
              a_lead: 28,
              a_setter: 15,
              b_lead: 28,
              b_setter: 15,
              c_lead: 28,
              c_setter: 15,
            },
          },
        ]);
      });
  }, []);

  const runComparison = useCallback(async () => {
    if (!scenarioA || !scenarioB) return;
    setLoading(true);
    try {
      const result = await analytics.getCompare(scenarioA, scenarioB);
      setCompareData(result as CompareData);
    } catch {
      // Use demo data
      setCompareData({
        scenario_a_id: scenarioA,
        scenario_b_id: scenarioB,
        score_deltas: { mean: 3.2, median: 2.8, std: 1.5 },
        band_migration: DEMO_MIGRATION,
        win_rate_comparison: {
          Hot: { a: 0.74, b: 0.71 },
          Warm: { a: 0.45, b: 0.48 },
          Nurture: { a: 0.2, b: 0.22 },
          Cold: { a: 0.06, b: 0.05 },
        },
      });
    } finally {
      setLoading(false);
    }
  }, [scenarioA, scenarioB]);

  const scenarioAObj = scenarioOptions.find((s) => s.id === scenarioA);
  const scenarioBObj = scenarioOptions.find((s) => s.id === scenarioB);

  const migration = compareData?.band_migration ?? DEMO_MIGRATION;

  // Count band changes
  const totalChanges = Object.entries(migration).reduce((sum, [from, to]) => {
    return (
      sum +
      Object.entries(to).reduce(
        (s, [toBand, count]) => s + (from !== toBand ? count : 0),
        0
      )
    );
  }, 0);

  // Build Sankey-like flow data for visualization
  const flowData = BANDS.flatMap((from) =>
    BANDS.filter((to) => to !== from)
      .map((to) => ({
        from,
        to,
        count: migration[from]?.[to] ?? 0,
      }))
      .filter((f) => f.count > 0)
  );

  // Distribution comparison (mock overlapping histograms)
  const distributionComparison = Array.from({ length: 20 }, (_, i) => ({
    name: `${i * 5}-${(i + 1) * 5}`,
    szenario_a: Math.max(0, Math.round(18 * Math.exp(-Math.pow((i * 5 - 52) / 22, 2)))),
    szenario_b: Math.max(0, Math.round(16 * Math.exp(-Math.pow((i * 5 - 56) / 20, 2)))),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Szenario-Vergleich
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Zwei Szenarien nebeneinander vergleichen
          </p>
        </div>
      </div>

      {/* Scenario selectors */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">
              Szenario A (Basis)
            </label>
            <select
              value={scenarioA}
              onChange={(e) => setScenarioA(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Waehlen...</option>
              {scenarioOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_baseline ? "(Basis)" : ""}
                </option>
              ))}
            </select>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 mt-5" />
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">
              Szenario B (Neu)
            </label>
            <select
              value={scenarioB}
              onChange={(e) => setScenarioB(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Waehlen...</option>
              {scenarioOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_baseline ? "(Basis)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={runComparison}
            disabled={!scenarioA || !scenarioB || loading}
            className="mt-5 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Vergleichen"
            )}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Score-Delta (Durchschnitt)"
          value={`+${(compareData?.score_deltas?.mean ?? 3.2).toFixed(1)}`}
        />
        <KPICard
          title="Score-Delta (Median)"
          value={`+${(compareData?.score_deltas?.median ?? 2.8).toFixed(1)}`}
        />
        <KPICard
          title="Band-Wechsel"
          value={totalChanges}
          subtitle="Deals wechseln Band"
        />
        <KPICard
          title="Aufsteiger"
          value={flowData
            .filter(
              (f) => BANDS.indexOf(f.from) > BANDS.indexOf(f.to)
            )
            .reduce((s, f) => s + f.count, 0)}
          subtitle="Deals steigen auf"
        />
      </div>

      {/* Weight comparison table */}
      {scenarioAObj && scenarioBObj && (
        <ScenarioComparisonTable
          scenarios={[
            {
              id: scenarioAObj.id,
              name: scenarioAObj.name,
              weights: scenarioAObj.weights ?? DEFAULT_WEIGHTS,
              is_baseline: scenarioAObj.is_baseline,
            },
            {
              id: scenarioBObj.id,
              name: scenarioBObj.name,
              weights: scenarioBObj.weights ?? DEFAULT_WEIGHTS,
            },
          ]}
        />
      )}

      {/* Distribution comparison */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Score-Verteilung im Vergleich
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distributionComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #475569",
                borderRadius: 8,
                color: "#f1f5f9",
              }}
            />
            <Legend />
            <Bar
              dataKey="szenario_a"
              fill="#3b82f6"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              name={scenarioAObj?.name ?? "Szenario A"}
            />
            <Bar
              dataKey="szenario_b"
              fill="#8b5cf6"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
              name={scenarioBObj?.name ?? "Szenario B"}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Band migration (Sankey-like visualization) */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Band-Migration (Sankey)
        </h3>

        {/* Simplified Sankey-like grid */}
        <div className="grid grid-cols-2 gap-8">
          {/* Migration table */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-slate-400">
                    Von / Nach
                  </th>
                  {BANDS.map((b) => (
                    <th
                      key={b}
                      className="text-center px-3 py-2 text-slate-400"
                    >
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BANDS.map((from) => (
                  <tr key={from} className="border-b border-slate-700/50">
                    <td className="px-3 py-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2"
                        style={{ background: getBandColor(from) }}
                      />
                      <span className="text-white">{from}</span>
                    </td>
                    {BANDS.map((to) => {
                      const count = migration[from]?.[to] ?? 0;
                      const isStay = from === to;
                      return (
                        <td
                          key={to}
                          className={`text-center px-3 py-2 font-mono ${
                            isStay
                              ? "text-slate-500"
                              : count > 0
                              ? "text-amber-400 font-bold"
                              : "text-slate-600"
                          }`}
                        >
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Flow arrows visualization */}
          <div className="space-y-2">
            <h4 className="text-xs text-slate-500 mb-3">
              Wesentliche Verschiebungen
            </h4>
            {flowData
              .sort((a, b) => b.count - a.count)
              .slice(0, 8)
              .map((flow, i) => {
                const isUpgrade =
                  BANDS.indexOf(flow.from) > BANDS.indexOf(flow.to);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-1.5 px-3 bg-slate-900/50 rounded-lg"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: getBandColor(flow.from) }}
                    />
                    <span className="text-sm text-slate-300 w-16">
                      {flow.from}
                    </span>
                    <ArrowRight
                      className={`w-4 h-4 ${
                        isUpgrade ? "text-green-400" : "text-red-400"
                      }`}
                    />
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: getBandColor(flow.to) }}
                    />
                    <span className="text-sm text-slate-300 w-16">
                      {flow.to}
                    </span>
                    <span
                      className={`ml-auto text-sm font-bold ${
                        isUpgrade ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {flow.count} Deals
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Impact: Win Rate comparison per band */}
      {compareData?.win_rate_comparison && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Win-Rate Vergleich
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={Object.entries(compareData.win_rate_comparison).map(
                ([band, rates]) => ({
                  band,
                  szenario_a: Math.round((rates.a ?? 0) * 100),
                  szenario_b: Math.round((rates.b ?? 0) * 100),
                })
              )}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="band"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "#475569" }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
                formatter={(value) => [`${value}%`]}
              />
              <Legend />
              <Bar
                dataKey="szenario_a"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name={scenarioAObj?.name ?? "Szenario A"}
              >
                {Object.keys(compareData.win_rate_comparison).map((band, idx) => (
                  <Cell key={idx} fill={getBandColor(band)} opacity={0.6} />
                ))}
              </Bar>
              <Bar
                dataKey="szenario_b"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                name={scenarioBObj?.name ?? "Szenario B"}
              >
                {Object.keys(compareData.win_rate_comparison).map((band, idx) => (
                  <Cell key={idx} fill={getBandColor(band)} opacity={1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
