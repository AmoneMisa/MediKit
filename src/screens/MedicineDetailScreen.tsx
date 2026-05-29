import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList, Medicine } from '../types';
import { useAppStore, getMedicineStatus } from '../store';
import { useExpiryLabel } from '../hooks';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { WarningBanner, StatusBadge, MedicineIcon } from '../components';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Nav   = NativeStackNavigationProp<KitsStackParamList, 'MedicineDetail'>;
type Route = RouteProp<KitsStackParamList, 'MedicineDetail'>;

const FORM_LABELS: Record<string, string> = {
  tablets: 'Таблетки', capsules: 'Капсулы', syrup: 'Сироп',
  spray: 'Спрей', drops: 'Капли', ointment: 'Мазь',
  injection: 'Инъекция', powder: 'Порошок', patch: 'Пластырь', other: 'Другое',
};

function checkIncompatible(a: Medicine, b: Medicine): boolean {
  const bNames = [b.name, b.activeIngredient ?? ''].filter(Boolean).map(s => s.toLowerCase());
  const aNames = [a.name, a.activeIngredient ?? ''].filter(Boolean).map(s => s.toLowerCase());
  if (a.incompatibleWith && a.incompatibleWith.length > 0) {
    for (const rule of a.incompatibleWith) {
      const r = rule.toLowerCase();
      if (bNames.some(n => n.includes(r) || r.includes(n))) return true;
    }
  }
  if (b.incompatibleWith && b.incompatibleWith.length > 0) {
    for (const rule of b.incompatibleWith) {
      const r = rule.toLowerCase();
      if (aNames.some(n => n.includes(r) || r.includes(n))) return true;
    }
  }
  return false;
}

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 40 },

    hero: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
      backgroundColor: C.blueLight, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.md,
    },
    heroName:  { fontSize: Typography.size.hero, fontWeight: Typography.weight.extrabold, color: C.blueDark },
    heroForm:  { fontSize: Typography.size.body, color: C.blue, marginTop: 2 },
    heroManuf: { fontSize: Typography.size.xs, color: C.textSecondary, marginTop: 2, fontStyle: 'italic' },

    card: { backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card },

    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    infoLabel: { fontSize: Typography.size.body, color: C.textSecondary, fontWeight: Typography.weight.semibold },
    infoVal:   { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },

    bar:     { height: 6, borderRadius: Radius.pill, backgroundColor: C.bgCardAlt, marginTop: Spacing.sm, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: Radius.pill },

    secTitle: {
      fontSize: Typography.size.body, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
    },
    bodyText: { fontSize: Typography.size.md, color: C.textPrimary, lineHeight: Typography.size.md * 1.6 },

    compHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 4, marginBottom: 4,
      borderBottomWidth: 1.5, borderBottomColor: C.border,
    },
    compHeaderCell: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1,
    },
    compRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6,
    },
    compRowAlt: { backgroundColor: C.bgCardAlt },
    compName:   { flex: 1, fontSize: Typography.size.body, color: C.textPrimary },
    compAmount: { fontSize: Typography.size.body, fontWeight: Typography.weight.semibold, color: C.blue, marginLeft: Spacing.sm },

    warnChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 },
    warnChip:     { backgroundColor: '#FFF3CD', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: '#FBBF24' },
    warnChipText: { fontSize: Typography.size.body, color: '#92400E', fontWeight: Typography.weight.semibold },

    conflictCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
      marginBottom: Spacing.md, borderWidth: 1.5, borderColor: C.danger, ...Shadow.card,
    },
    conflictTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold, color: C.dangerDark, marginBottom: 4 },
    conflictSub:   { fontSize: Typography.size.body, color: C.textSecondary, marginBottom: Spacing.md },
    conflictRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: C.dangerLight,
    },
    conflictMedName: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.dangerDark },
    conflictMedIngr: { fontSize: Typography.size.xs, color: C.textSecondary, marginTop: 2 },
    conflictArrow:   { fontSize: 22, color: C.danger, fontWeight: Typography.weight.bold },

    tagRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    tag:     { backgroundColor: C.blueLight, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
    tagText: { fontSize: Typography.size.xs, color: C.blue, fontWeight: Typography.weight.semibold },

    heroPhoto: { width: 64, height: 64, borderRadius: Radius.md },

    actionGrid:          { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, marginBottom: Spacing.sm },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg,
      backgroundColor: C.blueLight, marginBottom: Spacing.md,
    },
    shareBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.blue },
    interactionLink:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
    interactionLinkText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.blue },
  });
}

