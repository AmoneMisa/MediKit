import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 40 },

    hero: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
      backgroundColor: C.dangerLight, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.lg,
    },
    heroTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.dangerDark },
    heroSub:   { fontSize: Typography.size.body, color: C.dangerDark, marginTop: 2 },

    sectionHeader: { marginBottom: Spacing.md },
    sectionTitle:  { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },

    incompatCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.md,
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
      ...Shadow.card, borderLeftWidth: 4, borderLeftColor: C.danger,
    },
    incompatIcon: {
      width: 40, height: 40, borderRadius: Radius.sm,
      backgroundColor: C.dangerLight, alignItems: 'center', justifyContent: 'center',
    },
    incompatName:   { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary, marginBottom: 4 },
    incompatReason: { fontSize: Typography.size.body, color: C.textSecondary, lineHeight: Typography.size.body * 1.5 },

    warningBox: {
      flexDirection: 'row', gap: Spacing.md,
      backgroundColor: C.warningLight, borderRadius: Radius.md,
      padding: Spacing.md, marginTop: Spacing.sm,
      borderWidth: 1.5, borderColor: C.warning,
    },
    warningEmoji: { fontSize: 22 },
    warningTitle: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.warningDark, marginBottom: 4 },
    warningBody:  { fontSize: Typography.size.body, color: C.warningDark, lineHeight: Typography.size.body * 1.5 },

    emptyBox: {
      alignItems: 'center', padding: Spacing.xxxl,
      backgroundColor: C.bgCard, borderRadius: Radius.xl, ...Shadow.card,
    },
    emptyTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.textPrimary, marginBottom: 8 },
    emptySub:   { fontSize: Typography.size.body, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    backBtn: {
      marginTop: Spacing.xl, alignItems: 'center',
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, ...Shadow.sm,
    },
    backBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.blue },
  });
}

export function InteractionScreen() {
  const route      = useRoute<any>();
  const navigation = useNavigation<any>();
  const { medicineId } = route.params;
  const medicine = useAppStore(s => s.getMedicine(medicineId));
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  if (!medicine) return null;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={{ fontSize: 44 }}>⚗️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Совместимость</Text>
            <Text style={s.heroSub}>{medicine.name}</Text>
          </View>
        </View>

        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>❌ Нельзя принимать вместе</Text>
            </View>

            {medicine.incompatibleWith.map((item, i) => (
              <View key={i} style={s.incompatCard}>
                <View style={s.incompatIcon}>
                  <Text style={{ fontSize: 22 }}>🚫</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.incompatName}>{item}</Text>
                  <Text style={s.incompatReason}>
                    Одновременный приём может снизить эффективность {medicine.name} или вызвать нежелательные реакции.
                  </Text>
                </View>
              </View>
            ))}

            <View style={s.warningBox}>
              <Text style={s.warningEmoji}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.warningTitle}>Важно</Text>
                <Text style={s.warningBody}>
                  Если вы принимаете несколько препаратов одновременно, обязательно проконсультируйтесь с врачом или фармацевтом. Эта информация носит справочный характер.
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
            <Text style={s.emptyTitle}>Нет известных противопоказаний</Text>
            <Text style={s.emptySub}>
              Для {medicine.name} не зафиксировано серьёзных несовместимостей с другими препаратами.
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={s.backBtnText}>← Назад к {medicine.name}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
