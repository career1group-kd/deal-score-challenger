import { cn } from "../utils/cn";
import type { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-slate-800/50 border border-slate-700/50 rounded-xl p-5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