export function MedicineDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { medicineId, kitId } = route.params;
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const medicine  = useAppStore(st => st.getMedicine(medicineId));
  const kit       = useAppStore(st => st.getKit(kitId));
  const medicines = useAppStore(st => st.medicines);
  const decrement = useAppStore(st => st.decrementQuantity);
  const deleteMed = useAppStore(st => st.deleteMedicine);

  const expiryInfo = useExpiryLabel(medicine?.expirationDate ?? new Date().toISOString());

  const conflicts = useMemo(() => {
    if (!medicine) return [];
    return medicines.filter(
      m => m.kitId === kitId && m.id !== medicineId && checkIncompatible(medicine, m),
    );
  }, [medicine, medicines, kitId, medicineId]);

  if (!medicine) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={{ padding: 20, color: C.textPrimary }}>Препарат не найден</Text>
      </SafeAreaView>
    );
  }

  const status = getMedicineStatus(medicine);
  const pct    = medicine.totalQuantity > 0
    ? Math.round((medicine.remainingQuantity / medicine.totalQuantity) * 100)
    : 0;

  function handleDecrement() {
    Alert.alert('Отметить использование', 'Уменьшить запас на 1?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Да', onPress: () => decrement(medicineId) },
    ]);
  }

  function handleDelete() {
    Alert.alert('Удалить препарат', `Удалить «${medicine!.name}»?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => { deleteMed(medicineId); navigation.goBack(); } },
    ]);
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          {medicine.photoUri
            ? <Image source={{ uri: medicine.photoUri }} style={s.heroPhoto} resizeMode="cover" />
            : <MedicineIcon form={medicine.form} size={64} />}
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{medicine.name}</Text>
            <Text style={s.heroForm}>
              {medicine.dosage ? `${medicine.dosage} · ` : ''}{FORM_LABELS[medicine.form] ?? medicine.form}
            </Text>
            {medicine.manufacturer ? <Text style={s.heroManuf}>{medicine.manufacturer}</Text> : null}
            <StatusBadge status={status} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
          </View>
        </View>

        {/* ── Quick info card ── */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Осталось</Text>
            <Text style={s.infoVal}>{medicine.remainingQuantity} из {medicine.totalQuantity}</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, {
              width: `${pct}%` as any,
              backgroundColor: pct > 40 ? C.success : pct > 15 ? C.warning : C.danger,
            }]} />
          </View>

          <View style={[s.infoRow, { marginTop: Spacing.md }]}>
            <Text style={s.infoLabel}>Срок годности</Text>
            <Text style={[s.infoVal, expiryInfo.isExpired
              ? { color: C.dangerDark }
              : expiryInfo.daysLeft <= 30 ? { color: C.warningDark } : {}]}>
              {expiryInfo.label}
            </Text>
          </View>

          {medicine.activeIngredient ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Действующее вещество</Text>
              <Text style={[s.infoVal, { flexShrink: 1, textAlign: 'right' }]}>{medicine.activeIngredient}</Text>
            </View>
          ) : null}

          {medicine.manufacturer ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Производитель</Text>
              <Text style={[s.infoVal, { flexShrink: 1, textAlign: 'right' }]}>{medicine.manufacturer}</Text>
            </View>
          ) : null}

          {kit ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Аптечка</Text>
              <Text style={s.infoVal}>{kit.icon} {kit.name}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Drug interactions in kit ── */}
        {conflicts.length > 0 ? (
          <View style={s.conflictCard}>
            <Text style={s.conflictTitle}>⚠️ Несовместимо с препаратами в аптечке</Text>
            <Text style={s.conflictSub}>Не принимайте одновременно с:</Text>
            {conflicts.map(m => (
              <TouchableOpacity
                key={m.id}
                style={s.conflictRow}
                onPress={() => navigation.navigate('MedicineDetail', { medicineId: m.id, kitId })}
                activeOpacity={0.75}
              >
                <MedicineIcon form={m.form} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={s.conflictMedName}>{m.name}</Text>
                  {m.activeIngredient ? <Text style={s.conflictMedIngr}>{m.activeIngredient}</Text> : null}
                </View>
                <Icon name="chevron-right" size={22} color={C.danger} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* ── Composition ── */}
        {medicine.composition && medicine.composition.length > 0 ? (
          <View style={s.card}>
            <Text style={s.secTitle}>Состав</Text>
            <View style={s.compHeader}>
              <Text style={s.compHeaderCell}>Компонент</Text>
              <Text style={[s.compHeaderCell, { textAlign: 'right' }]}>Количество</Text>
            </View>
            {medicine.composition.map((item, i) => (
              <View key={i} style={[s.compRow, i % 2 === 0 && s.compRowAlt]}>
                <Text style={s.compName}>{item.name}</Text>
                <Text style={s.compAmount}>{item.amount ?? '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {medicine.description ? (
          <View style={s.card}>
            <Text style={s.secTitle}>Для чего</Text>
            <Text style={s.bodyText}>{medicine.description}</Text>
          </View>
        ) : null}

        {medicine.usageNotes ? (
          <View style={s.card}>
            <Text style={s.secTitle}>Когда применять</Text>
            <Text style={s.bodyText}>{medicine.usageNotes}</Text>
          </View>
        ) : null}

        {medicine.warnings && medicine.warnings.length > 0 ? (
          <View style={s.card}>
            <Text style={s.secTitle}>⚠️ Противопоказания</Text>
            <View style={s.warnChips}>
              {medicine.warnings.map((w, i) => (
                <View key={i} style={s.warnChip}>
                  <Text style={s.warnChipText}>{w}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          <WarningBanner emoji="🚫" title="Несовместимые вещества:" body={medicine.incompatibleWith.join(', ')} />
        ) : null}

        {medicine.storageNotes ? (
          <View style={s.card}>
            <Text style={s.secTitle}>🌡 Хранение</Text>
            <Text style={s.bodyText}>{medicine.storageNotes}</Text>
          </View>
        ) : null}

        {medicine.tags && medicine.tags.length > 0 ? (
          <View style={s.tagRow}>
            {medicine.tags.map(tag => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Actions ── */}
        <View style={s.actionGrid}>
          <ActionBtn label="Изменить" icon="pencil"           onPress={() => navigation.navigate('ManualEntry', { kitId, medicineId })} />
          <ActionBtn label="Кол-во"  icon="package-variant"  onPress={handleDecrement} />
          <ActionBtn label="Напомни" icon="bell"             primary onPress={() => {
            (navigation as any).navigate('NotificationsTab', {
              screen: 'CreateReminder', params: { kitId, medicineId },
            });
          }} />
          <ActionBtn label="Удалить" icon="delete"           danger onPress={handleDelete} />
        </View>
        <TouchableOpacity
          style={s.shareBtn}
          onPress={() => navigation.navigate('ShareMedicine', { medicineId, kitId })}
          activeOpacity={0.85}
        >
          <Icon name="share-variant" size={18} color={C.blue} />
          <Text style={s.shareBtnText}>Поделиться препаратом</Text>
        </TouchableOpacity>

        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          <TouchableOpacity
            style={s.interactionLink}
            onPress={() => navigation.navigate('MedicineInteraction', { medicineId })}
          >
            <Icon name="flask-outline" size={16} color={C.blue} />
            <Text style={s.interactionLinkText}>Подробнее о совместимости</Text>
            <Icon name="arrow-right" size={16} color={C.blue} />
          </TouchableOpacity>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, onPress, primary, danger }: {
  icon: string; label: string; onPress: () => void; primary?: boolean; danger?: boolean;
}) {
  const C  = useColors();
  const bg = primary ? C.blue : danger ? C.dangerLight : C.bgCardAlt;
  const tc = primary ? C.white : danger ? C.dangerDark  : C.blue;
  return (
    <TouchableOpacity
      style={{ flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: bg }}
      onPress={onPress} activeOpacity={0.8}
    >
      <Icon name={icon} size={22} color={tc} />
      <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: tc }}>{label}</Text>
    </TouchableOpacity>
  );
}
