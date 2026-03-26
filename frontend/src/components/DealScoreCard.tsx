import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { getBandBgClass } from "../utils/scoring";

interface ScoreComponent {
  field: string;
  label: string;
  raw_value: string | null;
  lookup_value: number;
  weight: number;
  weighted_score: number;
  is_simulated?: boolean;
}

interface GateResult {
  gate_name: string;
  triggered: boolean;
  cap_value: number | null;
  reason: string | null;
}

interface Props {
  dealName: string;
  segment: string;
  rawScore: number;
  finalScore: number;
  band: string;
  components: ScoreComponent[];
  gateCaps: GateResult[];
}

export default function DealScoreCard({
  dealName,
  segment,
  rawScore,
  finalScore,
  band,
  components,
  gateCaps,
}: Props) {
  const hasAnySimulated = components.some((c) => c.is_simulated);

  // Waterfall: cumulative score building
  const waterfallData = components
    .filter((c) => c.weighted_score > 0)
    .map((c) => ({
      name: c.is_simulated ? `${c.label} ~` : c.label,
      value: Math.round(c.weighted_score * 100) / 100,
      rawValue: c.raw_value,
      isSimulated: c.is_simulated ?? false,
    }));

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{dealName}</h3>
          <p className="text-sm text-slate-400">{segment}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">
            {finalScore.toFixed(1)}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${getBandBgClass(
              band
            )}`}
          >
            {band}
          </span>
        </div>
      </div>

      {rawScore !== finalScore && (
        <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400">
            Rohscore: {rawScore.toFixed(1)} - Gate-Caps angewendet
          </p>
          {gateCaps
            .filter((g) => g.triggered)
            .map((g, i) => (
              <p key={i} className="text-xs text-amber-300 mt-1">
                {g.gate_name}: {g.reason}
              </p>
            ))}
        </div>
      )}

      <h4 className="text-sm font-semibold text-slate-400 mb-3">
        Score-Aufschluesselung
      </h4>
      <ResponsiveContainer width="100%" height={Math.max(200, waterfallData.length * 32)}>
        <BarChart data={waterfallData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#475569" }}
            domain={[0, "auto"]}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#475569" }}
            width={140}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
              color: "#f1f5f9",
            }}
            formatter={(value, _name, props) => {
              const rawVal = (props as { payload?: { rawValue?: string | null } })?.payload?.rawValue;
              return [`${value} Pkt (Wert: ${rawVal ?? "k.A."})`, "Score"];
            }}
          />
          <ReferenceLine x={0} stroke="#475569" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {waterfallData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.isSimulated ? "#f59e0b" : index % 2 === 0 ? "#3b82f6" : "#6366f1"}
                fillOpacity={entry.isSimulated ? 0.7 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend for simulated values */}
      {hasAnySimulated && (
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>HubSpot-Daten</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-70" />
            <span>Simuliert</span>
          </div>
        </div>
      )}

      {/* Components table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left py-2 pr-1 w-4"></th>
              <th className="text-left py-2 pr-4">Kriterium</th>
              <th className="text-left py-2 pr-4">Wert</th>
              <th className="text-right py-2 pr-4">Lookup</th>
              <th className="text-right py-2 pr-4">Gewicht</th>
              <th className="text-right py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {components.map((c, i) => (
              <tr key={i} className="border-b border-slate-700/50">
                <td className="py-1.5 pr-1">
                  {c.is_simulated ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 opacity-70" title="Simulierter Wert" />
                  ) : c.raw_value != null ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" title="HubSpot-Daten" />
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-600" title="Kein Wert" />
                  )}
                </td>
                <td className="py-1.5 pr-4 text-slate-300">{c.label}</td>
                <td className={`py-1.5 pr-4 ${c.is_simulated ? "text-amber-400/80 italic" : "text-slate-400"}`}>
                  {c.raw_value ?? "k.A."}
                </td>
                <td className="py-1.5 pr-4 text-right text-slate-400">
                  {c.lookup_value.toFixed(2)}
                </td>
                <td className="py-1.5 pr-4 text-right text-slate-400">
                  {c.weight}
                </td>
                <td className="py-1.5 text-right font-mono text-white">
                  {c.weighted_score.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
