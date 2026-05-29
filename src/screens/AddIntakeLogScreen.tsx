import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { JournalStackParamList, IntakeMedicineEntry } from '../types';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';

let DatePicker: any = null;
try { DatePicker = require('react-native-date-picker').default; } catch {}

type Nav = NativeStackNavigationProp<JournalStackParamList, 'AddIntakeLog'>;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isoTime(d: Date) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const COMMON_SYMPTOMS = [
  'Головная боль', 'Температура', 'Кашель', 'Насморк', 'Боль в горле',
  'Тошнота', 'Усталость', 'Боль в животе', 'Головокружение', 'Бессонница',
  'Боль в мышцах', 'Аллергия', 'Давление', 'Боль в спине', 'Изжога',
];

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 48 },
    sec: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md,
    },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.xs, ...Shadow.card,
    },

    // Date / time row
    dateTimeRow: { flexDirection: 'row', gap: Spacing.sm },
    datePicker: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border, paddingHorizontal: Spacing.md, height: 44,
    },
    datePickerText: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: C.textPrimary },

    // Medicine entries
    entryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    entryInput: {
      flex: 1, height: 40, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.sm, fontSize: Typography.size.body, color: C.textPrimary,
      textAlignVertical: 'center',
    },
    entryQtyWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border, paddingHorizontal: Spacing.xs, height: 40,
    },
    entryQtyBtn: { padding: 4 },
    entryQtyText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textPrimary, minWidth: 22, textAlign: 'center' },
    unitPill: {
      backgroundColor: C.blueLight, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.xs, paddingVertical: 2,
    },
    unitText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.blueDark },
    addEntryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.blue,
      borderRadius: Radius.md, paddingVertical: Spacing.sm,
    },
    addEntryBtnText: { fontSize: Typography.size.body, color: C.blue, fontWeight: Typography.weight.bold },

    // Pick from kit row
    kitMedRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.borderLight, gap: Spacing.sm,
    },
    kitMedName: { flex: 1, fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },

    // Kit chips
    kitChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
    kitChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.sm, paddingVertical: 6,
      borderRadius: Radius.xl, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard,
    },
    kitChipActive: { backgroundColor: C.blueLight, borderColor: C.blue },
    kitChipText:   { fontSize: Typography.size.body, fontWeight: Typography.weight.semibold, color: C.textSecondary },
    kitChipTextA:  { color: C.blueDark },

    // Symptoms
    chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    chip: {
      paddingHorizontal: Spacing.sm, paddingVertical: 6,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard,
    },
    chipActive: { backgroundColor: C.warningLight, borderColor: C.warning },
    chipText:   { fontSize: Typography.size.body, fontWeight: Typography.weight.semibold, color: C.textSecondary },
    chipTextA:  { color: C.warningDark },

    // Notes
    notesInput: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, borderWidth: 1.5,
      borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      fontSize: Typography.size.md, color: C.textPrimary,
      minHeight: 70, textAlignVertical: 'top',
    },

    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl, padding: Spacing.lg,
      alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card,
    },
    saveBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function unitFor(form?: string): string {
  if (form === 'syrup') return 'мл';
  if (form === 'drops') return 'кап';
  return 'шт';
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function AddIntakeLogScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<any>();
  const passedDate = route.params?.date as string | undefined;
  const logId      = route.params?.logId as string | undefined;

  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const intakeLogs  = useAppStore(st => st.intakeLogs);
  const addLog      = useAppStore(st => st.addIntakeLog);
  const updateLog   = useAppStore(st => st.updateIntakeLog);
  const medicines   = useAppStore(st => st.medicines);
  const kits        = useAppStore(st => st.kits);

  const existingLog = logId ? intakeLogs.find(l => l.id === logId) : undefined;

  const now = new Date();
  const [dateObj,  setDateObj]  = useState<Date>(() => {
    if (existingLog) {
      const [y, m, d] = existingLog.date.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    if (passedDate) {
      const [y, m, d] = passedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return now;
  });
  const [timeObj,  setTimeObj]  = useState<Date>(() => {
    if (existingLog) {
      const [h, min] = existingLog.time.split(':').map(Number);
      const d = new Date(); d.setHours(h, min, 0, 0); return d;
    }
    return now;
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const [entries,   setEntries]  = useState<IntakeMedicineEntry[]>(
    existingLog?.entries ?? [{ medicineName: '', quantity: 1, unit: 'шт' }],
  );
  const [symptoms,  setSymptoms] = useState<string[]>(existingLog?.symptoms ?? []);
  const [notes,     setNotes]    = useState(existingLog?.notes ?? '');

  const [kitFilter, setKitFilter] = useState(kits[0]?.id ?? '');

  const kitMedicines = useMemo(
    () => medicines.filter(m => m.kitId === kitFilter),
    [medicines, kitFilter],
  );

  function updateEntry(i: number, field: keyof IntakeMedicineEntry, value: string | number) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  function addFromKit(med: typeof medicines[0]) {
    setEntries(prev => [...prev, { medicineId: med.id, medicineName: med.name, quantity: 1, unit: unitFor(med.form) }]);
  }

  function toggleSymptom(sym: string) {
    setSymptoms(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]);
  }

  function handleSave() {
    const validEntries = entries.filter(e => e.medicineName.trim());
    if (validEntries.length === 0) { Alert.alert('Добавьте хотя бы один препарат'); return; }
    const date = isoDate(dateObj);
    const time = isoTime(timeObj);
    if (existingLog && logId) {
      updateLog(logId, { date, time, entries: validEntries, symptoms, notes: notes.trim() || undefined });
    } else {
      addLog({ id: `log-${Date.now()}`, date, time, entries: validEntries, symptoms, notes: notes.trim() || undefined, createdAt: new Date().toISOString() });
    }
    navigation.goBack();
  }

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Date & Time */}
          <Text style={s.sec}>Дата и время</Text>
          <View style={s.card}>
            <View style={s.dateTimeRow}>
              <TouchableOpacity style={s.datePicker} onPress={() => setDateOpen(true)} activeOpacity={0.8}>
                <Text style={s.datePickerText}>{dateObj.toLocaleDateString('ru')}</Text>
                <Icon name="calendar" size={18} color={C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.datePicker} onPress={() => setTimeOpen(true)} activeOpacity={0.8}>
                <Text style={s.datePickerText}>{isoTime(timeObj)}</Text>
                <Icon name="clock-outline" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Medicines from kit */}
          <Text style={s.sec}>Выбрать из аптечки</Text>
          <View style={s.card}>
            {kits.length > 0 ? (
              <>
                <View style={s.kitChipRow}>
                  {kits.map(k => (
                    <TouchableOpacity
                      key={k.id}
                      style={[s.kitChip, kitFilter === k.id && s.kitChipActive]}
                      onPress={() => setKitFilter(k.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 14 }}>{k.icon}</Text>
                      <Text style={[s.kitChipText, kitFilter === k.id && s.kitChipTextA]}>{k.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {kitMedicines.length === 0 ? (
                  <Text style={{ color: C.textTertiary, fontSize: Typography.size.body }}>Нет препаратов</Text>
                ) : kitMedicines.map(med => (
                  <TouchableOpacity key={med.id} style={s.kitMedRow} onPress={() => addFromKit(med)} activeOpacity={0.8}>
                    <Text style={s.kitMedName}>{med.name}{med.dosage ? ` ${med.dosage}` : ''}</Text>
                    <Icon name="plus" size={18} color={C.blue} />
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <Text style={{ color: C.textTertiary, fontSize: Typography.size.body }}>Нет аптечек</Text>
            )}
          </View>

          {/* Medicine entries list */}
          <Text style={s.sec}>Принятые препараты</Text>
          <View style={s.card}>
            {entries.map((entry, i) => (
              <View key={i} style={s.entryRow}>
                <TextInput
                  style={s.entryInput}
                  placeholder="Название препарата"
                  placeholderTextColor={C.textTertiary}
                  value={entry.medicineName}
                  onChangeText={v => updateEntry(i, 'medicineName', v)}
                />
                <View style={s.entryQtyWrap}>
                  <TouchableOpacity style={s.entryQtyBtn} onPress={() => updateEntry(i, 'quantity', Math.max(1, Number(entry.quantity) - 1))}>
                    <Icon name="minus" size={14} color={C.blue} />
                  </TouchableOpacity>
                  <Text style={s.entryQtyText}>{entry.quantity}</Text>
                  <TouchableOpacity style={s.entryQtyBtn} onPress={() => updateEntry(i, 'quantity', Number(entry.quantity) + 1)}>
                    <Icon name="plus" size={14} color={C.blue} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={s.unitPill}
                  onPress={() => updateEntry(i, 'unit', entry.unit === 'шт' ? 'мл' : entry.unit === 'мл' ? 'кап' : 'шт')}
                >
                  <Text style={s.unitText}>{entry.unit}</Text>
                </TouchableOpacity>
                {entries.length > 1 && (
                  <TouchableOpacity onPress={() => removeEntry(i)}>
                    <Icon name="close" size={18} color={C.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={s.addEntryBtn}
              onPress={() => setEntries(prev => [...prev, { medicineName: '', quantity: 1, unit: 'шт' }])}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={14} color={C.blue} />
              <Text style={s.addEntryBtnText}>Добавить препарат</Text>
            </TouchableOpacity>
          </View>

          {/* Symptoms */}
          <Text style={s.sec}>Симптомы</Text>
          <View style={s.card}>
            <View style={s.chipRow}>
              {COMMON_SYMPTOMS.map(sym => (
                <TouchableOpacity
                  key={sym}
                  style={[s.chip, symptoms.includes(sym) && s.chipActive]}
                  onPress={() => toggleSymptom(sym)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, symptoms.includes(sym) && s.chipTextA]}>{sym}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <Text style={s.sec}>Заметки</Text>
          <View style={s.card}>
            <TextInput
              style={s.notesInput}
              placeholder="Как себя чувствуете, особые наблюдения…"
              placeholderTextColor={C.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>{existingLog ? 'Сохранить изменения' : 'Сохранить запись'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {DatePicker && (
        <>
          <DatePicker modal open={dateOpen} date={dateObj} mode="date"
            title="Выберите дату" confirmText="Готово" cancelText="Отмена"
            onConfirm={d => { setDateOpen(false); setDateObj(d); }}
            onCancel={() => setDateOpen(false)} />
          <DatePicker modal open={timeOpen} date={timeObj} mode="time"
            title="Выберите время" confirmText="Готово" cancelText="Отмена"
            onConfirm={d => { setTimeOpen(false); setTimeObj(d); }}
            onCancel={() => setTimeOpen(false)} />
        </>
      )}
    </SafeAreaView>
  );
}
