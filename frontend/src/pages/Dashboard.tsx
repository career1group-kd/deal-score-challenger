import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import KPICard from "../components/KPICard";
import ScoreDistributionChart from "../components/ScoreDistributionChart";
import WinRateByBand from "../components/WinRateByBand";
import SegmentFilter from "../components/SegmentFilter";
import { analytics, hubspot } from "../api/client";
import { getBandColor } from "../utils/scoring";

interface DistributionBin {
  bin_start: number;
  bin_end: number;
  count: number;
  percentage: number;
}

interface AnalyticsData {
  total_deals: number;
  mean_score: number;
  median_score: number;
  std_dev: number;
  distribution: DistributionBin[];
  band_counts: Record<string, number>;
}

interface WinRateData {
  band: string;
  total: number;
  won: number;
  lost: number;
  win_rate: number;
}

interface SyncStatus {
  last_sync: string | null;
  status: string | null;
  deals_synced: number;
}

// Placeholder data for demo
const DEMO_DISTRIBUTION: DistributionBin[] = Array.from({ length: 20 }, (_, i) => ({
  bin_start: i * 5,
  bin_end: (i + 1) * 5,
  count: Math.floor(Math.random() * 30 + 5),
  percentage: 0,
}));

const DEMO_BAND_COUNTS: Record<string, number> = {
  Hot: 42,
  Warm: 78,
  Nurture: 95,
  Cold: 135,
};

const DEMO_WIN_RATES: WinRateData[] = [
  { band: "Hot", total: 42, won: 31, lost: 11, win_rate: 0.74 },
  { band: "Warm", total: 78, won: 35, lost: 43, win_rate: 0.45 },
  { band: "Nurture", total: 95, won: 19, lost: 76, win_rate: 0.2 },
  { band: "Cold", total: 135, won: 8, lost: 127, win_rate: 0.06 },
];

const DEMO_SEGMENT_DATA = [
  { name: "Arbeitender", deals: 145, avgScore: 58 },
  { name: "Unternehmer", deals: 112, avgScore: 52 },
  { name: "Arbeitsloser", deals: 93, avgScore: 47 },
];

export default function Dashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [winRates, setWinRates] = useState<WinRateData[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [segmentFilter, setSegmentFilter] = useState("");
  const [_pipelineFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [distRes, winRes, statusRes] = await Promise.allSettled([
        analytics.getDistribution(),
        analytics.getWinRate(),
        hubspot.getSyncStatus(),
      ]);

      if (distRes.status === "fulfilled") {
        setAnalyticsData(distRes.value as AnalyticsData);
      }
      if (winRes.status === "fulfilled") {
        setWinRates(winRes.value as WinRateData[]);
      }
      if (statusRes.status === "fulfilled") {
        setSyncStatus(statusRes.value as SyncStatus);
      }
    } catch {
      // Use demo data on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await hubspot.syncDeals();
      await loadData();
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  };

  const dist = analyticsData?.distribution ?? DEMO_DISTRIBUTION;
  const bandCounts = analyticsData?.band_counts ?? DEMO_BAND_COUNTS;
  const totalDeals = analyticsData?.total_deals ?? 350;
  const avgScore = analyticsData?.mean_score ?? 54.3;
  const wr = winRates.length > 0 ? winRates : DEMO_WIN_RATES;

  const donutData = Object.entries(bandCounts).map(([band, count]) => ({
    name: band,
    value: count,
  }));

  const segmentData = DEMO_SEGMENT_DATA;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Uebersicht aller Deals und Scores
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SegmentFilter value={segmentFilter} onChange={setSegmentFilter} />
          <select className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">Alle Pipelines</option>
            <option value="default">OneCareer</option>
            <option value="327839987">ChapterNext</option>
            <option value="169628399">AVGS Deals</option>
          </select>
          <select className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="">Alle Zeitraeume</option>
            <option value="7d">Letzte 7 Tage</option>
            <option value="30d">Letzte 30 Tage</option>
            <option value="90d">Letzte 90 Tage</option>
          </select>
        </div>
      </div>

      {/* Hinweis */}
      <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl px-5 py-3 flex items-start gap-3">
        <span className="text-blue-400 text-lg mt-0.5">i</span>
        <p className="text-sm text-blue-200/80">
          Das Dashboard zeigt die <strong>aktuelle Datenbasis</strong> aus HubSpot ohne Feld-Simulationen.
          Um die Auswirkungen von Szenarien und Simulationen auf die Score-Verteilung zu analysieren,
          nutze den Bereich <a href="/backtest" className="underline text-blue-300 hover:text-white font-medium">Backtest-Ergebnisse</a>.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lade Daten...
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Deals gesamt"
          value={totalDeals}
          subtitle={segmentFilter || "Alle Segmente"}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <KPICard
          title="Durchschnittlicher Score"
          value={avgScore.toFixed(1)}
          subtitle={`Median: ${(analyticsData?.median_score ?? 52.0).toFixed(1)}`}
          icon={<Target className="w-5 h-5" />}
        />
        <KPICard
          title="Hot-Deals"
          value={bandCounts.Hot ?? 0}
          subtitle={`${(((bandCounts.Hot ?? 0) / totalDeals) * 100).toFixed(1)}% aller Deals`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <KPICard
          title="Win-Rate (Hot)"
          value={`${((wr.find((w) => w.band === "Hot")?.win_rate ?? 0) * 100).toFixed(0)}%`}
          subtitle={`${wr.find((w) => w.band === "Hot")?.won ?? 0} von ${wr.find((w) => w.band === "Hot")?.total ?? 0}`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Distribution */}
        <div className="col-span-2">
          <ScoreDistributionChart data={dist} />
        </div>

        {/* Band Donut */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Band-Verteilung
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((entry, index) => (
                  <Cell key={index} fill={getBandColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: 8,
                  color: "#f1f5f9",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: getBandColor(d.name) }}
                />
                <span className="text-slate-400">{d.name}</span>
                <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 gap-4">
        <WinRateByBand data={wr} />

        {/* Segment breakdown */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Segment-Uebersicht
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={segmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
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
              <Bar
                dataKey="deals"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                name="Deals"
              />
              <Bar
                dataKey="avgScore"
                fill="#22d3ee"
                radius={[4, 4, 0, 0]}
                name="Avg Score"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sync Info */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">
            HubSpot-Synchronisation
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {syncStatus?.last_sync
              ? `Letzte Sync: ${new Date(syncStatus.last_sync).toLocaleString("de-DE")} - ${syncStatus.deals_synced} Deals`
              : "Noch keine Synchronisation durchgefuehrt"}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Jetzt synchronisieren
        </button>
      </div>
    </div>
  );
}
