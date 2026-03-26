interface Props {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  threshold: number;
}

export default function ConfusionMatrix({
  tp,
  fp,
  tn,
  fn,
  accuracy,
  precision,
  recall,
  f1,
  threshold,
}: Props) {
  const total = tp + fp + tn + fn || 1;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">
        Konfusionsmatrix
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Schwellenwert: {threshold}
      </p>

      <div className="flex justify-center mb-6">
        <div className="grid grid-cols-3 gap-0 text-center text-sm">
          {/* Header row */}
          <div />
          <div className="px-4 py-2 text-slate-400 font-medium text-xs">
            Vorhergesagt: Gewonnen
          </div>
          <div className="px-4 py-2 text-slate-400 font-medium text-xs">
            Vorhergesagt: Verloren
          </div>

          {/* Row 1 */}
          <div className="px-4 py-2 text-slate-400 font-medium text-xs text-right">
            Tatsaechlich: Gewonnen
          </div>
          <div className="px-6 py-4 bg-green-500/20 border border-green-500/30 rounded-tl-lg">
            <div className="text-xl font-bold text-green-400">{tp}</div>
            <div className="text-xs text-green-500">
              TP ({((tp / total) * 100).toFixed(1)}%)
            </div>
          </div>
          <div className="px-6 py-4 bg-red-500/20 border border-red-500/30 rounded-tr-lg">
            <div className="text-xl font-bold text-red-400">{fn}</div>
            <div className="text-xs text-red-500">
              FN ({((fn / total) * 100).toFixed(1)}%)
            </div>
          </div>

          {/* Row 2 */}
          <div className="px-4 py-2 text-slate-400 font-medium text-xs text-right">
            Tatsaechlich: Verloren
          </div>
          <div className="px-6 py-4 bg-orange-500/20 border border-orange-500/30 rounded-bl-lg">
            <div className="text-xl font-bold text-orange-400">{fp}</div>
            <div className="text-xs text-orange-500">
              FP ({((fp / total) * 100).toFixed(1)}%)
            </div>
          </div>
          <div className="px-6 py-4 bg-green-500/20 border border-green-500/30 rounded-br-lg">
            <div className="text-xl font-bold text-green-400">{tn}</div>
            <div className="text-xs text-green-500">
              TN ({((tn / total) * 100).toFixed(1)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Genauigkeit", value: accuracy },
          { label: "Praezision", value: precision },
          { label: "Recall", value: recall },
          { label: "F1-Score", value: f1 },
        ].map((m) => (
          <div
            key={m.label}
            className="text-center px-3 py-2 bg-slate-900/50 rounded-lg"
          >
            <div className="text-xs text-slate-500">{m.label}</div>
            <div className="text-lg font-bold text-white">
              {(m.value * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
