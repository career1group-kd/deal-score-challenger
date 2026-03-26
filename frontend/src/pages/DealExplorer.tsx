import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { useDeals, type Deal } from "../hooks/useDeals";
import SegmentFilter from "../components/SegmentFilter";
import DealScoreCard from "../components/DealScoreCard";
import { getBandBgClass } from "../utils/scoring";
import { deals as dealsApi, scenarios as scenariosApi } from "../api/client";

interface ScenarioOption {
  id: string;
  name: string;
  is_baseline: boolean;
}

// Demo data for display when API is not available
const DEMO_DEALS: Deal[] = Array.from({ length: 25 }, (_, i) => {
  const segments = ["Arbeitender", "Unternehmer", "Arbeitsloser"];
  const score = Math.round(Math.random() * 100);
  const band =
    score >= 80 ? "Hot" : score >= 60 ? "Warm" : score >= 40 ? "Nurture" : "Cold";
  return {
    id: `demo-${i}`,
    hubspot_deal_id: `hs-${10000 + i}`,
    deal_name: `Deal ${String.fromCharCode(65 + (i % 26))}${i + 1} GmbH`,
    segment_neu: segments[i % 3],
    deal_stage: "Qualifizierung",
    amount: Math.round(Math.random() * 50000 + 5000),
    is_won: Math.random() > 0.6 ? true : Math.random() > 0.3 ? false : null,
    is_closed: Math.random() > 0.4,
    computed_score: score,
    score_band: band,
    created_at: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
  };
});

