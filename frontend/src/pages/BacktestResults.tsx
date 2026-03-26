import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import ConfusionMatrix from "../components/ConfusionMatrix";
import WinRateByBand from "../components/WinRateByBand";
import KPICard from "../components/KPICard";
import { analytics, scenarios as scenarioApi } from "../api/client";
import { getBandColor } from "../utils/scoring";

interface ScenarioOption {
  id: string;
  name: string;
}

interface WinRateData {
  band: string;
  total: number;
  won: number;
  lost: number;
  win_rate: number;
}

interface BacktestData {
  scenario_id: string;
  scenario_name: string;
  total_deals: number;
  win_rates_by_band: WinRateData[];
  precision: number;
  recall: number;
  f1_score: number;
  optimal_cutoff: number;
  revenue_impact: Record<string, number>;
}

interface ROCPoint {
  threshold: number;
  tpr: number;
  fpr: number;
}

interface ConfusionData {
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  threshold: number;
}

interface RevenueImpactPoint {
  threshold: number;
  deals_above: number;
  deals_below: number;
  revenue_above: number;
  revenue_below: number;
  win_rate_above: number;
  win_rate_below: number;
}

// Demo data
const DEMO_WIN_RATES: WinRateData[] = [
  { band: "Hot", total: 42, won: 31, lost: 11, win_rate: 0.74 },
  { band: "Warm", total: 78, won: 35, lost: 43, win_rate: 0.45 },
  { band: "Nurture", total: 95, won: 19, lost: 76, win_rate: 0.2 },
  { band: "Cold", total: 135, won: 8, lost: 127, win_rate: 0.06 },
];

const DEMO_ROC: ROCPoint[] = Array.from({ length: 21 }, (_, i) => {
  const t = i * 5;
  const fpr = Math.pow(1 - t / 100, 1.5);
  const tpr = Math.pow(1 - t / 100, 0.6);
  return { threshold: t, fpr, tpr };
});

const DEMO_CONFUSION: ConfusionData = {
  true_positive: 58,
  false_positive: 35,
  true_negative: 168,
  false_negative: 25,
  accuracy: 0.79,
  precision: 0.62,
  recall: 0.7,
  f1_score: 0.66,
  threshold: 60,
};

const DEMO_REVENUE: RevenueImpactPoint[] = Array.from({ length: 11 }, (_, i) => {
  const t = i * 10;
  return {
    threshold: t,
    deals_above: Math.max(0, 350 - Math.floor(t * 3.2)),
    deals_below: Math.floor(t * 3.2),
    revenue_above: Math.max(0, 2800000 - t * 25000),
    revenue_below: t * 25000,
    win_rate_above: Math.min(0.95, 0.3 + t * 0.006),
    win_rate_below: Math.max(0.05, 0.5 - t * 0.004),
  };
});

const DEMO_WON_LOST_HIST = Array.from({ length: 20 }, (_, i) => {
  const bin = i * 5;
  return {
    name: `${bin}-${bin + 5}`,
    won: Math.max(0, Math.round(15 * Math.exp(-Math.pow((bin - 70) / 25, 2)))),
    lost: Math.max(0, Math.round(20 * Math.exp(-Math.pow((bin - 30) / 25, 2)))),
  };
});

