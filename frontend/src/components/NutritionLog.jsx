import { useEffect, useState } from "react";

const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = toLocalISO(new Date());

function dateLabel(iso) {
  if (iso === todayISO) return "Today";
  const yesterday = toLocalISO(new Date(Date.now() - 86400000));
  if (iso === yesterday) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MiniCalendar({ selected, onSelect, onClose }) {
  const selDate = new Date(selected + "T12:00:00");
  const [viewYear, setViewYear] = useState(selDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selDate.getMonth());
  const today = new Date(todayISO + "T12:00:00");
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-lg font-bold">‹</button>
          <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
          <button onClick={nextMonth} disabled={viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-lg font-bold disabled:opacity-30">›</button>
        </div>
        <div className="grid grid-cols-7 mb-1">{days.map(d => <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array(startOffset).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1;
            const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isFuture = iso > todayISO;
            return (
              <button key={day} disabled={isFuture} onClick={() => { onSelect(iso); onClose(); }}
                className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${iso === selected ? "bg-brand-500 text-white" : iso === todayISO ? "bg-brand-50 text-brand-600 font-bold" : isFuture ? "text-gray-200" : "text-gray-700 hover:bg-gray-100"}`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const [logs, setLogs] = useState([]);
  const [date, setDate] = useState(todayISO);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showKcal, setShowKcal] = useState(null); // 'protein' | 'carbs' | 'fat' | null

  const toggleMacro = (macro) => setShowKcal(prev => prev === macro ? null : macro);

  const prevDay = () => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - 1); setDate(toLocalISO(d)); };
  const nextDay = () => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + 1); setDate(toLocalISO(d)); };

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
        <button onClick={prevDay} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-2xl font-light">‹</button>
        <button onClick={() => setCalendarOpen(true)} className="flex flex-col items-center">
          <h1 className="text-xl font-bold text-gray-900">{dateLabel(date)}</h1>
          {date !== todayISO && <span className="text-xs text-gray-400">{new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>}
        </button>
        <button onClick={nextDay} disabled={date >= todayISO} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-2xl font-light disabled:opacity-0">›</button>
      </div>
      {calendarOpen && <MiniCalendar selected={date} onSelect={setDate} onClose={() => setCalendarOpen(false)} />}

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
          <div onClick={() => toggleMacro("protein")} className="cursor-pointer">
            <Ring
              value={showKcal === "protein" ? Math.round(totals.protein_g * 4) : totals.protein_g}
              goal={showKcal === "protein" ? GOALS.protein_g * 4 : GOALS.protein_g}
              label={showKcal === "protein" ? "Protein kcal" : "Protein"}
              color="#60a5fa" size={76}
            />
          </div>
          <div onClick={() => toggleMacro("carbs")} className="cursor-pointer">
            <Ring
              value={showKcal === "carbs" ? Math.round(totals.carbs_g * 4) : totals.carbs_g}
              goal={showKcal === "carbs" ? GOALS.carbs_g * 4 : GOALS.carbs_g}
              label={showKcal === "carbs" ? "Carbs kcal" : "Carbs"}
              color="#fbbf24" size={76}
            />
          </div>
          <div onClick={() => toggleMacro("fat")} className="cursor-pointer">
            <Ring
              value={showKcal === "fat" ? Math.round(totals.fat_g * 9) : totals.fat_g}
              goal={showKcal === "fat" ? GOALS.fat_g * 9 : GOALS.fat_g}
              label={showKcal === "fat" ? "Fat kcal" : "Fat"}
              color="#fb7185" size={76}
            />
          </div>
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
