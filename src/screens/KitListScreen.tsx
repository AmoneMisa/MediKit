import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useT } from '../i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList, MedicineKit } from '../types';
import { useAppStore, getKitStats } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { KitThumb, EmptyState, IconButton } from '../components';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Nav = NativeStackNavigationProp<KitsStackParamList, 'KitList'>;

// ── Styles factory ─────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: C.bgPage },
    list:  { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: Spacing.lg, marginBottom: Spacing.lg,
    },
    title:   { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    kitCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
      marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      ...Shadow.card,
    },
    kitInfo: { flex: 1 },
    topRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2, flexWrap: 'wrap' },
    kitName: {
      fontSize: Typography.size.lg, fontWeight: Typography.weight.bold,
      color: C.textPrimary, flexShrink: 1,
    },
    sharedTag: { fontSize: Typography.size.xs, color: C.textSecondary },
    pinIcon:   { fontSize: 11 },
    kitCount:  { fontSize: Typography.size.body, color: C.textSecondary, marginBottom: Spacing.sm },
    badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    badge:     { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
    badgeDanger: { backgroundColor: C.dangerLight },
    badgeWarn:   { backgroundColor: C.warningLight },
    badgeOk:     { backgroundColor: C.successLight },
    badgeText:   { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },
    menuBtn:   { paddingLeft: Spacing.sm },
    menuDots:  { fontSize: 16, color: C.textTertiary, letterSpacing: 1 },
    addBtn: {
      borderWidth: 2, borderStyle: 'dashed', borderColor: C.borderDashed,
      borderRadius: Radius.xl, padding: Spacing.lg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.xs,
    },
    addBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.blue },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function KitListScreen() {
  const navigation = useNavigation<Nav>();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);
  const t          = useT();

  const rawKits   = useAppStore(state => state.kits);
  const medicines = useAppStore(state => state.medicines);
  const updateKit = useAppStore(state => state.updateKit);
  const deleteKit = useAppStore(state => state.deleteKit);

  const kits = [...rawKits].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  function openKitMenu(kit: MedicineKit) {
    const priority = kit.priority ?? 0;
    Alert.alert(kit.name, undefined, [
      {
        text: t('edit'),
        onPress: () => navigation.navigate('CreateEditKit', { kitId: kit.id }),
      },
      {
        text: t('move_up'),
        onPress: () => updateKit(kit.id, { priority: priority + 1 }),
      },
      priority > 0 ? {
        text: t('move_down'),
        onPress: () => updateKit(kit.id, { priority: Math.max(0, priority - 1) }),
      } : null,
      {
        text: t('delete_kit'),
        style: 'destructive' as const,
        onPress: () => confirmDelete(kit),
      },
      { text: t('cancel'), style: 'cancel' as const },
    ].filter(Boolean) as any);
  }

  function confirmDelete(kit: MedicineKit) {
    Alert.alert(
      t('delete_kit'),
      `${t('delete_kit')} «${kit.name}»?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => deleteKit(kit.id) },
      ],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <FlatList
        data={kits}
        keyExtractor={k => k.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.title}>{t('my_kits')}</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <IconButton icon="view-list" onPress={() => navigation.navigate('AllMedicines')} />
              <IconButton icon="plus" onPress={() => navigation.navigate('CreateEditKit', {})} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            kitten="kit"
            title={t('no_kits')}
            subtitle={t('create_first_kit')}
            actionLabel={t('create_kit')}
            onAction={() => navigation.navigate('CreateEditKit', {})}
          />
        }
        renderItem={({ item }) => {
          const stats    = getKitStats(medicines, item.id);
          const isShared = item.members.length > 1;
          const isPinned = (item.priority ?? 0) > 0;
          return (
            <TouchableOpacity
              style={s.kitCard}
              onPress={() => navigation.navigate('KitDetail', { kitId: item.id })}
              activeOpacity={0.85}
            >
              <KitThumb icon={item.icon} colorTag={item.colorTag} photoUri={item.photoUri} />

              <View style={s.kitInfo}>
                <View style={s.topRow}>
                  {isPinned && <Text style={s.pinIcon}>📌</Text>}
                  <Text style={s.kitName} numberOfLines={1}>{item.name}</Text>
                  {isShared && <Text style={s.sharedTag}>👥 Общая</Text>}
                </View>
                <Text style={s.kitCount}>
                  {stats.total} {stats.total === 1 ? 'препарат' : 'препарата'}
                </Text>
                <View style={s.badges}>
                  {stats.expired > 0 && (
                    <View style={[s.badge, s.badgeDanger]}>
                      <Text style={[s.badgeText, { color: C.dangerDark }]}>
                        🔴 Просрочен: {stats.expired}
                      </Text>
                    </View>
                  )}
                  {stats.expiringSoon > 0 && (
                    <View style={[s.badge, s.badgeWarn]}>
                      <Text style={[s.badgeText, { color: C.warningDark }]}>
                        🟡 Скоро: {stats.expiringSoon}
                      </Text>
                    </View>
                  )}
                  {stats.expired === 0 && stats.expiringSoon === 0 && (
                    <View style={[s.badge, s.badgeOk]}>
                      <Text style={[s.badgeText, { color: C.successDark }]}>✅ Всё в порядке</Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={s.menuBtn}
                onPress={() => openKitMenu(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="dots-horizontal" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => navigation.navigate('CreateEditKit', {})}
            activeOpacity={0.8}
          >
            <Icon name="plus" size={18} color={C.blue} />
            <Text style={s.addBtnText}>{t('add_kit')}</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}
