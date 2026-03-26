import { RotateCcw } from "lucide-react";

interface WeightSliderProps {
  label: string;
  weightKey: string;
  value: number;
  defaultValue: number;
  max: number;
  onChange: (key: string, value: number) => void;
  onReset: (key: string) => void;
}

export default function WeightSlider({
  label,
  weightKey,
  value,
  defaultValue,
  max,
  onChange,
  onReset,
}: WeightSliderProps) {
  const isChanged = value !== defaultValue;
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="group flex items-center gap-4 py-2">
      <div className="w-44 shrink-0">
        <span className="text-sm text-slate-300 font-medium">{label}</span>
      </div>

      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={max}
          step={0.5}
          value={value}
          onChange={(e) => onChange(weightKey, parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-blue-500"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, #334155 ${pct}%, #334155 100%)`,
          }}
        />
      </div>

      <div className="w-14 text-right">
        <span
          className={`text-sm font-mono font-bold ${
            isChanged ? "text-amber-400" : "text-white"
          }`}
        >
          {value}
        </span>
      </div>

      <button
        onClick={() => onReset(weightKey)}
        disabled={!isChanged}
        className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Zuruecksetzen"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
