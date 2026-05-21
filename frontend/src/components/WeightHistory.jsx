import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

function KPI({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">{label}</span>
      <span className="text-lg font-bold text-gray-900" style={color ? { color } : {}}>
        {value ?? "—"}
      </span>
      {sub && <span className="text-[10px] text-gray-400 block mt-0.5">{sub}</span>}
    </div>
  );
}

export default function WeightHistory({ onBack }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/weight?days=${days}`)
      .then(r => r.json())
      .then(rows => setData(rows.map(r => ({ date: r.date.slice(5), kg: r.weight_kg }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const weights = data.map(d => d.kg).filter(v => v != null);
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const change = latest != null && first != null ? +(latest - first).toFixed(1) : null;
  const changePct = change != null && first ? +((change / first) * 100).toFixed(1) : null;
  const minW = weights.length ? Math.min(...weights) : null;
  const maxW = weights.length ? Math.max(...weights) : null;
  const avg = weights.length ? +(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : null;

  const changeColor = change == null ? undefined : change < 0 ? "#22c55e" : change > 0 ? "#ef4444" : undefined;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-xl">←</button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Weight</h1>
        <div className="flex gap-1">
          {PERIODS.map(({ label, days: d }) => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${days === d ? "bg-brand-500 text-white" : "text-gray-400 hover:text-gray-600"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KPI label="Current" value={latest ? `${latest} kg` : null} />
        <KPI
          label={`Change (${PERIODS.find(p => p.days === days)?.label})`}
          value={change != null ? `${change > 0 ? "+" : ""}${change} kg` : null}
          sub={changePct != null ? `${changePct > 0 ? "+" : ""}${changePct}%` : null}
          color={changeColor}
        />
        <KPI label="Lowest" value={minW ? `${minW} kg` : null} />
        <KPI label="Highest" value={maxW ? `${maxW} kg` : null} />
        <KPI label="Average" value={avg ? `${avg} kg` : null} />
        <KPI label="Entries" value={weights.length || null} sub="logged" />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} unit="kg" width={42} />
              <Tooltip formatter={v => [`${v} kg`, "Weight"]} />
              {avg && <ReferenceLine y={avg} stroke="#0ea5e9" strokeDasharray="4 4" strokeOpacity={0.4} />}
              <Line type="monotone" dataKey="kg" stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
