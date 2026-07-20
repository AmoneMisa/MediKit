import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Image, Modal, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList } from '../types';
import { useAppStore, getMedicineStatus } from '../store';
import { useKitMedicines, type MedicineFilter } from '../hooks';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { MedicineIcon, StatusBadge, EmptyState, FilterPill } from '../components';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useT } from '../i18n';

type Nav   = NativeStackNavigationProp<KitsStackParamList, 'KitDetail'>;
type Route = RouteProp<KitsStackParamList, 'KitDetail'>;

// ── Styles factory ─────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bgPage },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md,
      gap: Spacing.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    kitEmoji:   { fontSize: 32 },
    kitPhoto:   { width: 40, height: 40, borderRadius: 8 },
    kitName:    {
      fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary,
    },
    kitSub:     { fontSize: Typography.size.xs, color: C.textSecondary, marginTop: 2 },
    menuBtn:    { padding: Spacing.sm },
    menuDots:   { fontSize: Typography.size.lg, color: C.textSecondary, letterSpacing: 1 },

    filterRow:  { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, alignItems: 'center' },

    tagFilterRow: {
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
      alignItems: 'center', gap: Spacing.sm,
    },
    tagChip: {
      paddingHorizontal: Spacing.md, paddingVertical: 5,
      borderRadius: Radius.pill, borderWidth: 1.5,
      borderColor: C.border, backgroundColor: C.bgCard,
    },
    tagChipActive:     { backgroundColor: C.blue, borderColor: C.blue },
    tagChipText:       { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: C.textSecondary },
    tagChipTextActive: { color: C.white },

    tagHintRow: {
      marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
      backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    tagHintText: { fontSize: Typography.size.xs, color: C.textTertiary, textAlign: 'center' },

    searchBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
      borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md, height: 44, gap: Spacing.sm,
    },
    searchIcon:  { fontSize: 16, color: C.textTertiary },
    searchInput: { flex: 1, fontSize: Typography.size.md, color: C.textPrimary, textAlignVertical: 'center' },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    medCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: Spacing.md,
      marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      ...Shadow.card,
    },
    medInfo: { flex: 1 },
    medName: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    medSub:  { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },

    fab:     {
      position: 'absolute', bottom: 24, right: 20,
      width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center', ...Shadow.card,
    },
    fabText: { fontSize: 28, color: C.white, lineHeight: 32 },

    overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    menuSheet: {
      backgroundColor: C.bgCard,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg, paddingBottom: 36, paddingTop: Spacing.md,
    },
    menuHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: C.border, alignSelf: 'center', marginBottom: Spacing.md,
    },
    menuTitle: {
      fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary, marginBottom: Spacing.md, textAlign: 'center',
    },
    menuRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 14 },
    menuRowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
    menuRowText: {
      flex: 1, fontSize: Typography.size.base,
      fontWeight: Typography.weight.semibold, color: C.textPrimary,
    },
    menuDivider: { height: 1, backgroundColor: C.borderLight, marginVertical: Spacing.sm },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function KitDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { kitId }  = route.params;
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);
  const t          = useT();

  const FILTERS = useMemo(() => [
    { key: 'all'           as MedicineFilter, label: t('filter_all') },
    { key: 'expiring_soon' as MedicineFilter, label: t('filter_expiring') },
    { key: 'expired'       as MedicineFilter, label: t('filter_expired') },
    { key: 'low_stock'     as MedicineFilter, label: t('filter_low_stock') },
    { key: 'recent'        as MedicineFilter, label: t('filter_new') },
  ], [t]);

  const [filter,    setFilter]    = useState<MedicineFilter>('all');
  const [query,     setQuery]     = useState('');
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);

  const kit          = useAppStore(state => state.getKit(kitId));
  const deleteKit    = useAppStore(state => state.deleteKit);
  const allMedicines = useAppStore(state => state.medicines);
  const medicines    = useKitMedicines(kitId, filter, query, tagFilter);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    allMedicines
      .filter(m => m.kitId === kitId)
      .forEach(m => m.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [allMedicines, kitId]);

  if (!kit) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={{ padding: 20, color: C.textPrimary }}>{t('kit_not_found')}</Text>
      </SafeAreaView>
    );
  }

  function handleEdit() {
    setMenuOpen(false);
    navigation.navigate('CreateEditKit', { kitId });
  }

  function handleDelete() {
    setMenuOpen(false);
    Alert.alert(
      t('delete_kit'),
      `${t('delete_kit')} «${kit!.name}»?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: () => { deleteKit(kitId); navigation.popToTop(); },
        },
      ],
    );
  }

  const isPinned = (kit.priority ?? 0) > 0;

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          {kit.photoUri ? (
            <Image source={{ uri: kit.photoUri }} style={s.kitPhoto} resizeMode="cover" />
          ) : (
            <Text style={s.kitEmoji}>{kit.icon}</Text>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isPinned && <Text style={{ fontSize: 12 }}>📌</Text>}
              <Text style={s.kitName} numberOfLines={1}>{kit.name}</Text>
            </View>
            <Text style={s.kitSub}>
              {kit.members.length > 1 ? `👥 ${kit.members.length} ${t('members')}` : `🔒 ${t('personal_kit')}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.menuBtn} onPress={() => setMenuOpen(true)} activeOpacity={0.7}>
          <Icon name="dots-horizontal" size={24} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Status filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {FILTERS.map(f => (
          <FilterPill key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>

      {/* Tag hint */}
      {availableTags.length === 0 && medicines.length > 0 ? (
        <View style={s.tagHintRow}>
          <Text style={s.tagHintText}>🏷 {t('add_tags_hint')}</Text>
        </View>
      ) : null}

      {/* Tag filter row */}
      {availableTags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagFilterRow}>
          <TouchableOpacity
            style={[s.tagChip, !tagFilter && s.tagChipActive]}
            onPress={() => setTagFilter(undefined)}
            activeOpacity={0.75}
          >
            <Text style={[s.tagChipText, !tagFilter && s.tagChipTextActive]}>{t('all_tags')}</Text>
          </TouchableOpacity>
          {availableTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[s.tagChip, tagFilter === tag && s.tagChipActive]}
              onPress={() => setTagFilter(tagFilter === tag ? undefined : tag)}
              activeOpacity={0.75}
            >
              <Text style={[s.tagChipText, tagFilter === tag && s.tagChipTextActive]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* Search */}
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder={t('search_medicine_ph')}
          placeholderTextColor={C.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Icon name="close" size={18} color={C.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Medicine list */}
      <FlatList
        data={medicines}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            kitten="confused"
            title={query ? t('nothing_found') : t('no_medicines')}
            subtitle={query ? t('try_other_name') : t('add_first_medicine')}
            actionLabel={query ? undefined : t('add_medicine')}
            onAction={() => navigation.navigate('AddMedicine', { kitId })}
          />
        }
        renderItem={({ item }) => {
          const status = getMedicineStatus(item);
          return (
            <TouchableOpacity
              style={s.medCard}
              onPress={() => navigation.navigate('MedicineDetail', { medicineId: item.id, kitId })}
              activeOpacity={0.85}
            >
              <MedicineIcon form={item.form} />
              <View style={s.medInfo}>
                <Text style={s.medName}>{item.name}</Text>
                <Text style={s.medSub}>
                  {item.dosage ? `${item.dosage} · ` : ''}
                  {item.remainingQuantity} из {item.totalQuantity}
                </Text>
              </View>
              <StatusBadge status={status} />
            </TouchableOpacity>
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: kit.colorTag }]}
        onPress={() => navigation.navigate('AddMedicine', { kitId })}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Actions menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={s.menuSheet}>
            <View style={s.menuHandle} />
            <Text style={s.menuTitle}>{kit.name}</Text>

            <TouchableOpacity style={s.menuRow} onPress={handleEdit} activeOpacity={0.8}>
              <Icon name="pencil" size={20} color={C.textSecondary} style={s.menuRowIcon as any} />
              <Text style={s.menuRowText}>{t('edit_kit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.menuRow}
              onPress={() => { setMenuOpen(false); navigation.navigate('ShareKit', { kitId }); }}
              activeOpacity={0.8}
            >
              <Icon name="share-variant" size={20} color={C.textSecondary} style={s.menuRowIcon as any} />
              <Text style={s.menuRowText}>{t('share_kit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.menuRow}
              onPress={() => { setMenuOpen(false); navigation.navigate('SyncMembers', { kitId }); }}
              activeOpacity={0.8}
            >
              <Icon name="account-group" size={20} color={C.textSecondary} style={s.menuRowIcon as any} />
              <Text style={s.menuRowText}>{t('members')}</Text>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity style={s.menuRow} onPress={handleDelete} activeOpacity={0.8}>
              <Icon name="delete" size={20} color={C.danger} style={s.menuRowIcon as any} />
              <Text style={[s.menuRowText, { color: C.danger }]}>{t('delete_kit')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
