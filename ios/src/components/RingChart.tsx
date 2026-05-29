import Svg, { Circle } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

type Props = {
  value: number | null;
  max: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  unit?: string;
};

export default function RingChart({ value, max, color, size = 80, stroke = 8, label, unit }: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value != null ? Math.min(Math.max(value / max, 0), 1) : 0;
  const dash = pct * circ;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.gray[100]} strokeWidth={stroke} fill="none" />
          {pct > 0 && (
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.val, { color, fontSize: size < 70 ? 16 : 20 }]}>{value ?? '—'}</Text>
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </View>
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  val:    { fontWeight: '700' },
  unit:   { fontSize: 9, color: colors.gray[400] },
  label:  { fontSize: 11, color: colors.gray[400], marginTop: 4, textAlign: 'center' },
});
