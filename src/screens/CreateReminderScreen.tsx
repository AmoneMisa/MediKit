import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, Alert, Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotificationsStackParamList, MedicineReminder } from '../types';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';

let DatePicker: any = null;
try { DatePicker = require('react-native-date-picker').default; } catch {}

type Nav = NativeStackNavigationProp<NotificationsStackParamList, 'CreateReminder'>;

// Monday first → Sunday last
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'] as const;

// ── Styles factory ─────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 40 },

    sec: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase',
      letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.xs, ...Shadow.card,
    },
    chipRow: { paddingBottom: Spacing.sm, gap: Spacing.sm, flexDirection: 'row' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.bgCard,
    },
    chipActive:     { backgroundColor: C.blue, borderColor: C.blue },
    chipText:       { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textSecondary },
    chipTextActive: { color: C.white },

    timeRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    timePill: {
      flex: 1, backgroundColor: C.blueLight, borderRadius: Radius.md,
      padding: Spacing.md, alignItems: 'center', justifyContent: 'center',
    },
    timePillText: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.blueDark },
    removeBtn:     { padding: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
    removeBtnText: { fontSize: Typography.size.base, color: C.danger },
    addTimeBtn: {
      marginTop: Spacing.sm, borderWidth: 1.5, borderColor: C.borderDashed,
      borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.md,
      alignItems: 'center', justifyContent: 'center',
    },
    addTimeBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.blue },

    daysGrid:        { flexDirection: 'row', justifyContent: 'space-between' },
    dayBtn: {
      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCardAlt,
    },
    dayBtnActive:     { backgroundColor: C.blue, borderColor: C.blue },
    dayBtnText:       { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textSecondary },
    dayBtnTextActive: { color: C.white },
    everyDayHint:     { fontSize: Typography.size.body, color: C.success, marginTop: Spacing.sm, textAlign: 'center' },

    pillCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pillCountBtn: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: C.blueLight,
      alignItems: 'center', justifyContent: 'center',
    },
    pillCountBtnText: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, color: C.blue },
    pillCountBox:     { alignItems: 'center' },
    pillCountText:    { fontSize: 28, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    pillCountUnit:    { fontSize: Typography.size.body, color: C.textSecondary },

    notesInput: {
      fontSize: Typography.size.md, color: C.textPrimary,
      minHeight: 50, textAlignVertical: 'top',
    },

    activeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    activeLabel: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    activeSub:   { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },

    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl, padding: Spacing.lg,
      alignItems: 'center', justifyContent: 'center',
      marginTop: Spacing.lg, ...Shadow.card,
    },
    saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.white },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function CreateReminderScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<any>();
  const t          = useT();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);

  const { reminderId, kitId: initKitId, medicineId: initMedId } = (route.params ?? {}) as {
    reminderId?: string; kitId?: string; medicineId?: string;
  };

  const kits      = useAppStore(state => state.kits);
  const medicines = useAppStore(state => state.medicines);
  const addR      = useAppStore(state => state.addReminder);
  const updateR   = useAppStore(state => state.updateReminder);
  const existing  = useAppStore(state => reminderId ? state.getReminder(reminderId) : undefined);

  const [selectedKitId,  setSelectedKitId]  = useState(existing?.kitId  ?? initKitId ?? '');
  const [selectedMedId,  setSelectedMedId]  = useState(existing?.medicineId ?? initMedId ?? '');
  const [pillCount,      setPillCount]      = useState(String(existing?.pillCount ?? 1));
  const [times,          setTimes]          = useState<string[]>(existing?.times ?? ['08:00']);
  const [days,           setDays]           = useState<number[]>(existing?.daysOfWeek ?? []);
  const [notes,          setNotes]          = useState(existing?.notes ?? '');
  const [isActive,       setIsActive]       = useState(existing?.isActive ?? true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingTimeIdx, setEditingTimeIdx] = useState<number | null>(null);
  const [tempDate,       setTempDate]       = useState(new Date());

  const kitMedicines = useMemo(
    () => medicines.filter(m => m.kitId === selectedKitId),
    [medicines, selectedKitId],
  );

  const selectedMed = medicines.find(m => m.id === selectedMedId);
  const selectedKit = kits.find(k => k.id === selectedKitId);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function addTime() {
    const base = times[times.length - 1] ?? '08:00';
    const [h, m] = base.split(':').map(Number);
    const next = `${String((h + 4) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setTimes(prev => [...prev, next]);
  }

  function removeTime(idx: number) {
    if (times.length <= 1) return;
    setTimes(prev => prev.filter((_, i) => i !== idx));
  }

  function openTimePicker(idx: number) {
    const [h, m] = (times[idx] ?? '08:00').split(':').map(Number);
    const d = new Date(); d.setHours(h); d.setMinutes(m); d.setSeconds(0);
    setTempDate(d);
    setEditingTimeIdx(idx);
    setShowTimePicker(true);
  }

  function confirmTime(date: Date) {
    setShowTimePicker(false);
    if (editingTimeIdx === null) return;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    setTimes(prev => prev.map((tt, i) => i === editingTimeIdx ? `${hh}:${mm}` : tt));
    setEditingTimeIdx(null);
  }

  function handleSave() {
    if (!selectedKitId)  { Alert.alert(t('choose_kit')); return; }
    if (!selectedMedId)  { Alert.alert(t('choose_medicine')); return; }
    if (times.length < 1) { Alert.alert(t('times_label')); return; }

    const pc = Math.max(1, parseInt(pillCount, 10) || 1);
    const now = new Date().toISOString();

    if (reminderId && existing) {
      updateR(reminderId, {
        kitId: selectedKitId, medicineId: selectedMedId,
        medicineName: selectedMed?.name ?? '', kitName: selectedKit?.name ?? '',
        pillCount: pc, times, daysOfWeek: days, isActive,
        notes: notes.trim() || undefined,
      });
    } else {
      const reminder: MedicineReminder = {
        id: `rem-${Date.now()}`, kitId: selectedKitId, medicineId: selectedMedId,
        medicineName: selectedMed?.name ?? '', kitName: selectedKit?.name ?? '',
        pillCount: pc, times, daysOfWeek: days, startDate: now.slice(0, 10),
        isActive, notes: notes.trim() || undefined, createdAt: now,
      };
      addR(reminder);
    }
    navigation.goBack();
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Kit selector ── */}
        <Text style={s.sec}>{t('choose_kit')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {kits.map(k => (
            <TouchableOpacity
              key={k.id}
              style={[s.chip, selectedKitId === k.id && s.chipActive]}
              onPress={() => { setSelectedKitId(k.id); setSelectedMedId(''); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>{k.icon}</Text>
              <Text style={[s.chipText, selectedKitId === k.id && s.chipTextActive]}>{k.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Medicine selector ── */}
        {selectedKitId ? (
          <>
            <Text style={s.sec}>{t('choose_medicine')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {kitMedicines.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.chip, selectedMedId === m.id && s.chipActive]}
                  onPress={() => setSelectedMedId(m.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, selectedMedId === m.id && s.chipTextActive]}>
                    {m.name}{m.dosage ? ` ${m.dosage}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* ── Times ── */}
        <Text style={s.sec}>{t('times_label')}</Text>
        <View style={s.card}>
          {times.map((time, idx) => (
            <View key={idx} style={s.timeRow}>
              <TouchableOpacity
                style={s.timePill}
                onPress={() => DatePicker ? openTimePicker(idx) : null}
                activeOpacity={0.8}
              >
                <Text style={s.timePillText}>🕐 {time}</Text>
              </TouchableOpacity>
              {times.length > 1 && (
                <TouchableOpacity onPress={() => removeTime(idx)} style={s.removeBtn} hitSlop={8}>
                  <Text style={s.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={s.addTimeBtn} onPress={addTime} activeOpacity={0.8}>
            <Text style={s.addTimeBtnText}>{t('add_time')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Days of week (Mon first, Sun last) ── */}
        <Text style={s.sec}>{t('days_label')}</Text>
        <View style={s.card}>
          <View style={s.daysGrid}>
            {DAYS_OF_WEEK.map(d => (
              <TouchableOpacity
                key={d}
                style={[s.dayBtn, days.includes(d) && s.dayBtnActive]}
                onPress={() => toggleDay(d)}
                activeOpacity={0.8}
              >
                <Text style={[s.dayBtnText, days.includes(d) && s.dayBtnTextActive]}>
                  {t(DAY_KEYS[d])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {days.length === 0 ? (
            <Text style={s.everyDayHint}>✓ {t('every_day')}</Text>
          ) : null}
        </View>

        {/* ── Pills per dose ── */}
        <Text style={s.sec}>{t('pills_label')}</Text>
        <View style={[s.card, s.pillCountRow]}>
          <TouchableOpacity
            style={s.pillCountBtn}
            onPress={() => setPillCount(prev => String(Math.max(1, parseInt(prev) - 1)))}
            activeOpacity={0.8}
          >
            <Text style={s.pillCountBtnText}>−</Text>
          </TouchableOpacity>
          <View style={s.pillCountBox}>
            <Text style={s.pillCountText}>{pillCount}</Text>
            <Text style={s.pillCountUnit}>
              {selectedMed?.form === 'syrup' ? 'мл' : selectedMed?.form === 'drops' ? 'кап' : 'шт'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.pillCountBtn}
            onPress={() => setPillCount(prev => String(parseInt(prev) + 1))}
            activeOpacity={0.8}
          >
            <Text style={s.pillCountBtnText}>＋</Text>
          </TouchableOpacity>
        </View>

        {/* ── Notes ── */}
        <Text style={s.sec}>{t('reminder_notes')}</Text>
        <View style={s.card}>
          <TextInput
            style={s.notesInput}
            placeholder="Принимать с едой…"
            placeholderTextColor={C.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* ── Active toggle ── */}
        <View style={[s.card, s.activeRow]}>
          <View style={{ flex: 1 }}>
            <Text style={s.activeLabel}>
              {isActive ? '🔔 ' : '🔕 '}{isActive ? t('reminder_active') : t('reminder_paused')}
            </Text>
            <Text style={s.activeSub}>
              {isActive ? 'Напоминания будут приходить' : 'Напоминания приостановлены'}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ true: C.blue, false: C.border }}
            thumbColor={C.white}
          />
        </View>

        {/* ── Save ── */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>💾 {t('save')}</Text>
        </TouchableOpacity>

      </ScrollView>

      {DatePicker && showTimePicker ? (
        <DatePicker
          modal
          open={showTimePicker}
          date={tempDate}
          mode="time"
          onConfirm={confirmTime}
          onCancel={() => { setShowTimePicker(false); setEditingTimeIdx(null); }}
          title={t('times_label')}
          confirmText={t('save')}
          cancelText={t('cancel')}
          locale="ru"
        />
      ) : null}
    </SafeAreaView>
  );
}
