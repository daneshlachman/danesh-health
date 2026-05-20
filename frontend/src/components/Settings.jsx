import { useEffect, useState } from "react";

export default function Settings() {
  const [form, setForm] = useState({
    height_cm: "",
    date_of_birth: "",
    gender: "male",
    avg_daily_steps: 10000,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setForm({
          height_cm: d.height_cm ?? "",
          date_of_birth: d.date_of_birth ?? "",
          gender: d.gender ?? "male",
          avg_daily_steps: d.avg_daily_steps ?? 10000,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = () => {
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        height_cm: parseFloat(form.height_cm) || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender,
        avg_daily_steps: parseInt(form.avg_daily_steps) || 10000,
      }),
    })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .catch(console.error);
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Profile</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Height (cm)</label>
            <input
              type="number"
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
              placeholder="192"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date of birth</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Gender</label>
            <div className="flex gap-2">
              {["male", "female"].map((g) => (
                <button
                  key={g}
                  onClick={() => setForm({ ...form, gender: g })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    form.gender === g
                      ? "bg-brand-500 text-white border-brand-500"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Average daily steps <span className="text-gray-400">(used for TDEE)</span>
            </label>
            <input
              type="number"
              step="500"
              value={form.avg_daily_steps}
              onChange={(e) => setForm({ ...form, avg_daily_steps: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <button
          onClick={save}
          className="w-full bg-brand-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">TDEE calculation</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          TDEE = BMR (Mifflin-St Jeor) + step calories + thermic effect of food + workout calories.
          Garmin calories are used directly. Hevy workouts are estimated at ~5 MET × bodyweight × duration.
        </p>
      </div>
    </div>
  );
}
