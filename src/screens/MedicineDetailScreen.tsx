import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList, Medicine } from '../types';
import { useAppStore, getMedicineStatus } from '../store';
import { useExpiryLabel } from '../hooks';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { WarningBanner, StatusBadge, MedicineIcon } from '../components';

type Nav = NativeStackNavigationProp<KitsStackParamList, 'MedicineDetail'>;
type Route = RouteProp<KitsStackParamList, 'MedicineDetail'>;

const FORM_LABELS: Record<string, string> = {
  tablets: 'Таблетки', capsules: 'Капсулы', syrup: 'Сироп',
  spray: 'Спрей', drops: 'Капли', ointment: 'Мазь',
  injection: 'Инъекция', powder: 'Порошок', patch: 'Пластырь', other: 'Другое',
};

/** Check if two medicines are incompatible with each other (bidirectional) */
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

export function MedicineDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { medicineId, kitId } = route.params;

  const medicine  = useAppStore(s => s.getMedicine(medicineId));
  const kit       = useAppStore(s => s.getKit(kitId));
  const medicines = useAppStore(s => s.medicines);
  const decrement = useAppStore(s => s.decrementQuantity);
  const deleteMed = useAppStore(s => s.deleteMedicine);

  const expiryInfo = useExpiryLabel(medicine?.expirationDate ?? new Date().toISOString());

  /** All medicines in the same kit that are incompatible with this one */
  const conflicts = useMemo(() => {
    if (!medicine) return [];
    return medicines.filter(
      m => m.kitId === kitId && m.id !== medicineId && checkIncompatible(medicine, m),
    );
  }, [medicine, medicines, kitId, medicineId]);

  if (!medicine) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={{ padding: 20, color: Colors.textPrimary }}>Препарат не найден</Text>
      </SafeAreaView>
    );
  }

  const status = getMedicineStatus(medicine);
  const pct = medicine.totalQuantity > 0
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
          <MedicineIcon form={medicine.form} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{medicine.name}</Text>
            <Text style={s.heroForm}>
              {medicine.dosage ? `${medicine.dosage} · ` : ''}{FORM_LABELS[medicine.form] ?? medicine.form}
            </Text>
            {medicine.manufacturer ? (
              <Text style={s.heroManuf}>{medicine.manufacturer}</Text>
            ) : null}
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
              backgroundColor: pct > 40 ? Colors.success : pct > 15 ? Colors.warning : Colors.danger,
            }]} />
          </View>

          <View style={[s.infoRow, { marginTop: Spacing.md }]}>
            <Text style={s.infoLabel}>Срок годности</Text>
            <Text style={[s.infoVal, expiryInfo.isExpired
              ? { color: Colors.dangerDark }
              : expiryInfo.daysLeft <= 30 ? { color: Colors.warningDark } : {}]}>
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
            <Text style={s.conflictSub}>
              Не принимайте одновременно с:
            </Text>
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
                  {m.activeIngredient ? (
                    <Text style={s.conflictMedIngr}>{m.activeIngredient}</Text>
                  ) : null}
                </View>
                <Text style={s.conflictArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* ── Composition / Ingredient table ── */}
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

        {/* ── Description ── */}
        {medicine.description ? (
          <View style={s.card}>
            <Text style={s.secTitle}>Для чего</Text>
            <Text style={s.bodyText}>{medicine.description}</Text>
          </View>
        ) : null}

        {/* ── Usage notes ── */}
        {medicine.usageNotes ? (
          <View style={s.card}>
            <Text style={s.secTitle}>Когда применять</Text>
            <Text style={s.bodyText}>{medicine.usageNotes}</Text>
          </View>
        ) : null}

        {/* ── Warnings / contraindications ── */}
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

        {/* ── General incompatibility list ── */}
        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          <WarningBanner
            emoji="🚫"
            title="Несовместимые вещества:"
            body={medicine.incompatibleWith.join(', ')}
          />
        ) : null}

        {/* ── Storage ── */}
        {medicine.storageNotes ? (
          <View style={s.card}>
            <Text style={s.secTitle}>🌡 Хранение</Text>
            <Text style={s.bodyText}>{medicine.storageNotes}</Text>
          </View>
        ) : null}

        {/* ── Tags ── */}
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
          <ActionBtn emoji="✏️" label="Изменить" onPress={() => navigation.navigate('ManualEntry', { kitId, medicineId })} />
          <ActionBtn emoji="📦" label="Кол-во" onPress={handleDecrement} />
          <ActionBtn emoji="🔔" label="Напомни" onPress={() => {
            // Navigate cross-stack to CreateReminder in NotificationsTab
            (navigation as any).navigate('NotificationsTab', {
              screen: 'CreateReminder',
              params: { kitId, medicineId },
            });
          }} primary />
          <ActionBtn emoji="🗑️" label="Удалить" onPress={handleDelete} danger />
        </View>

        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          <TouchableOpacity
            style={s.interactionLink}
            onPress={() => navigation.navigate('MedicineInteraction', { medicineId })}
          >
            <Text style={s.interactionLinkText}>🔬 Подробнее о совместимости →</Text>
          </TouchableOpacity>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

