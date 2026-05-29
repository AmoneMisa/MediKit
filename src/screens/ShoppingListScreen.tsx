import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';
import { searchMedicines } from '../assets/data/medicinesDb';
import { searchMedicinesApi } from '../utils/medicineApi';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState } from '../components';
import type { ShoppingItem, MedicineForm, MedicinePrefill } from '../types';

// ── Styles ─────────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bgPage },
    header:  {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    },
    title:   { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    list:    { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    checkBox: {
      width: 26, height: 26, borderRadius: 13,
      borderWidth: 2, borderColor: C.blue,
      alignItems: 'center', justifyContent: 'center',
    },
    checkBoxChecked: { backgroundColor: C.blue, borderColor: C.blue },
    itemInfo: { flex: 1 },
    itemName: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    itemSub:  { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },
    itemQty:  {
      backgroundColor: C.blueLight, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 2,
    },
    itemQtyText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.blueDark },

    fab: {
      position: 'absolute', right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', ...Shadow.card,
    },

    // Bottom sheet
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.xl,
    },
    sheetTitle: {
      fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary, marginBottom: Spacing.lg,
    },
    sheetOption: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    sheetOptionIcon: {
      width: 44, height: 44, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
    },
    sheetOptionText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    sheetOptionSub:  { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 1 },

    // Form sheet
    formLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textSecondary, textTransform: 'uppercase',
      letterSpacing: 0.4, marginBottom: 5, marginTop: Spacing.md,
    },
    formInput: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, borderWidth: 1.5,
      borderColor: C.border, paddingHorizontal: Spacing.md, height: 44,
      fontSize: Typography.size.md, color: C.textPrimary,
      textAlignVertical: 'center',
    },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    qtyBtn: {
      width: 44, height: 44, borderRadius: Radius.sm,
      backgroundColor: C.bgCardAlt, borderWidth: 1.5, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    qtyValue: {
      flex: 1, height: 44, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    qtyValueText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.textPrimary },
    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl, padding: Spacing.md,
      alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card,
    },
    saveBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },
    cancelBtn:   { alignItems: 'center', padding: Spacing.md, marginTop: Spacing.xs },
    cancelText:  { fontSize: Typography.size.base, color: C.textSecondary },

    // Search in sheet
    searchRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardAlt,
      borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm, marginBottom: Spacing.sm,
    },
    searchInput: { flex: 1, fontSize: Typography.size.md, color: C.textPrimary, textAlignVertical: 'center' },
    searchResult: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.borderLight, gap: Spacing.sm,
    },
    searchResultName: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    searchResultSub:  { fontSize: Typography.size.body, color: C.textSecondary },

    // Buy confirm sheet
    buySheet: {
      backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.xl,
    },
    buyTitle: {
      fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary, marginBottom: Spacing.xs,
    },
    buySub: { fontSize: Typography.size.body, color: C.textSecondary, marginBottom: Spacing.lg },
    kitChip: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
      borderRadius: Radius.xl, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.bgCard, marginRight: Spacing.sm, marginBottom: Spacing.sm,
    },
    kitChipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
    kitChipText:   { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textSecondary },
    kitChipTextActive: { color: C.blueDark },
    confirmBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl, padding: Spacing.md,
      alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card,
    },
    confirmBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },
    sectionLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md,
    },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type AddMode = 'none' | 'menu' | 'manual' | 'search' | 'fromKit' | 'buyConfirm';

