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

interface WonLostBin {
  name: string;
  won: number;
  lost: number;
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
  won_lost_histogram: WonLostBin[];
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

export default function BacktestResults() {
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOption[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [rocData, setRocData] = useState<ROCPoint[]>([]);
  const [confusionData, setConfusionData] = useState<ConfusionData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueImpactPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Load scenarios
  useEffect(() => {
    scenarioApi
      .getScenarios()
      .then((res) => setScenarioOptions(res as ScenarioOption[]))
      .catch(() => {});
  }, []);

  const runBacktest = useCallback(async () => {
    if (!selectedScenario) return;
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const [bt, roc, cm, rev] = await Promise.allSettled([
        analytics.getBacktest(selectedScenario),
        analytics.getRoc(selectedScenario),
        analytics.getConfusionMatrix(selectedScenario),
        analytics.getRevenueImpact(selectedScenario),
      ]);
      if (bt.status === "fulfilled") setBacktestData(bt.value as BacktestData);
      else setError("Backtest-Daten konnten nicht geladen werden.");
      if (roc.status === "fulfilled") setRocData(roc.value as ROCPoint[]);
      if (cm.status === "fulfilled") setConfusionData(cm.value as ConfusionData);
      if (rev.status === "fulfilled") setRevenueData(rev.value as RevenueImpactPoint[]);
    } catch {
      setError("Fehler beim Ausfuehren des Backtests.");
    } finally {
      setLoading(false);
    }
  }, [selectedScenario]);

  const winRates = backtestData?.win_rates_by_band ?? [];
  const wonLostHist = backtestData?.won_lost_histogram ?? [];
  const roc = rocData;
  const confusion = confusionData;
  const revenue = revenueData;
  const optimalCutoff = backtestData?.optimal_cutoff ?? 0;

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

      {/* Info banner when no backtest has been run */}
      {!hasRun && !loading && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">Kein Backtest ausgefuehrt</h3>
          <p className="text-sm text-slate-400">
            Waehle ein Szenario aus und klicke auf &quot;Backtest starten&quot;, um die
            historische Scoring-Qualitaet zu analysieren.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            Backtest wird berechnet... Dies kann bei vielen Deals einen Moment dauern.
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-5 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results - only show when we have data */}
      {backtestData && !loading && (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-5 gap-4">
            <KPICard
              title="Praezision"
              value={`${(backtestData.precision * 100).toFixed(1)}%`}
            />
            <KPICard
              title="Recall"
              value={`${(backtestData.recall * 100).toFixed(1)}%`}
            />
            <KPICard
              title="F1-Score"
              value={`${(backtestData.f1_score * 100).toFixed(1)}%`}
            />
            <KPICard
              title="Optimaler Cutoff"
              value={optimalCutoff}
            />
            <KPICard
              title="Deals gesamt"
              value={backtestData.total_deals}
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
              {wonLostHist.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={wonLostHist}>
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
              ) : (
                <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">
                  Keine Daten vorhanden
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2: ROC + Confusion */}
          <div className="grid grid-cols-2 gap-4">
            {/* ROC Curve */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">
                ROC-Kurve
              </h3>
              {roc.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
                  Keine Daten vorhanden
                </div>
              )}
            </div>

            {confusion ? (
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
            ) : (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center justify-center text-slate-500 text-sm">
                Keine Confusion-Matrix-Daten vorhanden
              </div>
            )}
          </div>

          {/* Revenue Impact */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              Umsatz-Auswirkung nach Score-Schwellenwert
            </h3>
            {revenue.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
                Keine Daten vorhanden
              </div>
            )}
          </div>

          {/* Optimal cutoff recommendation */}
          {backtestData.f1_score > 0 && (
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
                    {(backtestData.f1_score * 100).toFixed(1)}%).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Precision/Recall per band */}
          {winRates.length > 0 && (
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
          )}
        </>
      )}
    </div>
  );
}
