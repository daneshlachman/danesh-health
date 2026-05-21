import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "2M", days: 60 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatXTick(dateStr, days) {
  const [m, d] = dateStr.split("-").map(Number);
  const mon = MONTH_NAMES[m - 1];
  if (days <= 30) return `${d} ${mon}`;
  if (d <= 3) return mon;
  return "";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const [m, d] = (label || "").split("-").map(Number);
  const formatted = m && d ? `${d} ${MONTH_NAMES[m - 1]}` : label;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs text-gray-400 mb-0.5">{formatted}</p>
      <p className="text-sm font-bold text-gray-900">{payload[0].value} kg</p>
    </div>
  );
};

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
        ) : (() => {
          const kgs = data.map(d => d.kg).filter(Boolean);
          const rangeKg = Math.max(...kgs) - Math.min(...kgs);
          const step = rangeKg <= 2 ? 0.5 : rangeKg <= 5 ? 1 : rangeKg <= 10 ? 2 : 2.5;
          const minT = Math.floor(Math.min(...kgs) / step) * step;
          const maxT = Math.ceil(Math.max(...kgs) / step) * step;
          const yTicks = [];
          for (let t = minT; t <= maxT + 0.01; t += step) yTicks.push(Math.round(t * 10) / 10);
          return (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={d => formatXTick(d, days)}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minT - 0.25, maxT + 0.25]}
                ticks={yTicks}
                tickFormatter={v => Number.isInteger(v) ? `${v}` : `${v.toFixed(1)}`}
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                unit="kg"
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x="03-28" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "28 Mar", position: "top", fontSize: 9, fill: "#f59e0b" }} />
              {avg && <ReferenceLine y={avg} stroke="#0ea5e9" strokeDasharray="4 4" strokeOpacity={0.3} />}
              <Line type="monotone" dataKey="kg" stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, fill: "#0ea5e9", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
          );
        })()}
      </div>
    </div>
  );
}
