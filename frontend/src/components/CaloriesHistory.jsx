import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from "recharts";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const todayISO = toLocalISO(new Date());

function KPI({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">{label}</span>
      <span className="text-lg font-bold" style={color ? { color } : { color: "#111827" }}>{value ?? "—"}</span>
      {sub && <span className="text-[10px] text-gray-400 block mt-0.5">{sub}</span>}
    </div>
  );
}

function CalendarHeatmap({ data }) {
  const byDate = Object.fromEntries(data.map(d => [d.date, d]));
  const today = new Date(todayISO + "T12:00:00");
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const days = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  function dayColor(iso) {
    const d = byDate[iso];
    if (!d || d.balance === null) return "bg-gray-100 text-gray-400";
    if (d.balance < -300) return "bg-green-500 text-white";
    if (d.balance < 0) return "bg-green-200 text-green-800";
    if (d.balance < 300) return "bg-orange-200 text-orange-800";
    return "bg-orange-500 text-white";
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[month]} {year}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Deficit
          <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block ml-1" /> Surplus
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {days.map(d => <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array(startOffset).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isFuture = iso > todayISO;
          return (
            <div key={day} className={`rounded-lg text-xs py-1.5 text-center font-medium ${isFuture ? "text-gray-200" : dayColor(iso)}`}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyChart({ data }) {
  const weeks = [];
  let current = [];
  data.forEach((d, i) => {
    current.push(d);
    const dow = new Date(d.date + "T12:00:00").getDay();
    if (dow === 0 || i === data.length - 1) {
      const n = current.length;
      const burned = Math.round(current.reduce((s, x) => s + x.burned, 0) / n);
      const daysWithFood = current.filter(x => x.consumed > 0);
      const consumed = daysWithFood.length
        ? Math.round(daysWithFood.reduce((s, x) => s + x.consumed, 0) / daysWithFood.length)
        : 0;
      const startDate = new Date(current[0].date + "T12:00:00");
      const endDate = new Date(current[current.length - 1].date + "T12:00:00");
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();
      const mon = MONTH_NAMES[startDate.getMonth()];
      const label = startDay === endDay ? `${startDay} ${mon}` : `${startDay}-${endDay} ${mon}`;
      weeks.push({ week: label, burned, consumed });
      current = [];
    }
  });

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-800 mb-3">Avg daily calories per week</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={weeks} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={16} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={42} />
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, border: "1px solid #f0f0f0" }}
            formatter={(v, name) => [`${v.toLocaleString()} kcal`, name === "burned" ? "Burned" : "Consumed"]}
          />
          <Bar dataKey="burned" fill="#bfdbfe" radius={[3,3,0,0]} name="burned" />
          <Bar dataKey="consumed" fill="#0ea5e9" radius={[3,3,0,0]} name="consumed" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <span className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block" />Burned</span>
        <span className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" />Consumed</span>
      </div>
    </div>
  );
}

export default function CaloriesHistory({ onBack }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calories/history?days=30")
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const daysWithData = data.filter(d => d.consumed > 0);
  const avgBurned = daysWithData.length ? Math.round(daysWithData.reduce((s, d) => s + d.burned, 0) / daysWithData.length) : null;
  const avgConsumed = daysWithData.length ? Math.round(daysWithData.reduce((s, d) => s + d.consumed, 0) / daysWithData.length) : null;
  const avgBalance = avgBurned && avgConsumed ? avgConsumed - avgBurned : null;
  const deficitDays = daysWithData.filter(d => d.balance < 0).length;
  const surplusDays = daysWithData.filter(d => d.balance > 0).length;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-xl">←</button>
        <h1 className="text-xl font-bold text-gray-900">Calories</h1>
        <span className="text-xs text-gray-400 ml-1">last 30 days</span>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <KPI label="Avg burned / day" value={avgBurned ? `${avgBurned.toLocaleString()} kcal` : null} />
            <KPI label="Avg consumed / day" value={avgConsumed ? `${avgConsumed.toLocaleString()} kcal` : null} />
            <KPI
              label="Avg daily balance"
              value={avgBalance != null ? `${avgBalance > 0 ? "+" : ""}${avgBalance.toLocaleString()} kcal` : null}
              color={avgBalance == null ? undefined : avgBalance < 0 ? "#22c55e" : "#f97316"}
              sub={avgBalance < 0 ? "avg deficit" : avgBalance > 0 ? "avg surplus" : undefined}
            />
            <KPI label="Deficit / surplus days" value={daysWithData.length ? `${deficitDays}d / ${surplusDays}d` : null} sub="of logged days" />
          </div>

          <CalendarHeatmap data={data} />
          <WeeklyChart data={data} />
        </>
      )}
    </div>
  );
}
