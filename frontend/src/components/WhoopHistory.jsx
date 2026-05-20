import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
];

const METRICS = [
  { key: "recovery_score", label: "Recovery", color: "#22c55e", unit: "%" },
  { key: "sleep_score",    label: "Sleep Score", color: "#a78bfa", unit: "%" },
  { key: "hrv_ms",        label: "HRV", color: "#60a5fa", unit: "ms" },
  { key: "resting_hr",    label: "Resting HR", color: "#fb7185", unit: "bpm" },
  { key: "sleep_duration_hours", label: "Sleep Duration", color: "#818cf8", unit: "h" },
];

function MetricChart({ data, metric, days }) {
  const values = data.map(d => d[metric.key]).filter(v => v != null);
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : null;
  const chartData = data.map(d => ({ date: d.date.slice(5), value: d[metric.key] }));

  const tickCount = days <= 7 ? 7 : days <= 30 ? 6 : 6;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">{metric.label}</span>
        {avg != null && (
          <span className="text-xs text-gray-400">avg {metric.key === "sleep_duration_hours" ? avg.toFixed(1) : Math.round(avg)} {metric.unit}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" tickCount={tickCount} />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 9 }}
            unit={metric.unit}
            width={metric.unit === "bpm" || metric.unit === "ms" ? 42 : 32}
          />
          <Tooltip formatter={v => v != null ? [`${metric.key === "sleep_duration_hours" ? v.toFixed(1) : Math.round(v)} ${metric.unit}`, metric.label] : ["—", metric.label]} />
          {avg != null && (
            <ReferenceLine y={avg} stroke={metric.color} strokeDasharray="4 4" strokeOpacity={0.4} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={metric.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WhoopHistory({ onBack }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/whoop/history?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-xl">
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Whoop History</h1>
        <div className="flex gap-1">
          {PERIODS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${days === d ? "bg-brand-500 text-white" : "text-gray-400 hover:text-gray-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No data for this period.</p>
      ) : (
        METRICS.map(metric => (
          <MetricChart key={metric.key} data={data} metric={metric} days={days} />
        ))
      )}
    </div>
  );
}
