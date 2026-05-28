import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList, MedicinePrefill } from '../types';
import { searchMedicines } from '../assets/data/medicinesDb';
import { searchMedicinesApi } from '../utils/medicineApi';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';

type Nav = NativeStackNavigationProp<KitsStackParamList, 'SearchMedicine'>;

const FORM_LABEL: Record<string, string> = {
  tablets: 'Таблетки', capsules: 'Капсулы', syrup: 'Сироп', spray: 'Спрей',
  drops: 'Капли', ointment: 'Мазь', injection: 'Инъекция',
  powder: 'Порошок', patch: 'Пластырь', other: 'Другое',
};

export function SearchMedicineScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const kitId: string | undefined = route.params?.kitId;

  const [query,       setQuery]       = useState('');
  const [apiResults,  setApiResults]  = useState<MedicinePrefill[]>([]);
  const [apiLoading,  setApiLoading]  = useState(false);

  const localResults = useMemo(
    () => (query.trim().length > 1 ? searchMedicines(query) : []),
    [query],
  );

  // Debounced API call
  const runApiSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setApiResults([]); return; }
    setApiLoading(true);
    const results = await searchMedicinesApi(q);
    setApiLoading(false);
    setApiResults(results);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runApiSearch(query), 600);
    return () => clearTimeout(timer);
  }, [query, runApiSearch]);

  const allResults = useMemo((): MedicinePrefill[] => {
    // Merge: local first, then API results not already in local
    const localNames = new Set(localResults.map(m => m.name.toLowerCase()));
    const apiUnique = apiResults.filter(m => !localNames.has((m.name ?? '').toLowerCase()));
    return [...localResults, ...apiUnique];
  }, [localResults, apiResults]);

  function onSelect(item: MedicinePrefill) {
    navigation.replace('ManualEntry', { kitId, prefill: item });
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.input}
          placeholder="Название препарата или действующее вещество"
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
        {apiLoading ? (
          <ActivityIndicator size="small" color={Colors.blue} style={{ marginLeft: 4 }} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={() => { setQuery(''); setApiResults([]); }}>
            <Text style={{ fontSize: 16, color: Colors.textTertiary }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={allResults}
        keyExtractor={(item, i) => `${item.name}-${i}`}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length > 1 ? (
            apiLoading ? null : (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>🔍</Text>
                <Text style={s.emptyTitle}>Не найдено</Text>
                <Text style={s.emptySub}>Попробуйте другое написание или введите данные вручную</Text>
                <TouchableOpacity
                  style={s.manualBtn}
                  onPress={() => navigation.replace('ManualEntry', { kitId, prefill: { name: query } })}
                >
                  <Text style={s.manualBtnText}>✏️ Ввести вручную</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={s.hint}>
              <Text style={s.hintText}>Начните вводить название</Text>
              <Text style={s.hintSub}>Поиск по локальной базе и международным реестрам</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const isFromApi = index >= localResults.length;
          return (
            <TouchableOpacity style={s.item} activeOpacity={0.85} onPress={() => onSelect(item)}>
              <View style={s.itemLeft}>
                <View style={s.itemNameRow}>
                  <Text style={s.itemName}>{item.name}</Text>
                  {isFromApi && (
                    <View style={s.apiChip}>
                      <Text style={s.apiChipText}>API</Text>
                    </View>
                  )}
                </View>
                {item.activeIngredient ? (
                  <Text style={s.itemIngredient}>{item.activeIngredient}</Text>
                ) : null}
                <View style={s.itemMeta}>
                  {item.dosage ? <Text style={s.metaChip}>{item.dosage}</Text> : null}
                  {item.form ? (
                    <Text style={[s.metaChip, s.metaChipForm]}>
                      {FORM_LABEL[item.form] ?? item.form}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, margin: Spacing.lg,
    height: 48, gap: Spacing.sm, ...Shadow.sm,
  },
  searchIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: Typography.size.md, color: Colors.textPrimary },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  item: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', ...Shadow.card,
  },
  itemLeft: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  itemName: {
    fontSize: Typography.size.base, fontWeight: Typography.weight.bold,
    color: Colors.textPrimary, flexShrink: 1,
  },
  apiChip: {
    backgroundColor: Colors.accentLight, borderRadius: Radius.pill,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  apiChipText: { fontSize: 9, fontWeight: Typography.weight.extrabold, color: Colors.accent },
  itemIngredient: { fontSize: Typography.size.body, color: Colors.textSecondary, marginBottom: Spacing.xs },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  metaChip: {
    fontSize: Typography.size.xs, color: Colors.blue,
    backgroundColor: Colors.blueLight, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    fontWeight: Typography.weight.semibold,
  },
  metaChipForm: { color: Colors.accent, backgroundColor: Colors.accentLight },
  chevron: { fontSize: 20, color: Colors.textTertiary, marginLeft: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.size.xl, fontWeight: Typography.weight.bold,
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  emptySub: {
    fontSize: Typography.size.body, color: Colors.textSecondary,
    marginBottom: Spacing.xl, textAlign: 'center', paddingHorizontal: Spacing.lg,
  },
  manualBtn: {
    backgroundColor: Colors.blue, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...Shadow.card,
  },
  manualBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.white },
  hint: { alignItems: 'center', paddingTop: 60 },
  hintText: {
    fontSize: Typography.size.base, color: Colors.textSecondary,
    fontWeight: Typography.weight.semibold, marginBottom: Spacing.sm,
  },
  hintSub: { fontSize: Typography.size.body, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
