import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList, Medicine } from '../types';
import { useAllMedicinesSortedByExpiry, useExpiryLabel } from '../hooks';
import { getMedicineStatus } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState } from '../components';
import { differenceInDays, parseISO } from 'date-fns';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Expiry'>;

// ── Styles factory ─────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, marginBottom: Spacing.md },
    title:  {
      fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary, marginBottom: Spacing.md,
    },
    alertBanner: {
      backgroundColor: C.dangerLight, borderWidth: 1.5,
      borderColor: C.dangerBorder, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    alertText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.dangerDark },
    list:  { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    row:   {
      backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1 },
    name: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },
    date: { fontSize: Typography.size.xs, color: C.textSecondary, marginTop: 2 },
    bar:  {
      height: 5, borderRadius: Radius.pill, backgroundColor: C.bgCardAlt,
      marginTop: Spacing.sm, overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: Radius.pill },
    qtyPill: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
    qtyText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function ExpiryScreen() {
  const navigation = useNavigation<Nav>();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);
  const t          = useT();

  const medicines = useAllMedicinesSortedByExpiry();

  const expired  = medicines.filter(m => getMedicineStatus(m) === 'expired');
  const expiring = medicines.filter(m => getMedicineStatus(m) === 'expiring_soon');
  const ok       = medicines.filter(m => getMedicineStatus(m) === 'ok');
  const sorted   = [...expired, ...expiring, ...ok];

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>{t('expiry_title')}</Text>
        {expired.length > 0 && (
          <View style={s.alertBanner}>
            <Text style={s.alertText}>
              ❌ {expired.length} просрочен{expired.length > 1 ? 'ы' : ''} — замените сегодня
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState kitten="kit" title={t('all_ok')} subtitle={t('no_expired_sub')} />
        }
        renderItem={({ item }) => (
          <ExpiryRow
            medicine={item}
            styles={s}
            colors={C}
            onPress={() => navigation.navigate('MedicineDetail', { medicineId: item.id, kitId: item.kitId })}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ExpiryRow({
  medicine, styles: s, colors: C, onPress,
}: {
  medicine: Medicine;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorPalette;
  onPress: () => void;
}) {
  const expiry = useExpiryLabel(medicine.expirationDate);
  const status = getMedicineStatus(medicine);

  const daysLeft = Math.max(0, differenceInDays(parseISO(medicine.expirationDate), new Date()));
  const pct      = Math.min(100, Math.round((daysLeft / 365) * 100));

  const barColor =
    status === 'expired'       ? C.danger  :
    status === 'expiring_soon' ? C.warning : C.success;

  const iconBg =
    status === 'expired'       ? C.dangerLight  :
    status === 'expiring_soon' ? C.warningLight : C.successLight;

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 20 }}>
          {status === 'expired' ? '❌' : status === 'expiring_soon' ? '⚠️' : '✅'}
        </Text>
      </View>

      <View style={s.info}>
        <Text style={s.name}>{medicine.name}</Text>
        <Text style={[s.date, expiry.isExpired && { color: C.dangerDark }]}>{expiry.label}</Text>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>
      </View>

      <View style={[s.qtyPill, { backgroundColor: iconBg }]}>
        <Text style={[s.qtyText, { color: barColor }]}>{medicine.remainingQuantity} шт</Text>
      </View>
    </TouchableOpacity>
  );
}
