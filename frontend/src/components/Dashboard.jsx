import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function StatCard({ label, value, unit, sub, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-gray-900"}`}>
        {value ?? "—"} <span className="text-sm font-normal text-gray-500">{unit}</span>
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function recoveryColor(score) {
  if (score == null) return "text-gray-900";
  if (score >= 67) return "text-green-600";
  if (score >= 34) return "text-yellow-500";
  return "text-red-500";
}

export default function Dashboard() {
  const [whoop, setWhoop] = useState(null);
  const [weightData, setWeightData] = useState([]);
  const [whoopConnected, setWhoopConnected] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const AUTO_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("whoop_connected")) {
      window.history.replaceState({}, "", "/");
      triggerSync();
      return;
    }

    Promise.all([
      fetch("/api/weight?days=30").then((r) => r.json()),
      fetch("/api/whoop/status").then((r) => r.json()),
    ])
      .then(([weights, status]) => {
        setWeightData(weights.map((w) => ({ date: w.date.slice(5), kg: w.weight_kg })));
        setWhoopConnected(status.connected);

        // Auto-sync if connected and last sync > 4 hours ago
        if (status.connected) {
          const lastSync = parseInt(localStorage.getItem("lastWhoopSync") || "0");
          if (Date.now() - lastSync > AUTO_SYNC_INTERVAL_MS) {
            triggerSync();
          }
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
        // Reload weight + today's data
        const [weights, today] = await Promise.all([
          fetch("/api/weight?days=30").then((r) => r.json()),
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

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
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
          <a
            href="/api/whoop/authorize"
            className="text-xs bg-black text-white px-3 py-1.5 rounded-lg font-medium"
          >
            Connect Whoop
          </a>
        )}
      </div>

      {/* Whoop stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Recovery"
          value={whoop?.recovery_score}
          unit="%"
          sub="Whoop"
          color={recoveryColor(whoop?.recovery_score)}
        />
        <StatCard label="HRV" value={whoop?.hrv_ms ? Math.round(whoop.hrv_ms) : null} unit="ms" sub="Whoop" />
        <StatCard label="Resting HR" value={whoop?.resting_hr} unit="bpm" sub="Whoop" />
        <StatCard
          label="Sleep"
          value={whoop?.sleep_duration_hours?.toFixed(1)}
          unit="h"
          sub={whoop?.sleep_score ? `Score ${Math.round(whoop.sleep_score)}%` : undefined}
        />
      </div>

      {/* Weight chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
          Weight (30 days)
        </p>
        {weightData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No weight data yet — sync Whoop or log manually.
          </p>
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