function ActionBtn({ emoji, label, onPress, primary, danger }: {
  emoji: string; label: string; onPress: () => void; primary?: boolean; danger?: boolean;
}) {
  const bg = primary ? Colors.blue : danger ? Colors.dangerLight : Colors.bgCardAlt;
  const tc = primary ? Colors.white : danger ? Colors.dangerDark : Colors.blue;
  return (
    <TouchableOpacity style={[ab.btn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={[ab.label, { color: tc }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  btn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', gap: 4 },
  label: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    backgroundColor: Colors.blueLight, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  heroName:  { fontSize: Typography.size.hero, fontWeight: Typography.weight.extrabold, color: Colors.blueDark },
  heroForm:  { fontSize: Typography.size.body, color: Colors.blue, marginTop: 2 },
  heroManuf: { fontSize: Typography.size.xs, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  infoLabel: { fontSize: Typography.size.body, color: Colors.textSecondary, fontWeight: Typography.weight.semibold },
  infoVal:   { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },

  bar:     { height: 6, borderRadius: Radius.pill, backgroundColor: Colors.bgCardAlt, marginTop: Spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },

  secTitle: {
    fontSize: Typography.size.body, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  bodyText: { fontSize: Typography.size.md, color: Colors.textPrimary, lineHeight: Typography.size.md * 1.6 },

  /* Composition table */
  compHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, marginBottom: 4,
    borderBottomWidth: 1.5, borderBottomColor: Colors.border,
  },
  compHeaderCell: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1,
  },
  compRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6,
  },
  compRowAlt: { backgroundColor: Colors.bgCardAlt },
  compName:   { flex: 1, fontSize: Typography.size.body, color: Colors.textPrimary },
  compAmount: { fontSize: Typography.size.body, fontWeight: Typography.weight.semibold, color: Colors.blue, marginLeft: Spacing.sm },

  /* Contraindication chips */
  warnChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 },
  warnChip: {
    backgroundColor: '#FFF3CD', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FBBF24',
  },
  warnChipText: { fontSize: Typography.size.body, color: '#92400E', fontWeight: Typography.weight.semibold },

  /* Drug interaction conflicts */
  conflictCard: {
    backgroundColor: '#FFF5F5', borderRadius: Radius.xl, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1.5, borderColor: Colors.danger,
    ...Shadow.card,
  },
  conflictTitle: {
    fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold,
    color: Colors.dangerDark, marginBottom: 4,
  },
  conflictSub: { fontSize: Typography.size.body, color: Colors.textSecondary, marginBottom: Spacing.md },
  conflictRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: '#FFD6D6',
  },
  conflictMedName: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.dangerDark },
  conflictMedIngr: { fontSize: Typography.size.xs, color: Colors.textSecondary, marginTop: 2 },
  conflictArrow:   { fontSize: 22, color: Colors.danger, fontWeight: Typography.weight.bold },

  /* Tags */
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  tag: {
    backgroundColor: Colors.blueLight, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
  },
  tagText: { fontSize: Typography.size.xs, color: Colors.blue, fontWeight: Typography.weight.semibold },

  actionGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, marginBottom: Spacing.md },
  interactionLink: { alignItems: 'center', paddingVertical: Spacing.md },
  interactionLinkText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.blue },
});
