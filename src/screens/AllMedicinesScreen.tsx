import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, Image,
} from 'react-native';
import { useT } from '../i18n';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList } from '../types';
import { useAppStore, getMedicineStatus } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { MedicineIcon, StatusBadge, EmptyState, FilterPill } from '../components';
import type { Medicine } from '../types';

type Nav = NativeStackNavigationProp<KitsStackParamList, 'AllMedicines'>;

type SortKey = 'usage' | 'recent' | 'alpha' | 'expiry';
type StatusFilter = 'all' | 'expiring_soon' | 'expired' | 'low_stock';

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bgPage },

    header: {
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
    title:    { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    countBadge: {
      backgroundColor: C.blueLight, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3,
    },
    countText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.blue },

    searchBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
      borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
      marginBottom: Spacing.sm, ...Shadow.sm,
    },
    searchInput: { flex: 1, fontSize: Typography.size.md, color: C.textPrimary, textAlignVertical: 'center' },

    filterRow: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs, alignItems: 'center' },
    sortRow:   {
      flexDirection: 'row', paddingHorizontal: Spacing.lg,
      gap: Spacing.sm, marginBottom: Spacing.sm,
    },
    sortBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingVertical: 6,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard,
    },
    sortBtnActive:  { backgroundColor: C.blue, borderColor: C.blue },
    sortBtnText:    { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.textSecondary },
    sortBtnTextActive: { color: C.white },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 32 },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    photoThumb: { width: 44, height: 44, borderRadius: Radius.md },
    info:    { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    name:    { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary, flexShrink: 1 },
    sub:     { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },

    kitBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: C.bgCardAlt, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 2,
      alignSelf: 'flex-start', marginTop: 4,
    },
    kitBadgeText: { fontSize: Typography.size.xs, color: C.textTertiary, fontWeight: Typography.weight.semibold },

    usageBadge: {
      backgroundColor: C.successLight, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start',
    },
    usageBadgeText: { fontSize: Typography.size.xs, color: C.successDark, fontWeight: Typography.weight.bold },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function AllMedicinesScreen() {
  const navigation = useNavigation<Nav>();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);
  const t          = useT();

  const SORT_OPTIONS = useMemo(() => [
    { key: 'usage'  as SortKey, label: t('sort_popular'), icon: 'star-outline' },
    { key: 'recent' as SortKey, label: t('sort_recent'),  icon: 'clock-outline' },
    { key: 'alpha'  as SortKey, label: t('sort_alpha'),   icon: 'sort-alphabetical-ascending' },
    { key: 'expiry' as SortKey, label: t('sort_expiry_short'), icon: 'calendar-alert' },
  ], [t]);

  const STATUS_FILTERS = useMemo(() => [
    { key: 'all'           as StatusFilter, label: t('filter_all') },
    { key: 'expiring_soon' as StatusFilter, label: t('filter_expiring') },
    { key: 'expired'       as StatusFilter, label: t('filter_expired') },
    { key: 'low_stock'     as StatusFilter, label: t('filter_low_stock') },
  ], [t]);

  const medicines  = useAppStore(st => st.medicines);
  const kits       = useAppStore(st => st.kits);
  const intakeLogs = useAppStore(st => st.intakeLogs);

  const [query,        setQuery]        = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('usage');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // kit lookup map
  const kitMap = useMemo(() => new Map(kits.map(k => [k.id, k])), [kits]);

  // usage count: how many intake log entries reference each medicine id
  const usageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    intakeLogs.forEach(log => {
      log.entries.forEach(entry => {
        if (entry.medicineId) {
          counts[entry.medicineId] = (counts[entry.medicineId] ?? 0) + 1;
        }
      });
    });
    return counts;
  }, [intakeLogs]);

  const filtered = useMemo(() => {
    let list = [...medicines];

    // status filter
    if (statusFilter !== 'all') {
      list = list.filter(m => getMedicineStatus(m) === statusFilter);
    }

    // text search
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.activeIngredient ?? '').toLowerCase().includes(q) ||
        (m.manufacturer ?? '').toLowerCase().includes(q) ||
        (m.dosage ?? '').toLowerCase().includes(q),
      );
    }

    // sort
    switch (sortKey) {
      case 'usage':
        list.sort((a, b) => (usageCount[b.id] ?? 0) - (usageCount[a.id] ?? 0));
        break;
      case 'recent':
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case 'alpha':
        list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        break;
      case 'expiry':
        list.sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
        break;
    }

    return list;
  }, [medicines, query, sortKey, statusFilter, usageCount]);

  function renderItem({ item }: { item: Medicine }) {
    const kit    = kitMap.get(item.kitId);
    const status = getMedicineStatus(item);
    const uses   = usageCount[item.id] ?? 0;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate('MedicineDetail', { medicineId: item.id, kitId: item.kitId })}
        activeOpacity={0.85}
      >
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={s.photoThumb} resizeMode="cover" />
        ) : (
          <MedicineIcon form={item.form} size={44} />
        )}

        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          </View>
          <Text style={s.sub}>
            {item.dosage ? `${item.dosage} · ` : ''}
            {item.remainingQuantity} из {item.totalQuantity}
          </Text>
          {kit && (
            <View style={s.kitBadge}>
              <Text style={{ fontSize: 11 }}>{kit.icon}</Text>
              <Text style={s.kitBadgeText}>{kit.name}</Text>
            </View>
          )}
          {uses > 0 && (
            <View style={s.usageBadge}>
              <Text style={s.usageBadgeText}>✓ Принято {uses} {uses === 1 ? 'раз' : 'раз'}</Text>
            </View>
          )}
        </View>

        <StatusBadge status={status} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.title}>{t('all_medicines')}</Text>
          <View style={s.countBadge}>
            <Text style={s.countText}>{filtered.length}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Icon name="magnify" size={18} color={C.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder={t('search_medicines_ph')}
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
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {STATUS_FILTERS.map(f => (
          <FilterPill
            key={f.key}
            label={f.label}
            active={statusFilter === f.key}
            onPress={() => setStatusFilter(f.key)}
          />
        ))}
      </ScrollView>

      {/* Sort */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[s.sortBtn, sortKey === opt.key && s.sortBtnActive]}
            onPress={() => setSortKey(opt.key)}
            activeOpacity={0.8}
          >
            <Icon name={opt.icon} size={13} color={sortKey === opt.key ? C.white : C.textSecondary} />
            <Text style={[s.sortBtnText, sortKey === opt.key && s.sortBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            kitten="confused"
            title={query ? t('nothing_found') : t('no_medicines')}
            subtitle={query ? t('try_another_query') : t('add_medicines_hint')}
          />
        }
      />
    </SafeAreaView>
  );
}
