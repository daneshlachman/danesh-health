import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '../utils/colors';

type Point = { label: string; value: number };

type Props = {
  data: Point[];
  width: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  avgLine?: number;
};

export default function LineChart({ data, width, height = 160, color = colors.brand[500], showDots = false, avgLine }: Props) {
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const PAD = { top: 12, bottom: 28, left: 40, right: 8 };
  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;

  const vals = data.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const px = (i: number) => PAD.left + (i / (data.length - 1)) * W;
  const py = (v: number) => PAD.top + H - ((v - minV) / range) * H;

  // Build smooth path
  const points = data.map((d, i) => ({ x: px(i), y: py(d.value) }));
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }

  // Y axis ticks
  const step = range <= 2 ? 0.5 : range <= 5 ? 1 : range <= 10 ? 2 : 2.5;
  const yMin = Math.floor(minV / step) * step;
  const yMax = Math.ceil(maxV / step) * step;
  const yTicks: number[] = [];
  for (let t = yMin; t <= yMax + 0.001; t += step) yTicks.push(Math.round(t * 10) / 10);

  // X labels — show ~4 evenly
  const xIndices = data.length <= 4
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  return (
    <Svg width={width} height={height}>
      {/* Y ticks */}
      {yTicks.map(t => (
        <SvgText key={t} x={PAD.left - 6} y={py(t) + 4} fontSize={9} fill={colors.gray[400]} textAnchor="end">
          {Number.isInteger(t) ? `${t}` : `${t.toFixed(1)}`}
        </SvgText>
      ))}

      {/* Avg reference line */}
      {avgLine != null && (
        <Line x1={PAD.left} y1={py(avgLine)} x2={PAD.left + W} y2={py(avgLine)}
          stroke={colors.brand[500]} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.35} />
      )}

      {/* Main line */}
      <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {showDots && points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
      ))}

      {/* X labels */}
      {xIndices.map(i => (
        <SvgText key={i} x={px(i)} y={height - 4} fontSize={9} fill={colors.gray[400]} textAnchor="middle">
          {data[i].label}
        </SvgText>
      ))}
    </Svg>
  );
}
