import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

function Ring({ value, goal, label, color, size = 80, inverse = false }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const raw = value != null ? (inverse ? Math.max(0, goal - value) / goal : value / goal) : 0;
  const pct = Math.min(raw, 1);
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={8} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={value != null ? color : "#e5e7eb"} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-gray-900 leading-none">
            {value != null ? Math.round(value) : "—"}
          </span>
          <span className="text-[9px] text-gray-400 leading-none mt-0.5">
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function recoveryColor(score) {
  if (score == null) return "#9ca3af";
  if (score >= 67) return "#22c55e";
  if (score >= 34) return "#eab308";
  return "#ef4444";
}

export default function Dashboard() {
  const [whoop, setWhoop] = useState(null);
  const [weightData, setWeightData] = useState([]);
  const [whoopConnected, setWhoopConnected] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weightDays, setWeightDays] = useState(30);
  const [tdee, setTdee] = useState(null);

  const AUTO_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000;

  const fetchWeight = (days) => {
    fetch(`/api/weight?days=${days}`)
      .then((r) => r.json())
      .then((weights) => setWeightData(weights.map((w) => ({ date: w.date.slice(5), kg: w.weight_kg }))))
      .catch(console.error);
  };

  const handlePeriod = (days) => {
    setWeightDays(days);
    fetchWeight(days);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("whoop_connected")) {
      window.history.replaceState({}, "", "/");
      triggerSync();
      return;
    }

    Promise.all([
      fetch(`/api/weight?days=${weightDays}`).then((r) => r.json()),
      fetch("/api/whoop/status").then((r) => r.json()),
      fetch("/api/tdee/today").then((r) => r.json()),
    ])
      .then(([weights, status, tdeeData]) => {
        setWeightData(weights.map((w) => ({ date: w.date.slice(5), kg: w.weight_kg })));
        setWhoopConnected(status.connected);
        setTdee(tdeeData);

        if (status.connected) {
          const lastSync = parseInt(localStorage.getItem("lastWhoopSync") || "0");
          if (Date.now() - lastSync > AUTO_SYNC_INTERVAL_MS) triggerSync();
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/whoop/today")
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setWhoop(d); })
      .catch(() => {});
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/whoop", { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        localStorage.setItem("lastWhoopSync", Date.now().toString());
        const [weights, today] = await Promise.all([
          fetch(`/api/weight?days=${weightDays}`).then((r) => r.json()),
          fetch("/api/whoop/today").then((r) => r.json()),
        ]);
        setWeightData(weights.map((w) => ({ date: w.date.slice(5), kg: w.weight_kg })));
        if (today && !today.error) setWhoop(today);
        setWhoopConnected(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  const burnPct = tdee ? Math.min(tdee.burned_now / tdee.tdee, 1) : 0;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Today</h1>
        {whoopConnected ? (
          <div className="flex gap-2">
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync Whoop"}
            </button>
            <button
              onClick={async () => {
                await fetch("/api/whoop/disconnect", { method: "POST" });
                setWhoopConnected(false);
              }}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <a href="/api/whoop/authorize" className="text-xs bg-black text-white px-3 py-1.5 rounded-lg font-medium">
            Connect Whoop
          </a>
        )}
      </div>

      {/* Whoop rings 2x2 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <Ring
            value={whoop?.recovery_score}
            goal={100}
            label="Recovery"
            color={recoveryColor(whoop?.recovery_score)}
          />
          <Ring
            value={whoop?.sleep_score}
            goal={100}
            label="Sleep"
            color="#a78bfa"
          />
          <Ring
            value={whoop?.hrv_ms ? Math.round(whoop.hrv_ms) : null}
            goal={100}
            label="HRV (ms)"
            color="#60a5fa"
          />
          <Ring
            value={whoop?.resting_hr}
            goal={80}
            label="Resting HR"
            color="#fb7185"
            inverse={true}
          />
        </div>
      </div>

      {/* Calorie burn bar */}
      {tdee && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Calories burned today</span>
            <span className="text-xs text-gray-400">TDEE ~{tdee.tdee.toLocaleString()} kcal</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-2xl font-bold text-gray-900">{tdee.burned_now.toLocaleString()}</span>
            <span className="text-sm text-gray-400">kcal</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${burnPct * 100}%`, backgroundColor: "#0ea5e9" }}
            />
          </div>
          {tdee.workout_kcal > 0 && (
            <p className="text-xs text-gray-400 mt-1.5">
              incl. {tdee.workout_kcal} kcal from workouts
            </p>
          )}
        </div>
      )}

      {/* Weight chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Weight</p>
          <div className="flex gap-1">
            {PERIODS.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => handlePeriod(days)}
                className={`text-xs px-2 py-0.5 rounded-md font-medium transition-colors ${
                  weightDays === days ? "bg-brand-500 text-white" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {weightData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No weight data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} unit="kg" width={40} />
              <Tooltip formatter={(v) => [`${v} kg`, "Weight"]} />
              <Line type="monotone" dataKey="kg" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
