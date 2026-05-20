import { useEffect, useState } from "react";

const GOALS = { calories: 2400, protein_g: 180, carbs_g: 240, fat_g: 80 };
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function Ring({ value, goal, label, color, size = 80 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / goal, 1);
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={8} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-gray-900 leading-none">{Math.round(value)}</span>
          <span className="text-[9px] text-gray-400 leading-none mt-0.5">{Math.round((value / goal) * 100)}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function MealSection({ meal, entries, onDelete }) {
  if (entries.length === 0) return null;

  const total = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {MEAL_LABELS[meal] || meal}
        </span>
        <span className="text-xs text-gray-400">{Math.round(total.calories)} kcal</span>
      </div>

      <ul className="divide-y divide-gray-50">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{entry.description}</p>
              <div className="flex gap-3 mt-0.5">
                <span className="text-xs font-medium text-gray-600">{Math.round(entry.calories ?? 0)} kcal</span>
                <span className="text-xs text-blue-500">P {Math.round(entry.protein_g ?? 0)}g</span>
                <span className="text-xs text-amber-500">C {Math.round(entry.carbs_g ?? 0)}g</span>
                <span className="text-xs text-rose-500">F {Math.round(entry.fat_g ?? 0)}g</span>
              </div>
            </div>
            <button
              onClick={() => onDelete(entry.id)}
              className="text-gray-300 hover:text-red-400 text-base leading-none mt-1 shrink-0"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {entries.length > 1 && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex gap-4">
          <span className="text-xs font-semibold text-gray-700">Total</span>
          <span className="text-xs font-semibold text-gray-700">{Math.round(total.calories)} kcal</span>
          <span className="text-xs text-blue-600 font-medium">P {Math.round(total.protein_g)}g</span>
          <span className="text-xs text-amber-600 font-medium">C {Math.round(total.carbs_g)}g</span>
          <span className="text-xs text-rose-600 font-medium">F {Math.round(total.fat_g)}g</span>
        </div>
      )}
    </div>
  );
}

export default function NutritionLog() {
  const today = new Date().toISOString().slice(0, 10);
  const [logs, setLogs] = useState([]);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);

  const fetchLogs = (d) => {
    setLoading(true);
    fetch(`/api/nutrition?date=${d}`)
      .then((r) => r.json())
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(date); }, [date]);

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein_g: acc.protein_g + (l.protein_g || 0),
      carbs_g: acc.carbs_g + (l.carbs_g || 0),
      fat_g: acc.fat_g + (l.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const byMeal = MEAL_ORDER.reduce((acc, meal) => {
    acc[meal] = logs.filter((l) => l.meal_type === meal);
    return acc;
  }, {});

  const handleDelete = (id) => {
    fetch(`/api/nutrition/${id}`, { method: "DELETE" })
      .then(() => setLogs((prev) => prev.filter((l) => l.id !== id)))
      .catch(console.error);
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Nutrition</h1>
        <input
          type="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1"
        />
      </div>

      {/* Calorie + macros */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-4">
        {/* Big calorie ring */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative" style={{ width: 120, height: 120 }}>
            <svg width={120} height={120} className="-rotate-90" style={{ display: "block" }}>
              <circle cx={60} cy={60} r={52} fill="none" stroke="#f0f0f0" strokeWidth={10} />
              <circle cx={60} cy={60} r={52} fill="none" stroke="#0ea5e9" strokeWidth={10}
                strokeDasharray={`${Math.min(totals.calories / GOALS.calories, 1) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                strokeLinecap="round" style={{ transition: "stroke-dasharray 0.4s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 leading-none">{Math.round(totals.calories)}</span>
              <span className="text-xs text-gray-400 mt-0.5">kcal</span>
              <span className="text-[10px] text-gray-300 leading-none">of {GOALS.calories}</span>
            </div>
          </div>
        </div>

        {/* Macro rings row */}
        <div className="flex justify-around w-full">
          <Ring value={totals.protein_g} goal={GOALS.protein_g} label="Protein" color="#60a5fa" size={76} />
          <Ring value={totals.carbs_g} goal={GOALS.carbs_g} label="Carbs" color="#fbbf24" size={76} />
          <Ring value={totals.fat_g} goal={GOALS.fat_g} label="Fat" color="#fb7185" size={76} />
        </div>
      </div>

      {/* Meals */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading…</p>
      ) : (
        MEAL_ORDER.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={byMeal[meal]}
            onDelete={handleDelete}
          />
        ))
      )}

      {!loading && logs.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Nothing logged yet. Tell Claude what you ate in the Chat tab.
        </p>
      )}
    </div>
  );
}
