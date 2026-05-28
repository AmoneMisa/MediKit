import { StyleSheet } from 'react-native';

// ─── Light palette (default) ──────────────────────────────────────────────────

export const Colors = {
  bgPage:       '#F7F8FD',
  bgCard:       '#FFFFFF',
  bgCardAlt:    '#F0F4FF',
  accent:       '#FF775C',
  accentLight:  '#FFE8E2',
  blue:         '#78A9FF',
  blueLight:    '#E6F0FF',
  blueDark:     '#1A4DA1',
  success:      '#56CE53',
  successLight: '#E6F9E5',
  successDark:  '#1A7A18',
  warning:      '#FFCF47',
  warningLight: '#FFF8DC',
  warningDark:  '#8B6914',
  danger:       '#FF7575',
  dangerLight:  '#FFE8E8',
  dangerDark:   '#C0392B',
  dangerBorder: '#FFBDBE',
  textPrimary:   '#364052',
  textSecondary: '#7A8BAD',
  textTertiary:  '#B0BDCC',
  border:        '#E0E8F5',
  borderLight:   '#F0F4FF',
  borderDashed:  '#B8CCEE',
  white:         '#FFFFFF',
} as const;

// ─── Dark palette ─────────────────────────────────────────────────────────────

export const DarkColors = {
  bgPage:       '#0D1117',
  bgCard:       '#161B22',
  bgCardAlt:    '#1C2333',
  accent:       '#FF775C',
  accentLight:  '#2D1A15',
  blue:         '#79B8FF',
  blueLight:    '#152035',
  blueDark:     '#9ECBFF',
  success:      '#56CE53',
  successLight: '#0F2A0F',
  successDark:  '#85E082',
  warning:      '#FFCF47',
  warningLight: '#2A200A',
  warningDark:  '#FFE07C',
  danger:       '#FF7B72',
  dangerLight:  '#2A1010',
  dangerDark:   '#FFAAAA',
  dangerBorder: '#7B2020',
  textPrimary:   '#C9D1D9',
  textSecondary: '#8B949E',
  textTertiary:  '#484F58',
  border:        '#21262D',
  borderLight:   '#161B22',
  borderDashed:  '#30363D',
  white:         '#FFFFFF',
} as const;

/** Use string values so both LightColors and DarkColors satisfy this type */
export type ColorPalette = { [K in keyof typeof Colors]: string };

export const Typography = {
  size: {
    xs: 10, sm: 11, body: 13, md: 14,
    base: 15, lg: 16, xl: 18, xxl: 20, hero: 22,
  },
  weight: {
    regular:   '400' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16,
  xl: 20, xxl: 24, xxxl: 32,
} as const;

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 18, xxl: 24, pill: 999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#7890C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  sm: {
    shadowColor: '#7890C8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

export const CommonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPage },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { height: 1, backgroundColor: Colors.borderLight },
});
