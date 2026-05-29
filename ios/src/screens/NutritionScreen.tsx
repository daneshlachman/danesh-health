import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, today } from '../utils/api';
import { colors, card, spacing, radius } from '../utils/colors';
import RingChart from '../components/RingChart';
import DateNav from '../components/DateNav';

const GOALS = { calories: 2400, protein_g: 180, carbs_g: 240, fat_g: 80 };
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

type Entry = { id: string; meal_type: string; description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };

export default function NutritionScreen() {
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = (d: string) => {
    setLoading(true);
    api.get(`/api/nutrition?date=${d}`)
      .then(r => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch_(date); }, [date]);

  const totalCal = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const totalP   = entries.reduce((s, e) => s + (e.protein_g || 0), 0);
  const totalC   = entries.reduce((s, e) => s + (e.carbs_g || 0), 0);
  const totalF   = entries.reduce((s, e) => s + (e.fat_g || 0), 0);

  const deleteEntry = (id: string) => {
    Alert.alert('Delete', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        api.delete(`/api/nutrition/${id}`)
          .then(() => setEntries(prev => prev.filter(e => e.id !== id)))
          .catch(console.error);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <DateNav date={date} onChange={d => { setDate(d); }} />

        {/* Calorie + macro rings */}
        <View style={[card, styles.ringsCard]}>
          <View style={styles.bigRingRow}>
            <RingChart value={totalCal} max={GOALS.calories} color={colors.brand[500]} size={120} stroke={10} unit="kcal" />
            <View style={styles.bigRingMeta}>
              <Text style={styles.bigRingVal}>{totalCal}</Text>
              <Text style={styles.bigRingLabel}>of {GOALS.calories} kcal</Text>
            </View>
          </View>
          <View style={styles.macroRow}>
            <RingChart value={Math.round(totalP)} max={GOALS.protein_g} color={colors.macro.protein} size={72} stroke={6} label="Protein" unit="g" />
            <RingChart value={Math.round(totalC)} max={GOALS.carbs_g}   color={colors.macro.carbs}   size={72} stroke={6} label="Carbs"   unit="g" />
            <RingChart value={Math.round(totalF)} max={GOALS.fat_g}     color={colors.macro.fat}     size={72} stroke={6} label="Fat"     unit="g" />
          </View>
        </View>

        {/* Meal sections */}
        {loading ? <ActivityIndicator color={colors.brand[500]} style={{ marginTop: 32 }} /> : (
          MEALS.map(meal => {
            const mealEntries = entries.filter(e => e.meal_type === meal);
            const mealCal = mealEntries.reduce((s, e) => s + (e.calories || 0), 0);
            return (
              <View key={meal} style={card}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealTitle}>{MEAL_LABELS[meal].toUpperCase()}</Text>
                  {mealCal > 0 && <Text style={styles.mealCal}>{mealCal} kcal</Text>}
                </View>
                {mealEntries.length === 0 ? (
                  <Text style={styles.empty}>Nothing logged yet</Text>
                ) : (
                  mealEntries.map(e => (
                    <View key={e.id} style={styles.entryRow}>
                      <View style={styles.entryMain}>
                        <Text style={styles.entryDesc}>{e.description}</Text>
                        <View style={styles.macroTags}>
                          <Text style={styles.calTag}>{e.calories} kcal</Text>
                          <Text style={[styles.macroTag, { color: colors.macro.protein }]}>P {Math.round(e.protein_g)}g</Text>
                          <Text style={[styles.macroTag, { color: colors.macro.carbs }]}>C {Math.round(e.carbs_g)}g</Text>
                          <Text style={[styles.macroTag, { color: colors.macro.fat }]}>F {Math.round(e.fat_g)}g</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => deleteEntry(e.id)} style={styles.deleteBtn}>
                        <Text style={styles.deleteX}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  content:      { padding: spacing.lg, gap: spacing.md },
  ringsCard:    { alignItems: 'center', gap: spacing.lg },
  bigRingRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  bigRingMeta:  { alignItems: 'flex-start' },
  bigRingVal:   { fontSize: 36, fontWeight: '700', color: colors.gray[900] },
  bigRingLabel: { fontSize: 13, color: colors.gray[400] },
  macroRow:     { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  mealHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  mealTitle:    { fontSize: 11, fontWeight: '700', color: colors.gray[400], letterSpacing: 0.8 },
  mealCal:      { fontSize: 12, color: colors.gray[400] },
  empty:        { fontSize: 13, color: colors.gray[400], fontStyle: 'italic' },
  entryRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  entryMain:    { flex: 1 },
  entryDesc:    { fontSize: 14, fontWeight: '500', color: colors.gray[900], marginBottom: 2 },
  macroTags:    { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  calTag:       { fontSize: 11, color: colors.gray[600] },
  macroTag:     { fontSize: 11, fontWeight: '600' },
  deleteBtn:    { padding: spacing.sm },
  deleteX:      { fontSize: 20, color: colors.gray[300] },
});