export default function BacktestResults() {
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOption[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [rocData, setRocData] = useState<ROCPoint[]>([]);
  const [confusionData, setConfusionData] = useState<ConfusionData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueImpactPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Load scenarios
  useEffect(() => {
    scenarioApi
      .getScenarios()
      .then((res) => setScenarioOptions(res as ScenarioOption[]))
      .catch(() => {
        setScenarioOptions([
          { id: "demo-1", name: "Baseline v1" },
          { id: "demo-2", name: "Aggressiv Q2" },
        ]);
      });
  }, []);

  const runBacktest = useCallback(async () => {
    if (!selectedScenario) return;
    setLoading(true);
    try {
      const [bt, roc, cm, rev] = await Promise.allSettled([
        analytics.getBacktest(selectedScenario),
        analytics.getRoc(selectedScenario),
        analytics.getConfusionMatrix(selectedScenario),
        analytics.getRevenueImpact(selectedScenario),
      ]);
      if (bt.status === "fulfilled") setBacktestData(bt.value as BacktestData);
      if (roc.status === "fulfilled") setRocData(roc.value as ROCPoint[]);
      if (cm.status === "fulfilled") setConfusionData(cm.value as ConfusionData);
      if (rev.status === "fulfilled") setRevenueData(rev.value as RevenueImpactPoint[]);
    } catch {
      // Use demo data
    } finally {
      setLoading(false);
    }
  }, [selectedScenario]);

  // Use demo data when no real data
  const winRates = backtestData?.win_rates_by_band ?? DEMO_WIN_RATES;
  const roc = rocData.length > 0 ? rocData : DEMO_ROC;
  const confusion = confusionData ?? DEMO_CONFUSION;
  const revenue = revenueData.length > 0 ? revenueData : DEMO_REVENUE;
  const optimalCutoff = backtestData?.optimal_cutoff ?? 62;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Backtest-Ergebnisse</h1>
          <p className="text-sm text-slate-400 mt-1">
            Historische Analyse der Scoring-Qualitaet
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="">Szenario waehlen...</option>
            {scenarioOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={runBacktest}
            disabled={!selectedScenario || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Backtest starten"
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          title="Praezision"
          value={`${((backtestData?.precision ?? 0.62) * 100).toFixed(1)}%`}
        />
        <KPICard
          title="Recall"
          value={`${((backtestData?.recall ?? 0.7) * 100).toFixed(1)}%`}
        />
        <KPICard
          title="F1-Score"
          value={`${((backtestData?.f1_score ?? 0.66) * 100).toFixed(1)}%`}
        />
        <KPICard
          title="Optimaler Cutoff"
          value={optimalCutoff}
        />
        <KPICard
          title="Deals gesamt"
          value={backtestData?.total_deals ?? 350}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        <WinRateByBand data={winRates} />

        {/* Won vs Lost histogram */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Gewonnen vs. Verloren - Score-Verteilung
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={DEMO_WON_LOST_HIST}>
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
                dataKey="won"
                fill="#22c55e"
                opacity={0.7}
                radius={[2, 2, 0, 0]}
                name="Gewonnen"
              />
              <Bar
                dataKey="lost"
                fill="#ef4444"
                opacity={0.7}
                radius={[2, 2, 0, 0]}
                name="Verloren"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: ROC + Confusion */}
      <div className="grid grid-cols-2 gap-4">
        {/* ROC Curve */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            ROC-Kurve
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={roc}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="fpr"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
                label={{
                  value: "False Positive Rate",
                  position: "bottom",
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
                domain={[0, 1]}
                type="number"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
                label={{
                  value: "True Positive Rate",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
                domain={[0, 1]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
                formatter={(value) => [Number(value).toFixed(3)]}
              />
              <Line
                type="monotone"
                dataKey="tpr"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3 }}
                name="ROC"
              />
              {/* Diagonal reference */}
              <Line
                type="monotone"
                data={[
                  { fpr: 0, tpr: 0 },
                  { fpr: 1, tpr: 1 },
                ]}
                dataKey="tpr"
                stroke="#475569"
                strokeDasharray="5 5"
                dot={false}
                name="Zufall"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <ConfusionMatrix
          tp={confusion.true_positive}
          fp={confusion.false_positive}
          tn={confusion.true_negative}
          fn={confusion.false_negative}
          accuracy={confusion.accuracy}
          precision={confusion.precision}
          recall={confusion.recall}
          f1={confusion.f1_score}
          threshold={confusion.threshold}
        />
      </div>

      {/* Revenue Impact */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Umsatz-Auswirkung nach Score-Schwellenwert
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="threshold"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
              label={{
                value: "Score-Schwellenwert",
                position: "bottom",
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "#475569" }}
              tickFormatter={(v: number) =>
                v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
              }
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #475569",
                borderRadius: 8,
                color: "#f1f5f9",
              }}
              formatter={(value) => [
                `${(Number(value) / 1000).toFixed(0)}k EUR`,
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue_above"
              fill="#3b82f6"
              fillOpacity={0.3}
              stroke="#3b82f6"
              name="Umsatz oberhalb"
            />
            <Area
              type="monotone"
              dataKey="revenue_below"
              fill="#ef4444"
              fillOpacity={0.3}
              stroke="#ef4444"
              name="Umsatz unterhalb"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Optimal cutoff recommendation */}
      <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white">
              Empfehlung: Optimaler Schwellenwert
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Basierend auf der Analyse liegt der optimale Score-Schwellenwert bei{" "}
              <span className="text-blue-400 font-bold">{optimalCutoff}</span>.
              Bei diesem Wert wird das beste Verhaeltnis zwischen Praezision und
              Recall erreicht (F1-Score:{" "}
              {((backtestData?.f1_score ?? 0.66) * 100).toFixed(1)}%).
            </p>
          </div>
        </div>
      </div>

      {/* Precision/Recall per band */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Metriken nach Band
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-2 text-slate-400">Band</th>
              <th className="text-right px-4 py-2 text-slate-400">Deals</th>
              <th className="text-right px-4 py-2 text-slate-400">Gewonnen</th>
              <th className="text-right px-4 py-2 text-slate-400">Verloren</th>
              <th className="text-right px-4 py-2 text-slate-400">Win-Rate</th>
              <th className="text-right px-4 py-2 text-slate-400">Lift</th>
            </tr>
          </thead>
          <tbody>
            {winRates.map((wr) => {
              const baseRate =
                winRates.reduce((s, w) => s + w.won, 0) /
                Math.max(1, winRates.reduce((s, w) => s + w.total, 0));
              const lift = baseRate > 0 ? wr.win_rate / baseRate : 0;
              return (
                <tr
                  key={wr.band}
                  className="border-b border-slate-700/50"
                >
                  <td className="px-4 py-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2"
                      style={{ background: getBandColor(wr.band) }}
                    />
                    <span className="text-white">{wr.band}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">
                    {wr.total}
                  </td>
                  <td className="px-4 py-2 text-right text-green-400">
                    {wr.won}
                  </td>
                  <td className="px-4 py-2 text-right text-red-400">
                    {wr.lost}
                  </td>
                  <td className="px-4 py-2 text-right text-white font-mono">
                    {(wr.win_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right text-blue-400 font-mono">
                    {lift.toFixed(2)}x
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
