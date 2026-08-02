import React, { useRef, useState, useCallback } from 'react';
import {
  View, PanResponder, StyleSheet, Text, TextInput,
  TouchableOpacity, ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Radius, Typography } from '../theme';
import { useColors } from '../context/ThemeContext';

// ─── HSL ↔ HEX helpers ────────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else                h = ((r - g) / d + 4) / 6;
  return Math.round(h * 360);
}

function isValidHex(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

const HUE_STOPS = [
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00',
  '#00FF00', '#00FF80', '#00FFFF', '#0080FF',
  '#0000FF', '#8000FF', '#FF00FF', '#FF0080', '#FF0000',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface HueSliderProps {
  /** Current hex color (e.g. '#78A9FF') */
  value: string;
  /** Called with new hex when user picks */
  onChange: (hex: string) => void;
  label?: string;
  style?: ViewStyle;
  /** Saturation % (default 80) */
  saturation?: number;
  /** Lightness % (default 55) */
  lightness?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const HueSlider: React.FC<HueSliderProps> = ({
  value, onChange, label, style, saturation = 80, lightness = 55,
}) => {
  const C = useColors();

  const sliderWidth = useRef(280);
  const [hue, setHue] = useState<number>(() =>
    isValidHex(value) ? hexToHue(value) : 0,
  );
  const [hexInput, setHexInput] = useState(value ?? '#78A9FF');

  // Sync from parent value changes
  const prevValue = useRef(value);
  if (prevValue.current !== value && isValidHex(value)) {
    prevValue.current = value;
    const h = hexToHue(value);
    setHue(h);
    setHexInput(value);
  }

  const thumbPos = (hue / 360) * sliderWidth.current;

  const applyHue = useCallback((h: number) => {
    const clamped = Math.max(0, Math.min(360, h));
    const hex = hslToHex(clamped, saturation, lightness);
    setHue(clamped);
    setHexInput(hex);
    onChange(hex);
  }, [onChange, saturation, lightness]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const h = Math.round((x / sliderWidth.current) * 360);
        applyHue(h);
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const h = Math.round((x / sliderWidth.current) * 360);
        applyHue(h);
      },
    }),
  ).current;

  function handleHexChange(text: string) {
    setHexInput(text);
    if (isValidHex(text)) {
      const h = hexToHue(text);
      setHue(h);
      onChange(text);
    }
  }

  const previewColor = isValidHex(hexInput) ? hexInput : hslToHex(hue, saturation, lightness);

  return (
    <View style={[sl.wrap, style]}>
      {label ? (
        <Text style={[sl.label, { color: C.textSecondary }]}>{label}</Text>
      ) : null}

      <View style={sl.row}>
        {/* Color preview swatch */}
        <View style={[sl.swatch, { backgroundColor: previewColor, borderColor: C.border }]} />

        {/* Gradient rail */}
        <View style={sl.sliderWrap}>
          <LinearGradient
            colors={HUE_STOPS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={sl.gradient}
            onLayout={e => { sliderWidth.current = e.nativeEvent.layout.width; }}
            {...(panResponder.panHandlers as any)}
          >
            {/* Thumb */}
            <View style={[sl.thumb, {
              left: thumbPos - 14,
              backgroundColor: previewColor,
              borderColor: C.white,
            }]} />
          </LinearGradient>
        </View>
      </View>

      {/* Hex input */}
      <View style={[sl.hexRow, { borderColor: C.border, backgroundColor: C.bgCardAlt }]}>
        <Text style={[sl.hashSign, { color: C.textTertiary }]}>#</Text>
        <TextInput
          style={[sl.hexInput, { color: C.textPrimary }]}
          value={hexInput.replace('#', '')}
          onChangeText={t => handleHexChange('#' + t.toUpperCase().replace(/[^0-9A-F]/gi, '').slice(0, 6))}
          maxLength={6}
          autoCapitalize="characters"
          placeholderTextColor={C.textTertiary}
          placeholder="RRGGBB"
        />
        {/* Quick reset swatches */}
        {['#78A9FF', '#2ECC71', '#E53935', '#C97FE8', '#FF9800', '#00BFA5'].map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => { setHexInput(c); setHue(hexToHue(c)); onChange(c); }}
            style={[sl.quickSwatch, { backgroundColor: c }]}
          />
        ))}
      </View>
    </View>
  );
};

const SLIDER_HEIGHT = 28;
const THUMB_SIZE    = 28;

const sl = StyleSheet.create({
  wrap:      { gap: Spacing.sm },
  label:     { fontSize: Typography.size.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swatch:    { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  sliderWrap:{ flex: 1 },
  gradient:  {
    height: SLIDER_HEIGHT, borderRadius: SLIDER_HEIGHT / 2,
    justifyContent: 'center', overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE, height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    top: -(THUMB_SIZE - SLIDER_HEIGHT) / 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  hexRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, gap: Spacing.xs, height: 40,
  },
  hashSign:  { fontSize: Typography.size.md, fontWeight: '600' },
  hexInput:  { flex: 1, fontSize: Typography.size.md, fontWeight: '600', letterSpacing: 1 },
  quickSwatch: { width: 20, height: 20, borderRadius: 10 },
});
