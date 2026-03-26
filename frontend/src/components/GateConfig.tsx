import type { GateRule } from "../utils/scoring";

interface GateConfigProps {
  label: string;
  gateName: string;
  rule: GateRule;
  onChange: (gateName: string, rule: Partial<GateRule>) => void;
}

export default function GateConfigComponent({
  label,
  gateName,
  rule,
  onChange,
}: GateConfigProps) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <label className="flex items-center gap-3 flex-1">
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          onClick={() => onChange(gateName, { enabled: !rule.enabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            rule.enabled ? "bg-blue-600" : "bg-slate-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
              rule.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm text-slate-300 font-medium">{label}</span>
      </label>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Cap:</span>
        <input
          type="number"
          min={0}
          max={100}
          value={rule.cap}
          onChange={(e) =>
            onChange(gateName, { cap: parseFloat(e.target.value) || 0 })
          }
          disabled={!rule.enabled}
          className="w-16 px-2 py-1 text-sm bg-slate-900 border border-slate-700 rounded text-white disabled:opacity-40 text-center"
        />
      </div>
    </div>
  );
}
