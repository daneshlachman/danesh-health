import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/api';
import { colors, card, spacing, radius } from '../utils/colors';
import LineChart from '../components/LineChart';

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type DayData = { date: string; burned: number; consumed: number; balance: number };

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH[m - 1]}`;
}

function balanceColor(balance: number) {
  if (balance < -200) return '#dcfce7';
  if (balance > 200) return '#fee2e2';
  return '#fef9c3';
}

export default function CaloriesHistoryScreen({ navigation }: any) {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    api.get('/api/calories/history?days=30')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avgBurned   = data.length ? Math.round(data.reduce((s, d) => s + d.burned, 0) / data.length) : null;
  const avgConsumed = data.length ? Math.round(data.reduce((s, d) => s + d.consumed, 0) / data.length) : null;

  const burnedData   = data.map(d => ({ label: fmtDate(d.date), value: d.burned }));
  const consumedData = data.map(d => ({ label: fmtDate(d.date), value: d.consumed }));

  // Calendar heatmap — last 30 days
  const calendarDays = [...data].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Calories</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.brand[500]} style={{ marginTop: 40 }} /> : (
          <>
            {/* KPI cards */}
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

            {/* Burned chart */}
            {burnedData.length > 1 && (
              <View style={card}>
                <Text style={styles.chartTitle}>BURNED</Text>
                <LineChart data={burnedData} width={width - 64} height={160} color={colors.brand[500]} avgLine={avgBurned ?? undefined} />
              </View>
            )}

            {/* Consumed chart */}
            {consumedData.length > 1 && (
              <View style={card}>
                <Text style={styles.chartTitle}>CONSUMED</Text>
                <LineChart data={consumedData} width={width - 64} height={160} color={colors.status.green} avgLine={avgConsumed ?? undefined} />
              </View>
            )}

            {/* Calendar heatmap */}
            <View style={card}>
              <Text style={styles.chartTitle}>DAILY BALANCE (30 days)</Text>
              <View style={styles.heatmap}>
                {calendarDays.map(d => (
                  <View key={d.date} style={[styles.heatCell, { backgroundColor: balanceColor(d.balance) }]}>
                    <Text style={styles.heatDay}>{d.date.slice(8)}</Text>
                    <Text style={styles.heatVal}>{d.balance < 0 ? '' : '+'}{d.balance}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#dcfce7' }]} /><Text style={styles.legendTxt}>Deficit</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#fef9c3' }]} /><Text style={styles.legendTxt}>Maintenance</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#fee2e2' }]} /><Text style={styles.legendTxt}>Surplus</Text></View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  content:     { padding: spacing.lg, gap: spacing.md },
  header:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center' },
  backArrow:   { fontSize: 18, color: colors.gray[600] },
  title:       { fontSize: 28, fontWeight: '700', color: colors.gray[900] },
  kpiRow:      { flexDirection: 'row', gap: spacing.md },
  kpiCard:     { flex: 1, gap: 2 },
  kpiLabel:    { fontSize: 9, fontWeight: '700', color: colors.gray[400], letterSpacing: 0.5, textTransform: 'uppercase' },
  kpiValue:    { fontSize: 28, fontWeight: '700', color: colors.gray[900] },
  kpiUnit:     { fontSize: 11, color: colors.gray[400] },
  chartTitle:  { fontSize: 10, fontWeight: '700', color: colors.gray[400], letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm },
  heatmap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell:    { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  heatDay:     { fontSize: 11, fontWeight: '600', color: colors.gray[700] },
  heatVal:     { fontSize: 8, color: colors.gray[500] },
  legend:      { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, justifyContent: 'center' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendTxt:   { fontSize: 11, color: colors.gray[400] },
});
