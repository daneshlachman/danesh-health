import { useEffect, useRef, useState } from "react";
import { API } from "../utils/api";
import { invalidateCachePrefix } from "../utils/cache";
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

function compressImage(file, maxPx = 900, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = url;
  });
}

const todayISO = new Date().toISOString().slice(0, 10);

function WeightModal({ entry, onClose, onSaved }) {
  const isNew = !entry;
  const [kg, setKg] = useState(entry ? String(entry.weight_kg) : "");
  const [date, setDate] = useState(entry ? entry.date : todayISO);
  const [photo, setPhoto] = useState(entry?.photo_data || null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const pickPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(await compressImage(file));
  };

  const save = () => {
    const w = parseFloat(kg);
    if (!w) return;
    setSaving(true);
    const url = isNew ? `${API}/api/weight` : `${API}/api/weight/${entry.id}`;
    const method = isNew ? "POST" : "PUT";
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_kg: w, date, photo_data: photo }),
    })
      .then(r => r.json())
      .then(result => { onSaved(result, isNew); onClose(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg shadow-xl p-5 pb-10 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{isNew ? "Add entry" : "Edit entry"}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Weight (kg)</label>
            <input
              autoFocus type="number" step="0.1" value={kg} onChange={e => setKg(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Date</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-2 block">Photo (optional)</label>
          {photo ? (
            <div className="relative w-full rounded-xl overflow-hidden" style={{ maxHeight: 200 }}>
              <img src={photo} alt="weight" className="w-full object-cover rounded-xl" style={{ maxHeight: 200 }} />
              <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center text-gray-600 text-sm">×</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-colors">
              + Add photo
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
        </div>

        <button onClick={save} disabled={saving || !kg} className="w-full bg-brand-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function PhotoModal({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <img src={src} alt="weight" className="max-w-full max-h-full rounded-xl" />
    </div>
  );
}

function CompareModal({ a, b, onClose }) {
  const fmtDate = (iso) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTH_NAMES[m - 1]}`;
  };
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <img src={a.photo_data} alt="" className="flex-1 object-cover w-full min-h-0" />
          <div className="bg-black/60 text-white text-center py-2 shrink-0">
            <p className="text-sm font-bold">{a.weight_kg} kg</p>
            <p className="text-xs text-gray-300">{fmtDate(a.date)}</p>
          </div>
        </div>
        <div className="w-px bg-white/20 shrink-0" />
        <div className="flex-1 flex flex-col min-w-0">
          <img src={b.photo_data} alt="" className="flex-1 object-cover w-full min-h-0" />
          <div className="bg-black/60 text-white text-center py-2 shrink-0">
            <p className="text-sm font-bold">{b.weight_kg} kg</p>
            <p className="text-xs text-gray-300">{fmtDate(b.date)}</p>
          </div>
        </div>
      </div>
      <div className="bg-black py-3 text-center shrink-0">
        <p className="text-xs text-gray-400">Tap to close</p>
      </div>
    </div>
  );
}

export default function WeightHistory({ onBack }) {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEntry, setModalEntry] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [photoSrc, setPhotoSrc] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  const fetchData = () => {
    setLoading(true);
    fetch(`${API}/api/weight?days=${days}`)
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [days]);

  const data = rows.map(r => ({ date: r.date.slice(5), kg: r.weight_kg }));

  const handleDelete = (id) => {
    fetch(`${API}/api/weight/${id}`, { method: "DELETE" })
      .then(() => {
        setRows(prev => prev.filter(r => r.id !== id));
        invalidateCachePrefix("weight-");
      })
      .catch(console.error);
  };

  const handleSaved = (result, isNew) => {
    if (isNew) setRows(prev => [...prev, result]);
    else setRows(prev => prev.map(r => r.id === result.id ? result : r));
    invalidateCachePrefix("weight-");
  };

  const kgs = data.map(d => d.kg).filter(v => v != null);
  const latest = kgs[kgs.length - 1];
  const first = kgs[0];
  const change = latest != null && first != null ? +(latest - first).toFixed(1) : null;
  const changePct = change != null && first ? +((change / first) * 100).toFixed(1) : null;
  const minW = kgs.length ? Math.min(...kgs) : null;
  const maxW = kgs.length ? Math.max(...kgs) : null;
  const avg = kgs.length ? +(kgs.reduce((a, b) => a + b, 0) / kgs.length).toFixed(1) : null;

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
        <KPI label="Entries" value={kgs.length || null} sub="logged" />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No data for this period.</p>
        ) : (() => {
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

      {/* Photo gallery */}
      {rows.some(r => r.photo_data) && (() => {
        const photos = [...rows].reverse().filter(r => r.photo_data);
        const handlePhotoTap = (r) => {
          if (!compareA) {
            setCompareA(r);
          } else if (compareA.id === r.id) {
            setCompareA(null);
          } else {
            setCompareB(r);
          }
        };
        return (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Photos</span>
              {compareA && (
                <span className="text-xs text-brand-500 font-medium">
                  {compareA ? "Tap a second photo to compare" : ""}
                </span>
              )}
              {compareA && (
                <button onClick={() => setCompareA(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {photos.map(r => {
                const isA = compareA?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => handlePhotoTap(r)}
                    className="relative aspect-square overflow-hidden"
                  >
                    <img src={r.photo_data} alt="" className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 transition-colors ${isA ? "bg-brand-500/30 ring-2 ring-brand-500 ring-inset" : "bg-transparent"}`} />
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 py-1 px-1.5">
                      <p className="text-white text-[10px] font-semibold leading-none">{r.weight_kg} kg</p>
                      <p className="text-white/70 text-[9px] leading-none mt-0.5">
                        {(() => { const [,m,d] = r.date.split("-").map(Number); return `${d} ${MONTH_NAMES[m-1]}`; })()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Log list */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Entries</span>
            <button onClick={() => setModalEntry(null)} className="w-6 h-6 flex items-center justify-center rounded-full bg-brand-500 text-white text-base leading-none hover:bg-brand-600 transition-colors">+</button>
          </div>
          <ul className="divide-y divide-gray-50">
            {[...rows].reverse().map(r => {
              const [, m, d] = r.date.split("-").map(Number);
              const label = `${d} ${MONTH_NAMES[m - 1]}`;
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  {r.photo_data ? (
                    <button onClick={() => setPhotoSrc(r.photo_data)} className="shrink-0">
                      <img src={r.photo_data} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-lg shrink-0">⚖</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{r.weight_kg} kg</p>
                    <p className="text-xs text-gray-400">{label} · {r.source || "manual"}</p>
                  </div>
                  <button onClick={() => setModalEntry(r)} className="text-gray-300 hover:text-brand-500 text-sm px-1">✎</button>
                  <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">×</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {modalEntry !== undefined && <WeightModal entry={modalEntry} onClose={() => setModalEntry(undefined)} onSaved={handleSaved} />}
      {photoSrc && <PhotoModal src={photoSrc} onClose={() => setPhotoSrc(null)} />}
      {compareA && compareB && <CompareModal a={compareA} b={compareB} onClose={() => { setCompareA(null); setCompareB(null); }} />}
    </div>
  );
}
