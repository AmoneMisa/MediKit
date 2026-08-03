import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 100 },

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
  const t = useT();

  if (!medicine) return null;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Hero */}
        <View style={s.hero}>
          <Icon name="flask" size={44} color={C.dangerDark} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>{t('is_compatibility')}</Text>
            <Text style={s.heroSub}>{medicine.name}</Text>
          </View>
        </View>

        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('is_cannot_together')}</Text>
            </View>

            {medicine.incompatibleWith.map((item, i) => (
              <View key={i} style={s.incompatCard}>
                <View style={s.incompatIcon}>
                  <Icon name="cancel" size={22} color={C.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.incompatName}>{item}</Text>
                  <Text style={s.incompatReason}>
                    {t('is_incompat_reason').replace('{name}', medicine.name)}
                  </Text>
                </View>
              </View>
            ))}

            <View style={s.warningBox}>
              <Icon name="alert" size={22} color={C.warningDark} />
              <View style={{ flex: 1 }}>
                <Text style={s.warningTitle}>{t('is_important')}</Text>
                <Text style={s.warningBody}>
                  {t('is_important_body')}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={s.emptyBox}>
            <Icon name="check-circle" size={40} color={C.success} style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>{t('is_no_contra')}</Text>
            <Text style={s.emptySub}>
              {t('is_no_contra_sub').replace('{name}', medicine.name)}
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={s.backBtnText}>{t('is_back_to').replace('{name}', medicine.name)}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
