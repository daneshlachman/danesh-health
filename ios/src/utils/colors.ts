export const colors = {
  brand: {
    50:  '#f0f9ff',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
  },
  status: {
    green:  '#22c55e',
    red:    '#ef4444',
    yellow: '#eab308',
    orange: '#f97316',
  },
  macro: {
    protein: '#60a5fa',
    carbs:   '#fbbf24',
    fat:     '#fb7185',
  },
  bg:   '#f1f5f9',
  card: '#ffffff',
  gray: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    600: '#4b5563',
    800: '#1f2937',
    900: '#111827',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24,
} as const;

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 9999,
} as const;

export const card = {
  backgroundColor: colors.card,
  borderRadius: radius.xl,
  padding: spacing.lg,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
} as const;
