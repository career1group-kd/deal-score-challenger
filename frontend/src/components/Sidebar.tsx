import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  SlidersHorizontal,
  Table2,
  FlaskConical,
  GitCompareArrows,
} from "lucide-react";
import { cn } from "../utils/cn";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/scenario", icon: SlidersHorizontal, label: "Szenario-Builder" },
  { to: "/deals", icon: Table2, label: "Deal-Explorer" },
  { to: "/backtest", icon: FlaskConical, label: "Backtest" },
  { to: "/compare", icon: GitCompareArrows, label: "Vergleich" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-700/50 bg-slate-900 flex flex-col">
      <div className="px-5 py-6 border-b border-slate-700/50">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Deal Score Simulator
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-700/60 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-700/50 text-xs text-slate-500">
        v1.0.0
      </div>
    </aside>
  );
}
