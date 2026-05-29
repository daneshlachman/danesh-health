import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { api } from '../utils/api';
import { colors, card, spacing, radius } from '../utils/colors';
import LineChart from '../components/LineChart';

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];

type DayData = { date: string; burned: number; consumed: number; balance: number };

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH[m - 1]}`;
}

function balanceBg(balance: number | null) {
  if (balance == null) return colors.gray[100];
  if (balance < -300) return '#22c55e';
  if (balance < 0)    return '#bbf7d0';
  if (balance < 300)  return '#fed7aa';
  return '#f97316';
}
function balanceTextColor(balance: number | null) {
  if (balance == null) return colors.gray[400];
  if (balance < -300 || balance >= 300) return '#fff';
  if (balance < 0) return '#166534';
  return '#7c2d12';
}

function CalendarHeatmap({ data }: { data: DayData[] }) {
  const byDate: Record<string, DayData> = {};
  data.forEach(d => { byDate[d.date] = d; });

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [selected, setSelected] = useState<string | null>(null);

  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const selData = selected ? byDate[selected] : null;

  return (
    <View style={[card]}>
      <View style={hmStyles.header}>
        <Text style={hmStyles.title}>{MONTH[month]} {year}</Text>
        <View style={hmStyles.legend}>
          <View style={[hmStyles.dot, { backgroundColor: '#22c55e' }]} /><Text style={hmStyles.legTxt}>Deficit</Text>
          <View style={[hmStyles.dot, { backgroundColor: '#f97316', marginLeft: spacing.sm }]} /><Text style={hmStyles.legTxt}>Surplus</Text>
        </View>
      </View>

      {/* Day headers */}
      <View style={hmStyles.row}>
        {DAYS_SHORT.map(d => <Text key={d} style={hmStyles.dayHdr}>{d}</Text>)}
      </View>

      {/* Grid */}
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={hmStyles.row}>
          {cells.slice(w * 7, w * 7 + 7).map((d, j) => {
            if (!d) return <View key={j} style={hmStyles.cell} />;
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const entry = byDate[iso];
            const isFuture = iso > todayISO;
            const bg = isFuture ? colors.gray[50] : balanceBg(entry?.balance ?? null);
            const tc = isFuture ? colors.gray[200] : balanceTextColor(entry?.balance ?? null);
            const isSelected = iso === selected;
            return (
              <TouchableOpacity key={j} disabled={isFuture}
                onPress={() => setSelected(isSelected ? null : iso)}
                style={[hmStyles.cell, { backgroundColor: bg }, isSelected && hmStyles.selectedCell]}>
                <Text style={[hmStyles.cellDay, { color: tc }]}>{d}</Text>
                {entry && !isFuture && (
                  <Text style={[hmStyles.cellVal, { color: tc }]}>{entry.balance > 0 ? '+' : ''}{entry.balance}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Selected day detail */}
      {selected && selData && (
        <View style={hmStyles.detail}>
          <Text style={hmStyles.detailDate}>
            {new Date(selected + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <View style={hmStyles.detailRow}>
            <View>
              <Text style={hmStyles.detailLabel}>BURNED</Text>
              <Text style={hmStyles.detailValue}>{selData.burned.toLocaleString()} kcal</Text>
            </View>
            <View>
              <Text style={hmStyles.detailLabel}>CONSUMED</Text>
              <Text style={hmStyles.detailValue}>{selData.consumed > 0 ? `${selData.consumed.toLocaleString()} kcal` : '—'}</Text>
            </View>
            <View>
              <Text style={hmStyles.detailLabel}>BALANCE</Text>
              <Text style={[hmStyles.detailValue, { color: selData.balance < 0 ? colors.status.green : colors.status.orange }]}>
                {selData.balance > 0 ? '+' : ''}{selData.balance.toLocaleString()} kcal
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function WeeklyBarChart({ data, width }: { data: DayData[]; width: number }) {
  // Group into weeks
  const weeks: { label: string; burned: number; consumed: number }[] = [];
  let current: DayData[] = [];
  data.forEach((d, i) => {
    current.push(d);
    const dow = new Date(d.date + 'T12:00:00').getDay();
    if (dow === 0 || i === data.length - 1) {
      const withFood = current.filter(x => x.consumed > 0);
      const burned = Math.round(current.reduce((s, x) => s + x.burned, 0) / current.length);
      const consumed = withFood.length ? Math.round(withFood.reduce((s, x) => s + x.consumed, 0) / withFood.length) : 0;
      const s = new Date(current[0].date + 'T12:00:00');
      const e = new Date(current[current.length - 1].date + 'T12:00:00');
      weeks.push({ label: `${s.getDate()}-${e.getDate()} ${MONTH[s.getMonth()]}`, burned, consumed });
      current = [];
    }
  });

  if (!weeks.length) return null;

  const H = 160, PAD = { top: 10, bottom: 24, left: 40, right: 8 };
  const W = width - PAD.left - PAD.right;
  const maxV = Math.max(...weeks.flatMap(w => [w.burned, w.consumed]));
  const barW = Math.max(8, (W / weeks.length) / 3);
  const gap = (W / weeks.length) - barW * 2 - 4;

  const barH = (v: number) => ((v / maxV) * (H - PAD.top - PAD.bottom));
  const barY = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) - barH(v);

  return (
    <View style={card}>
      <Text style={wStyles.title}>Avg daily calories per week</Text>
      <Svg width={width - 32} height={H}>
        {weeks.map((w, i) => {
          const x = PAD.left + i * (W / weeks.length);
          const labelX = x + barW + 2;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={barY(w.burned)} width={barW} height={barH(w.burned)} fill="#bfdbfe" rx={3} />
              <Rect x={x + barW + 4} y={barY(w.consumed)} width={barW} height={barH(w.consumed)} fill={colors.brand[500]} rx={3} />
              <SvgText x={labelX} y={H - 4} fontSize={8} fill={colors.gray[400]} textAnchor="middle">{w.label}</SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={wStyles.legend}>
        <View style={wStyles.legItem}><View style={[wStyles.dot, { backgroundColor: '#bfdbfe' }]} /><Text style={wStyles.legTxt}>Burned</Text></View>
        <View style={wStyles.legItem}><View style={[wStyles.dot, { backgroundColor: colors.brand[500] }]} /><Text style={wStyles.legTxt}>Consumed</Text></View>
      </View>
    </View>
  );
}

// Need React import for Fragment
import React from 'react';

export default function CaloriesHistoryScreen({ navigation }: any) {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiDays, setKpiDays] = useState(7);
  const { width } = useWindowDimensions();

  useEffect(() => {
    api.get('/api/calories/history?days=30')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpiData = kpiDays === 7 ? data.slice(-7) : data;
  const withFood = kpiData.filter(d => d.consumed > 0);
  const avgBurned   = withFood.length ? Math.round(withFood.reduce((s, d) => s + d.burned, 0)   / withFood.length) : null;
  const avgConsumed = withFood.length ? Math.round(withFood.reduce((s, d) => s + d.consumed, 0) / withFood.length) : null;

  const burnedData   = data.map(d => ({ label: fmtDate(d.date), value: d.burned }));
  const consumedData = data.filter(d => d.consumed > 0).map(d => ({ label: fmtDate(d.date), value: d.consumed }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Calories</Text>
            <Text style={styles.subtitle}>last 30 days</Text>
          </View>
          <View style={styles.filters}>
            {[7, 30].map(d => (
              <TouchableOpacity key={d} onPress={() => setKpiDays(d)}
                style={[styles.filterBtn, kpiDays === d && styles.filterActive]}>
                <Text style={[styles.filterTxt, kpiDays === d && styles.filterActiveTxt]}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? <ActivityIndicator color={colors.brand[500]} style={{ marginTop: 40 }} /> : (
          <>
            {/* KPIs */}
            <View style={styles.kpiRow}>
              <View style={[card, styles.kpiCard]}>
                <Text style={styles.kpiLabel}>AVG BURNED</Text>
                <Text style={styles.kpiValue}>{avgBurned?.toLocaleString() ?? '—'}</Text>
                <Text style={styles.kpiUnit}>kcal / day</Text>
              </View>
              <View style={[card, styles.kpiCard]}>
                <Text style={styles.kpiLabel}>AVG CONSUMED</Text>
                <Text style={styles.kpiValue}>{avgConsumed?.toLocaleString() ?? '—'}</Text>
                <Text style={styles.kpiUnit}>kcal / day</Text>
              </View>
            </View>

            {/* Calendar heatmap — BOVEN de grafieken */}
            <CalendarHeatmap data={data} />

            {/* Weekly bar chart */}
            <WeeklyBarChart data={data} width={width - 32} />

            {/* Line charts */}
            {burnedData.length > 1 && (
              <View style={card}>
                <Text style={styles.chartTitle}>BURNED</Text>
                <LineChart data={burnedData} width={width - 64} height={160} color={colors.brand[500]} avgLine={avgBurned ?? undefined} />
              </View>
            )}
            {consumedData.length > 1 && (
              <View style={card}>
                <Text style={styles.chartTitle}>CONSUMED</Text>
                <LineChart data={consumedData} width={width - 64} height={160} color={colors.status.green} avgLine={avgConsumed ?? undefined} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bg },
  content:        { padding: spacing.lg, gap: spacing.md },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center' },
  backArrow:      { fontSize: 18, color: colors.gray[600] },
  title:          { fontSize: 22, fontWeight: '700', color: colors.gray[900] },
  subtitle:       { fontSize: 12, color: colors.gray[400] },
  filters:        { flexDirection: 'row', gap: 4 },
  filterBtn:      { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.md },
  filterActive:   { backgroundColor: colors.brand[500] },
  filterTxt:      { fontSize: 12, fontWeight: '500', color: colors.gray[400] },
  filterActiveTxt:{ color: colors.white },
  kpiRow:         { flexDirection: 'row', gap: spacing.md },
  kpiCard:        { flex: 1, gap: 2 },
  kpiLabel:       { fontSize: 9, fontWeight: '700', color: colors.gray[400], letterSpacing: 0.5, textTransform: 'uppercase' },
  kpiValue:       { fontSize: 26, fontWeight: '700', color: colors.gray[900] },
  kpiUnit:        { fontSize: 11, color: colors.gray[400] },
  chartTitle:     { fontSize: 10, fontWeight: '700', color: colors.gray[400], letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm },
});

const hmStyles = StyleSheet.create({
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title:        { fontSize: 14, fontWeight: '600', color: colors.gray[800] },
  legend:       { flexDirection: 'row', alignItems: 'center' },
  dot:          { width: 10, height: 10, borderRadius: 2 },
  legTxt:       { fontSize: 10, color: colors.gray[400], marginLeft: 3 },
  row:          { flexDirection: 'row' },
  dayHdr:       { flex: 1, textAlign: 'center', fontSize: 10, color: colors.gray[400], fontWeight: '600', paddingVertical: 4 },
  cell:         { flex: 1, margin: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center', minHeight: 38, backgroundColor: colors.gray[100] },
  selectedCell: { borderWidth: 2, borderColor: colors.gray[600] },
  cellDay:      { fontSize: 12, fontWeight: '600' },
  cellVal:      { fontSize: 8, marginTop: 1 },
  detail:       { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100], paddingTop: spacing.md },
  detailDate:   { fontSize: 12, fontWeight: '600', color: colors.gray[500], marginBottom: spacing.sm },
  detailRow:    { flexDirection: 'row', gap: spacing.xl },
  detailLabel:  { fontSize: 9, color: colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue:  { fontSize: 13, fontWeight: '700', color: colors.gray[900] },
});

const wStyles = StyleSheet.create({
  title:   { fontSize: 13, fontWeight: '600', color: colors.gray[800], marginBottom: spacing.sm },
  legend:  { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center', marginTop: spacing.sm },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:     { width: 10, height: 10, borderRadius: 2 },
  legTxt:  { fontSize: 11, color: colors.gray[400] },
});
