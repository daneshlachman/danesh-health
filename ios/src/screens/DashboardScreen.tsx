import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, today } from '../utils/api';
import { colors, card, spacing, radius } from '../utils/colors';

type WhoopData = {
  recovery_score: number | null;
  sleep_score: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
};

type TdeeData = {
  burned_now: number;
  tdee: number;
  consumed: number;
  balance: number;
};

function Ring({ value, max, color, label, unit }: {
  value: number | null; max: number; color: string; label: string; unit: string;
}) {
  const pct = value != null ? Math.min(value / max, 1) : 0;
  const SIZE = 80, STROKE = 8, R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  return (
    <View style={styles.ringContainer}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.ringBg, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: STROKE, borderColor: colors.gray[100] }]} />
        <View style={styles.ringCenter}>
          <Text style={[styles.ringValue, { color }]}>{value ?? '—'}</Text>
          <Text style={styles.ringUnit}>{unit}</Text>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

function recoveryColor(score: number | null) {
  if (score == null) return colors.gray[400];
  if (score >= 67) return colors.status.green;
  if (score >= 34) return colors.status.yellow;
  return colors.status.red;
}

function sleepColor(score: number | null) {
  if (score == null) return colors.gray[400];
  if (score >= 85) return colors.status.green;
  if (score >= 70) return colors.brand[500];
  return colors.status.red;
}

export default function DashboardScreen() {
  const [date, setDate] = useState(today());
  const [whoop, setWhoop] = useState<WhoopData | null>(null);
  const [tdee, setTdee] = useState<TdeeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/whoop/today?date=${date}`).then(r => setWhoop(r.data)).catch(() => {}),
      api.get(`/api/tdee/today?date=${date}`).then(r => setTdee(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [date]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Today</Text>

        {/* Whoop rings */}
        <View style={[card, styles.section]}>
          {loading ? <ActivityIndicator color={colors.brand[500]} /> : (
            <View style={styles.ringsGrid}>
              <Ring value={whoop?.recovery_score ?? null} max={100} color={recoveryColor(whoop?.recovery_score ?? null)} label="Recovery" unit="%" />
              <Ring value={whoop?.sleep_score ?? null} max={100} color={sleepColor(whoop?.sleep_score ?? null)} label="Sleep" unit="%" />
              <Ring value={whoop?.hrv_ms ? Math.round(whoop.hrv_ms) : null} max={120} color={colors.brand[500]} label="HRV (ms)" unit="ms" />
              <Ring value={whoop?.resting_hr ?? null} max={100} color={colors.status.red} label="Resting HR" unit="bpm" />
            </View>
          )}
        </View>

        {/* Calories */}
        {tdee && (
          <View style={[card, styles.section]}>
            <CalorieRow label="BURNED" value={tdee.burned_now} goal={tdee.tdee} barColor={colors.brand[500]} />
            <View style={styles.divider} />
            <CalorieRow label="CONSUMED" value={tdee.consumed} goal={tdee.tdee} barColor={colors.status.green} />
            <View style={styles.divider} />
            <View style={styles.balanceRow}>
              <Text style={styles.metaLabel}>BALANCE</Text>
              <View style={styles.balanceRight}>
                <Text style={[styles.balanceValue, { color: tdee.balance < 0 ? colors.status.green : colors.status.red }]}>
                  {tdee.balance > 0 ? '+' : ''}{tdee.balance} kcal
                </Text>
                <View style={[styles.badge, { backgroundColor: tdee.balance < 0 ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={[styles.badgeText, { color: tdee.balance < 0 ? colors.status.green : colors.status.red }]}>
                    {tdee.balance < 0 ? 'Deficit' : 'Surplus'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CalorieRow({ label, value, goal, barColor }: { label: string; value: number; goal: number; barColor: string }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={styles.calorieRow}>
      <View style={styles.calorieHeader}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaLabel}>est. {goal.toLocaleString()} kcal</Text>
      </View>
      <Text style={styles.calorieValue}>{value.toLocaleString()} <Text style={styles.calorieUnit}>kcal</Text></Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressBar, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.gray[900], marginBottom: spacing.sm },
  section: { marginBottom: 0 },
  ringsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: spacing.md },
  ringContainer: { alignItems: 'center', width: '45%' },
  ringBg: { position: 'absolute' },
  ringCenter: { alignItems: 'center' },
  ringValue: { fontSize: 20, fontWeight: '700' },
  ringUnit: { fontSize: 10, color: colors.gray[400] },
  ringLabel: { fontSize: 12, color: colors.gray[400], marginTop: spacing.xs, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.gray[100], marginVertical: spacing.sm },
  calorieRow: { gap: spacing.xs },
  calorieHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 11, fontWeight: '600', color: colors.gray[400], letterSpacing: 0.5 },
  calorieValue: { fontSize: 28, fontWeight: '700', color: colors.gray[900] },
  calorieUnit: { fontSize: 16, fontWeight: '400', color: colors.gray[400] },
  progressBg: { height: 6, backgroundColor: colors.gray[100], borderRadius: radius.full, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.full },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  balanceValue: { fontSize: 18, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
