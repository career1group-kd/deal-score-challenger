interface SegmentFilterProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  includeAll?: boolean;
}

const SEGMENTS = [
  { value: "FbW - WB BGS", label: "FbW - WB BGS (Arbeitsloser)" },
  { value: "FbW - WB QCG", label: "FbW - WB QCG (Arbeitender)" },
  { value: "SZ P", label: "SZ P (Unternehmer)" },
];

export default function SegmentFilter({
  value,
  onChange,
  label = "Segment",
  includeAll = true,
}: SegmentFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        {includeAll && <option value="">Alle</option>}
        {SEGMENTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