export default function DealExplorer() {
  const {
    deals,
    filters,
    sortColumn,
    sortDirection,
    loading,
    setDeals,
    setLoading,
    setFilter,
    resetFilters,
    setSort,
  } = useDeals();

  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOption[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");

  // Load scenarios on mount
  useEffect(() => {
    scenariosApi.getScenarios().then((res) => {
      const opts = (res as ScenarioOption[]) || [];
      setScenarioOptions(opts);
    }).catch(() => {});
  }, []);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<{
    raw_score: number;
    final_score: number;
    band: string;
    components: Array<{
      field: string;
      label: string;
      raw_value: string | null;
      lookup_value: number;
      weight: number;
      weighted_score: number;
      is_simulated?: boolean;
    }>;
    gate_caps: Array<{
      gate_name: string;
      triggered: boolean;
      cap_value: number | null;
      reason: string | null;
    }>;
  } | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dealsApi.getDeals({
        segment: filters.segment || undefined,
        band: filters.band || undefined,
        min_score: filters.minScore > 0 ? filters.minScore : undefined,
        max_score: filters.maxScore < 100 ? filters.maxScore : undefined,
        outcome: filters.outcome || undefined,
        search: filters.search || undefined,
        scenario_id: selectedScenarioId || undefined,
        limit: 500,
      });
      // API returns array directly
      const dealsArr = Array.isArray(result) ? result : (result as any).deals ?? [];
      setDeals(dealsArr as Deal[], dealsArr.length);
    } catch {
      // Use demo data
      setDeals(DEMO_DEALS, DEMO_DEALS.length);
    }
  }, [filters, selectedScenarioId, setDeals, setLoading]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const handleDealClick = async (deal: Deal) => {
    setSelectedDeal(deal);
    setDetailLoading(true);
    try {
      const bd = await dealsApi.getDealScoreBreakdown(deal.id, selectedScenarioId || undefined);
      setBreakdown(bd as typeof breakdown);
    } catch {
      setBreakdown(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Sort + filter deals client-side
  const displayDeals = useMemo(() => {
    let filtered = [...deals];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.deal_name?.toLowerCase().includes(q) ||
          d.segment_neu?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortColumn];
      const bVal = (b as Record<string, unknown>)[sortColumn];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [deals, filters.search, sortColumn, sortDirection]);

  const handleExportCSV = () => {
    const headers = [
      "Deal-Name",
      "Segment",
      "Score",
      "Band",
      "Outcome",
    ];
    const rows = displayDeals.map((d) => [
      d.deal_name ?? "",
      d.segment_neu ?? "",
      String(d.computed_score ?? ""),
      d.score_band ?? "",
      d.is_won === true ? "Gewonnen" : d.is_won === false ? "Verloren" : "Offen",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deals_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 text-blue-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-400" />
    );
  };

  const columns = [
    { key: "deal_name", label: "Deal-Name", width: "w-48" },
    { key: "segment_neu", label: "Segment", width: "w-28" },
    { key: "computed_score", label: "Score", width: "w-20" },
    { key: "score_band", label: "Band", width: "w-24" },
    { key: "is_won", label: "Outcome", width: "w-24" },
    { key: "amount", label: "Betrag", width: "w-24" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Deal-Explorer</h1>
          <p className="text-sm text-slate-400 mt-1">
            {displayDeals.length} Deals
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV Export
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            placeholder="Deal suchen..."
            className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <SegmentFilter
          value={filters.segment}
          onChange={(v) => setFilter("segment", v)}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Band</label>
          <select
            value={filters.band}
            onChange={(e) => setFilter("band", e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="">Alle</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Nurture">Nurture</option>
            <option value="Cold">Cold</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Outcome</label>
          <select
            value={filters.outcome}
            onChange={(e) => setFilter("outcome", e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="">Alle</option>
            <option value="won">Gewonnen</option>
            <option value="lost">Verloren</option>
            <option value="open">Offen</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Score</label>
          <input
            type="number"
            min={0}
            max={100}
            value={filters.minScore}
            onChange={(e) =>
              setFilter("minScore", parseInt(e.target.value) || 0)
            }
            className="w-16 px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white text-center"
            placeholder="Min"
          />
          <span className="text-slate-500">-</span>
          <input
            type="number"
            min={0}
            max={100}
            value={filters.maxScore}
            onChange={(e) =>
              setFilter("maxScore", parseInt(e.target.value) || 100)
            }
            className="w-16 px-2 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white text-center"
            placeholder="Max"
          />
        </div>
        {scenarioOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Szenario</label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Baseline (gespeichert)</option>
              {scenarioOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.is_baseline ? " (Baseline)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={() => {
            resetFilters();
            setSelectedScenarioId("");
          }}
          className="text-xs text-slate-400 hover:text-white"
        >
          Zuruecksetzen
        </button>
      </div>

      {/* Table + Detail side panel */}
      <div className="flex gap-4">
        {/* Table */}
        <div
          className={`bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden ${
            selectedDeal ? "flex-1" : "w-full"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Lade Deals...
            </div>
          ) : displayDeals.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              Keine Deals gefunden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => setSort(col.key)}
                        className={`text-left px-4 py-3 text-slate-400 font-medium cursor-pointer hover:text-white ${col.width}`}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon column={col.key} />
                        </div>
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {displayDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      onClick={() => handleDealClick(deal)}
                      className={`border-b border-slate-700/50 cursor-pointer transition-colors ${
                        selectedDeal?.id === deal.id
                          ? "bg-slate-700/40"
                          : "hover:bg-slate-700/20"
                      }`}
                    >
                      <td className="px-4 py-3 text-white font-medium truncate max-w-[200px]">
                        {deal.deal_name ?? "k.A."}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {deal.segment_neu ?? "k.A."}
                      </td>
                      <td className="px-4 py-3 font-mono text-white">
                        {deal.computed_score?.toFixed(1) ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getBandBgClass(
                            deal.score_band ?? ""
                          )}`}
                        >
                          {deal.score_band ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {deal.is_won === true ? (
                          <span className="text-green-400">Gewonnen</span>
                        ) : deal.is_won === false ? (
                          <span className="text-red-400">Verloren</span>
                        ) : (
                          <span className="text-slate-500">Offen</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {deal.amount
                          ? `${deal.amount.toLocaleString("de-DE")} EUR`
                          : "-"}
                      </td>
                      <td className="px-2 py-3">
                        {deal.hubspot_deal_id && (
                          <a
                            href={`https://app.hubspot.com/contacts/deals/${deal.hubspot_deal_id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 hover:text-blue-400"
                            title="In HubSpot oeffnen"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedDeal && (
          <div className="w-[480px] shrink-0">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">
                  Deal-Details
                </h3>
                <button
                  onClick={() => {
                    setSelectedDeal(null);
                    setBreakdown(null);
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Lade Aufschluesselung...
                </div>
              ) : breakdown ? (
                <DealScoreCard
                  dealName={selectedDeal.deal_name ?? "Unbekannt"}
                  segment={selectedDeal.segment_neu ?? "Unbekannt"}
                  rawScore={breakdown.raw_score}
                  finalScore={breakdown.final_score}
                  band={breakdown.band}
                  components={breakdown.components}
                  gateCaps={breakdown.gate_caps}
                />
              ) : (
                <DealScoreCard
                  dealName={selectedDeal.deal_name ?? "Unbekannt"}
                  segment={selectedDeal.segment_neu ?? "Unbekannt"}
                  rawScore={selectedDeal.computed_score ?? 0}
                  finalScore={selectedDeal.computed_score ?? 0}
                  band={selectedDeal.score_band ?? "Cold"}
                  components={[]}
                  gateCaps={[]}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
