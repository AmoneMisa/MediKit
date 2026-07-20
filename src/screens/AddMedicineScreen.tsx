import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList } from '../types';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<KitsStackParamList, 'AddMedicine'>;

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bgPage },
    scroll:   { padding: Spacing.lg },
    title:    { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: C.textPrimary, marginBottom: Spacing.xs },
    subtitle: { fontSize: Typography.size.body, color: C.textSecondary, marginBottom: Spacing.lg },
    option: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.md,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    optIcon:  { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    optTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.textPrimary },
    optSub:   { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },
    chevron:  { color: C.textTertiary },
  });
}

export function AddMedicineScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<any>();
  const kitId: string = route.params?.kitId ?? 'kit-1';
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const t = useT();

  const OPTIONS = useMemo(() => [
    {
      emoji:    '📷',
      bg:       '#C8E8FF',
      title:    t('scan_package'),
      subtitle: t('scan_package_sub'),
      onPress:  () => navigation.navigate('ScanMedicine', { kitId }),
    },
    {
      emoji:    '🔍',
      bg:       '#D8C8FF',
      title:    t('find_in_db'),
      subtitle: t('find_in_db_sub'),
      onPress:  () => navigation.navigate('SearchMedicine', { kitId }),
    },
    {
      emoji:    '✏️',
      bg:       '#C8FFD8',
      title:    t('enter_manually'),
      subtitle: t('enter_manually_sub'),
      onPress:  () => navigation.navigate('ManualEntry', { kitId }),
    },
  ], [t, kitId]);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{t('add_medicine')}</Text>
        <Text style={s.subtitle}>{t('choose_method_hint')}</Text>

        {OPTIONS.map(o => (
          <TouchableOpacity key={o.title} style={s.option} onPress={o.onPress} activeOpacity={0.85}>
            <View style={[s.optIcon, { backgroundColor: o.bg }]}>
              <Text style={{ fontSize: 24 }}>{o.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optTitle}>{o.title}</Text>
              <Text style={s.optSub}>{o.subtitle}</Text>
            </View>
            <Icon name="chevron-right" size={22} color={C.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
