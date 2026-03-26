import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getBandColor } from "../utils/scoring";

interface WinRateData {
  band: string;
  win_rate: number;
  total: number;
  won: number;
}

interface Props {
  data: WinRateData[];
  height?: number;
}

export default function WinRateByBand({ data, height = 280 }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    win_rate_pct: Math.round(d.win_rate * 100),
  }));

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        Win-Rate nach Band
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
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
            formatter={(value) => [`${value}%`, "Win-Rate"]}
          />
          <Bar dataKey="win_rate_pct" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getBandColor(entry.band)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