export function ShoppingListScreen() {
  const C      = useColors();
  const s      = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const items         = useAppStore(st => st.shoppingItems);
  const addItem       = useAppStore(st => st.addShoppingItem);
  const deleteItem    = useAppStore(st => st.deleteShoppingItem);
  const kits          = useAppStore(st => st.kits);
  const medicines     = useAppStore(st => st.medicines);
  const addMedicine   = useAppStore(st => st.addMedicine);

  const [mode, setMode]           = useState<AddMode>('none');
  const [buyItem, setBuyItem]     = useState<ShoppingItem | null>(null);

  // Manual form state
  const [manualName,   setManualName]   = useState('');
  const [manualDosage, setManualDosage] = useState('');
  const [manualQty,    setManualQty]    = useState(1);
  const [manualNotes,  setManualNotes]  = useState('');

  // Search state
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<MedicinePrefill[]>([]);

  // Buy confirm state
  const [buyKitId,  setBuyKitId]  = useState('');
  const [buyQty,    setBuyQty]    = useState(1);

  // Kit-medicine picker state
  const [selectedKitForPick, setSelectedKitForPick] = useState<string>('');

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const local = searchMedicines(q);
    const api   = await searchMedicinesApi(q);
    const localNames = new Set(local.map(m => m.name?.toLowerCase() ?? ''));
    const unique = api.filter(m => !localNames.has((m.name ?? '').toLowerCase()));
    setSearchResults([...local, ...unique].slice(0, 20));
  }, []);

  function openManual() {
    setManualName(''); setManualDosage(''); setManualQty(1); setManualNotes('');
    setMode('manual');
  }

  function saveManual() {
    if (!manualName.trim()) { Alert.alert('Введите название'); return; }
    addItem({
      id:        `shop-${Date.now()}`,
      name:      manualName.trim(),
      dosage:    manualDosage.trim() || undefined,
      quantity:  manualQty,
      notes:     manualNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    setMode('none');
  }

  function addFromSearch(prefill: MedicinePrefill) {
    addItem({
      id:        `shop-${Date.now()}`,
      name:      prefill.name ?? 'Препарат',
      dosage:    prefill.dosage,
      quantity:  1,
      prefill,
      createdAt: new Date().toISOString(),
    });
    setSearchQuery(''); setSearchResults([]); setMode('none');
  }

  function addFromKitMedicine(med: { name: string; dosage?: string; form?: MedicineForm }) {
    addItem({
      id:        `shop-${Date.now()}`,
      name:      med.name,
      dosage:    med.dosage,
      form:      med.form,
      quantity:  1,
      createdAt: new Date().toISOString(),
    });
    setMode('none');
  }

  function openBuyConfirm(item: ShoppingItem) {
    setBuyItem(item);
    setBuyKitId(kits[0]?.id ?? '');
    setBuyQty(item.quantity);
    setMode('buyConfirm');
  }

  function confirmBought() {
    if (!buyItem) return;
    if (!buyKitId) { Alert.alert('Выберите аптечку'); return; }
    const kit = kits.find(k => k.id === buyKitId);
    const now = new Date().toISOString();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    const expiryStr = `${expiry.getFullYear()}-${String(expiry.getMonth()+1).padStart(2,'0')}-${String(expiry.getDate()).padStart(2,'0')}`;

    addMedicine({
      id:                `med-${Date.now()}`,
      kitId:             buyKitId,
      name:              buyItem.name,
      dosage:            buyItem.dosage,
      form:              buyItem.form ?? (buyItem.prefill?.form ?? 'tablets'),
      manufacturer:      buyItem.prefill?.manufacturer,
      activeIngredient:  buyItem.prefill?.activeIngredient,
      totalQuantity:     buyQty,
      remainingQuantity: buyQty,
      expirationDate:    expiryStr,
      notes:             buyItem.notes,
      tags:              buyItem.prefill?.tags,
      addedAt:           now,
      updatedAt:         now,
    });
    deleteItem(buyItem.id);
    setMode('none');
    Alert.alert('Добавлено!', `«${buyItem.name}» добавлен в аптечку «${kit?.name ?? ''}»`);
  }

  const kitMedicines = useMemo(
    () => medicines.filter(m => m.kitId === selectedKitForPick),
    [medicines, selectedKitForPick],
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Купить</Text>
        {items.length > 0 && (
          <Text style={{ fontSize: Typography.size.body, color: C.textSecondary, fontWeight: Typography.weight.semibold }}>
            {items.length} {items.length === 1 ? 'позиция' : 'позиций'}
          </Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            kitten="shopping"
            title="Список покупок пуст"
            subtitle="Добавьте препараты, которые нужно купить"
            actionLabel="Добавить"
            onAction={() => setMode('menu')}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => openBuyConfirm(item)}
            onLongPress={() =>
              Alert.alert(item.name, 'Удалить из списка?', [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Удалить', style: 'destructive', onPress: () => deleteItem(item.id) },
              ])
            }
            activeOpacity={0.85}
          >
            <View style={s.checkBox}>
              <Icon name="cart-outline" size={14} color={C.blue} />
            </View>
            <View style={s.itemInfo}>
              <Text style={s.itemName}>{item.name}</Text>
              {(item.dosage || item.notes) ? (
                <Text style={s.itemSub}>{[item.dosage, item.notes].filter(Boolean).join(' · ')}</Text>
              ) : null}
            </View>
            <View style={s.itemQty}>
              <Text style={s.itemQtyText}>{item.quantity} шт</Text>
            </View>
            <Icon name="chevron-right" size={20} color={C.textTertiary} />
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setMode('menu')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={30} color={C.white} />
      </TouchableOpacity>

      {/* ── Add menu modal ── */}
      <Modal visible={mode === 'menu'} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMode('none')}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.sheet, { paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.lg) }]}>
              <Text style={s.sheetTitle}>Добавить в список</Text>
              {[
                { icon: 'pencil-plus', bg: C.blueLight, title: 'Ввести вручную', sub: 'Название, дозировка, количество', onPress: openManual },
                { icon: 'magnify', bg: C.successLight, title: 'Найти в базе', sub: 'Поиск по названию или веществу', onPress: () => { setSearchQuery(''); setSearchResults([]); setMode('search'); } },
                { icon: 'medical-bag', bg: C.accentLight, title: 'Из аптечки', sub: 'Выбрать из имеющихся препаратов', onPress: () => { setSelectedKitForPick(kits[0]?.id ?? ''); setMode('fromKit'); } },
              ].map(opt => (
                <TouchableOpacity key={opt.title} style={s.sheetOption} onPress={opt.onPress} activeOpacity={0.8}>
                  <View style={[s.sheetOptionIcon, { backgroundColor: opt.bg }]}>
                    <Icon name={opt.icon} size={22} color={opt.bg === C.blueLight ? C.blueDark : opt.bg === C.successLight ? C.successDark : C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sheetOptionText}>{opt.title}</Text>
                    <Text style={s.sheetOptionSub}>{opt.sub}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={C.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Manual entry modal ── */}
      <Modal visible={mode === 'manual'} transparent animationType="slide">
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.sheet, { paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.lg) }]}>
            <Text style={s.sheetTitle}>Добавить вручную</Text>
            <Text style={s.formLabel}>Название *</Text>
            <TextInput
              style={s.formInput}
              placeholder="Название препарата"
              placeholderTextColor={C.textTertiary}
              value={manualName}
              onChangeText={setManualName}
              autoFocus
            />
            <Text style={s.formLabel}>Дозировка</Text>
            <TextInput
              style={s.formInput}
              placeholder="500 мг, 5 мл…"
              placeholderTextColor={C.textTertiary}
              value={manualDosage}
              onChangeText={setManualDosage}
            />
            <Text style={s.formLabel}>Количество</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setManualQty(q => Math.max(1, q - 1))}>
                <Icon name="minus" size={18} color={C.blue} />
              </TouchableOpacity>
              <View style={s.qtyValue}>
                <Text style={s.qtyValueText}>{manualQty} шт</Text>
              </View>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setManualQty(q => q + 1)}>
                <Icon name="plus" size={18} color={C.blue} />
              </TouchableOpacity>
            </View>
            <Text style={s.formLabel}>Заметки</Text>
            <TextInput
              style={s.formInput}
              placeholder="Марка, аналог…"
              placeholderTextColor={C.textTertiary}
              value={manualNotes}
              onChangeText={setManualNotes}
            />
            <TouchableOpacity style={s.saveBtn} onPress={saveManual} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Добавить в список</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setMode('menu')}>
              <Text style={s.cancelText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Search modal ── */}
      <Modal visible={mode === 'search'} transparent animationType="slide">
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.sheet, { maxHeight: '80%', paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.lg) }]}>
            <Text style={s.sheetTitle}>Поиск препарата</Text>
            <View style={s.searchRow}>
              <Icon name="magnify" size={18} color={C.textTertiary} />
              <TextInput
                style={s.searchInput}
                placeholder="Название или действующее вещество"
                placeholderTextColor={C.textTertiary}
                value={searchQuery}
                onChangeText={q => { setSearchQuery(q); runSearch(q); }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Icon name="close" size={16} color={C.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
              {searchResults.map((r, i) => (
                <TouchableOpacity key={i} style={s.searchResult} onPress={() => addFromSearch(r)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.searchResultName}>{r.name}</Text>
                    {r.activeIngredient ? <Text style={s.searchResultSub}>{r.activeIngredient}</Text> : null}
                  </View>
                  <Icon name="plus" size={18} color={C.blue} />
                </TouchableOpacity>
              ))}
              {searchResults.length === 0 && searchQuery.length > 1 && (
                <Text style={{ color: C.textTertiary, textAlign: 'center', padding: Spacing.lg, fontSize: Typography.size.body }}>
                  Ничего не найдено
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setMode('menu')}>
              <Text style={s.cancelText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── From kit modal ── */}
      <Modal visible={mode === 'fromKit'} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMode('none')}>
          <View style={[s.sheet, { maxHeight: '85%', paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.lg) }]}>
            <Text style={s.sheetTitle}>Выбрать из аптечки</Text>
            {kits.length === 0 ? (
              <Text style={{ color: C.textSecondary, padding: Spacing.md }}>Нет аптечек</Text>
            ) : (
              <>
                <Text style={s.sectionLabel}>Аптечка</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  {kits.map(kit => (
                    <TouchableOpacity
                      key={kit.id}
                      style={[s.kitChip, selectedKitForPick === kit.id && s.kitChipActive]}
                      onPress={() => setSelectedKitForPick(kit.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 16 }}>{kit.icon}</Text>
                      <Text style={[s.kitChipText, selectedKitForPick === kit.id && s.kitChipTextActive]}>{kit.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={s.sectionLabel}>Препараты</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {kitMedicines.length === 0 ? (
                    <Text style={{ color: C.textTertiary, padding: Spacing.md, fontSize: Typography.size.body }}>В этой аптечке нет препаратов</Text>
                  ) : kitMedicines.map(med => (
                    <TouchableOpacity
                      key={med.id}
                      style={[s.searchResult]}
                      onPress={() => addFromKitMedicine(med)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.searchResultName}>{med.name}</Text>
                        {med.dosage ? <Text style={s.searchResultSub}>{med.dosage}</Text> : null}
                      </View>
                      <Icon name="plus" size={18} color={C.blue} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setMode('none')}>
              <Text style={s.cancelText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Buy confirm modal ── */}
      <Modal visible={mode === 'buyConfirm'} transparent animationType="slide">
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.buySheet, { paddingBottom: Math.max(Spacing.xl, insets.bottom + Spacing.lg) }]}>
            <Text style={s.buyTitle}>Купил(а)! 🎉</Text>
            <Text style={s.buySub}>Добавить «{buyItem?.name}» в аптечку</Text>

            <Text style={s.sectionLabel}>В какую аптечку?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
              {kits.map(kit => (
                <TouchableOpacity
                  key={kit.id}
                  style={[s.kitChip, buyKitId === kit.id && s.kitChipActive]}
                  onPress={() => setBuyKitId(kit.id)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 16 }}>{kit.icon}</Text>
                  <Text style={[s.kitChipText, buyKitId === kit.id && s.kitChipTextActive]}>{kit.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.sectionLabel}>Сколько купил(а)?</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setBuyQty(q => Math.max(1, q - 1))}>
                <Icon name="minus" size={18} color={C.blue} />
              </TouchableOpacity>
              <View style={s.qtyValue}>
                <Text style={s.qtyValueText}>{buyQty} шт</Text>
              </View>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setBuyQty(q => q + 1)}>
                <Icon name="plus" size={18} color={C.blue} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={confirmBought} activeOpacity={0.85}>
              <Text style={s.confirmBtnText}>Добавить в аптечку</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setMode('none')}>
              <Text style={s.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
