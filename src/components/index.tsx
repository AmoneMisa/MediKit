import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle, Image,
} from 'react-native';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import type { MedicineStatus, MedicineForm } from '../types';
import { useColors } from '../context/ThemeContext';
import {
  KittenSleeping, KittenWaving, KittenWithPill, KittenDoctor,
} from '../assets/kittens/KittenSVG';

export { KittenSleeping, KittenWaving, KittenWithPill, KittenDoctor };

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export const StatusBadge: React.FC<{ status: MedicineStatus; style?: ViewStyle }> = ({ status, style }) => {
  const C = useColors();
  const cfg = {
    ok:            { label: 'В норме',   bg: C.successLight, text: C.successDark },
    expiring_soon: { label: 'Скоро!',    bg: C.warningLight, text: C.warningDark },
    expired:       { label: 'Просрочен', bg: C.dangerLight,  text: C.dangerDark  },
    low_stock:     { label: 'Мало',      bg: C.accentLight,  text: C.accent      },
  }[status] ?? { label: status, bg: C.bgCard, text: C.textSecondary };

  return (
    <View style={[ss.badge, { backgroundColor: cfg.bg }, style]}>
      <Text style={[ss.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── MedicineIcon ─────────────────────────────────────────────────────────────

const FORM_EMOJI: Record<MedicineForm, string> = {
  tablets: '💊', capsules: '💊', syrup: '🍯', spray: '💨',
  drops: '💧', ointment: '🧴', injection: '💉', powder: '🧂',
  patch: '🩹', other: '🩺',
};

const FORM_BG: Record<MedicineForm, string> = {
  tablets:  '#EAF1FF', capsules: '#EAF1FF', syrup:    '#FFF0D0', spray:    '#E4FFEE',
  drops:    '#E0F4FF', ointment: '#F5F0FF', injection: '#FFE8F0',
  powder:   '#F8F0E0', patch:    '#F0F8E0', other:    '#F0F0F0',
};

export const MedicineIcon: React.FC<{ form: MedicineForm; size?: number }> = ({ form, size = 44 }) => (
  <View style={[ss.medIcon, {
    width: size, height: size,
    borderRadius: Math.round(size * 0.27),
    backgroundColor: FORM_BG[form] ?? '#EAF1FF',
  }]}>
    <Text style={{ fontSize: Math.round(size * 0.45) }}>{FORM_EMOJI[form] ?? '💊'}</Text>
  </View>
);

// ─── KitThumb ─────────────────────────────────────────────────────────────────

export const KitThumb: React.FC<{
  icon: string; colorTag: string; photoUri?: string; size?: number;
}> = ({ icon, colorTag, photoUri, size = 56 }) => {
  const r = Math.round(size * 0.25);
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={[ss.kitThumb, { width: size, height: size, borderRadius: r, borderColor: colorTag + '66' }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[ss.kitThumb, {
      width: size, height: size, borderRadius: r,
      backgroundColor: colorTag + '33', borderColor: colorTag + '66',
    }]}>
      <Text style={{ fontSize: Math.round(size * 0.45) }}>{icon}</Text>
    </View>
  );
};

// ─── IconButton ───────────────────────────────────────────────────────────────

export const IconButton: React.FC<{
  emoji: string; onPress?: () => void; style?: ViewStyle; size?: number;
}> = ({ emoji, onPress, style, size = 36 }) => {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[ss.iconButton, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: C.bgCard, borderColor: C.border,
      }, style]}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: Math.round(size * 0.47) }}>{emoji}</Text>
    </TouchableOpacity>
  );
};

// ─── EmptyState ───────────────────────────────────────────────────────────────

type KittenVariant = 'sleeping' | 'waving' | 'pill' | 'doctor';

function KittenFor({ variant, size }: { variant: KittenVariant; size: number }) {
  switch (variant) {
    case 'sleeping': return <KittenSleeping size={size} />;
    case 'waving':   return <KittenWaving   size={size} />;
    case 'pill':     return <KittenWithPill size={size} />;
    case 'doctor':   return <KittenDoctor   size={size} />;
  }
}

export const EmptyState: React.FC<{
  emoji?: string;
  kitten?: KittenVariant;
  kittenSize?: number;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}> = ({ emoji, kitten, kittenSize = 130, title, subtitle, actionLabel, onAction, style }) => {
  const C = useColors();
  return (
    <View style={[ss.emptyState, style]}>
      {kitten
        ? <KittenFor variant={kitten} size={kittenSize} />
        : <Text style={ss.emptyEmoji}>{emoji ?? '🔍'}</Text>
      }
      <Text style={[ss.emptyTitle, { color: C.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[ss.emptySubtitle, { color: C.textSecondary }]}>{subtitle}</Text> : null}
      {actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          style={[ss.emptyAction, { backgroundColor: C.blue }]}
          activeOpacity={0.8}
        >
          <Text style={ss.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; onPress?: () => void }> = ({
  children, style, onPress,
}) => {
  const C = useColors();
  const cardStyle = [ss.card, { backgroundColor: C.bgCard }, style];
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

// ─── WarningBanner ────────────────────────────────────────────────────────────

export const WarningBanner: React.FC<{
  emoji?: string; title: string; body?: string; style?: ViewStyle;
}> = ({ emoji = '⚠️', title, body, style }) => {
  const C = useColors();
  return (
    <View style={[ss.warningBanner, {
      backgroundColor: C.dangerLight, borderColor: C.dangerBorder,
    }, style]}>
      <Text style={ss.warnEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[ss.warnTitle, { color: C.dangerDark }]}>{title}</Text>
        {body ? <Text style={[ss.warnBody, { color: C.dangerDark }]}>{body}</Text> : null}
      </View>
    </View>
  );
};

// ─── FilterPill ───────────────────────────────────────────────────────────────

export const FilterPill: React.FC<{ label: string; active?: boolean; onPress: () => void }> = ({
  label, active, onPress,
}) => {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[ss.filterPill, {
        backgroundColor: active ? C.blue : C.bgCard,
        borderColor:     active ? C.blue : C.border,
      }]}
    >
      <Text style={[ss.filterPillText, { color: active ? C.white : C.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Divider ─────────────────────────────────────────────────────────────────

export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const C = useColors();
  return <View style={[{ height: 1, backgroundColor: C.borderLight }, style]} />;
};

// ─── Static layout styles (no color deps) ────────────────────────────────────

const ss = StyleSheet.create({
  badge:      { paddingHorizontal: Spacing.sm + 2, paddingVertical: 3, borderRadius: Radius.pill },
  badgeText:  { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },
  medIcon:    { alignItems: 'center', justifyContent: 'center' },
  kitThumb:   { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  iconButton: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },

  emptyState:    { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyEmoji:    { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle:    {
    fontSize: Typography.size.lg, fontWeight: Typography.weight.bold,
    textAlign: 'center', marginBottom: Spacing.sm, marginTop: Spacing.md,
  },
  emptySubtitle: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.lg },
  emptyAction:   { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.xl },
  emptyActionText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: '#FFFFFF' },

  card: { borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderWidth: 1.5, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm,
  },
  warnEmoji: { fontSize: 22 },
  warnTitle: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold },
  warnBody:  { fontSize: Typography.size.body, marginTop: 2, lineHeight: Typography.size.body * 1.5 },

  filterPill: {
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill,
    borderWidth: 1.5, marginRight: Spacing.sm,
  },
  filterPillText: { fontSize: Typography.size.xs + 1, fontWeight: Typography.weight.bold },
});
