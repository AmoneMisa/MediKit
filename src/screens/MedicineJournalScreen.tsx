import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { JournalStackParamList, MedicineIntakeLog } from '../types';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState } from '../components';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalHome'>;

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function fmtTime(time: string): string { return time; }

// Monday-first day index (0=Mon … 6=Sun)
function mondayIndex(d: Date): number { return (d.getDay() + 6) % 7; }

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    title:  { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },

    // Week calendar
    weekNav: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
    },
    weekNavBtn: { padding: Spacing.sm },
    weekLabel:  { flex: 1, textAlign: 'center', fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textSecondary },
    daysRow:    { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.xs, marginBottom: Spacing.md },
    dayCell: {
      flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
    },
    dayCellActive: { backgroundColor: C.blue },
    dayLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.textTertiary, marginBottom: 2 },
    dayLabelActive: { color: C.white },
    dayNum:   { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    dayNumActive: { color: C.white },
    dayDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue, marginTop: 3 },
    dayDotActive: { backgroundColor: C.white },

    // Date header
    dateHeader: {
      paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    },
    dateHeaderText: {
      fontSize: Typography.size.body, fontWeight: Typography.weight.bold,
      color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
    },

    // Log card
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.sm,
      borderLeftWidth: 4, borderLeftColor: C.blue,
      ...Shadow.card,
    },
    cardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    timeText: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.blue, marginRight: Spacing.md },
    medRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
    medChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.blueLight, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3,
    },
    medChipText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.blueDark },
    symptomRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    symptomChip: {
      backgroundColor: C.warningLight, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 2,
    },
    symptomText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: C.warningDark },
    notesText:   { fontSize: Typography.size.body, color: C.textSecondary, marginTop: Spacing.xs, fontStyle: 'italic' },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
    actionBtn:   { padding: Spacing.xs },

    fab: {
      position: 'absolute', right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', ...Shadow.card,
    },
  });
}

export function MedicineJournalScreen() {
  const navigation = useNavigation<Nav>();
  const C      = useColors();
  const s      = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const intakeLogs  = useAppStore(st => st.intakeLogs);
  const deleteLog   = useAppStore(st => st.deleteIntakeLog);

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(isoDate(today));
  const [weekOffset,   setWeekOffset]   = useState(0);

  // Build 7 days for the current week (Mon-first, adjusted by weekOffset)
  const weekDays = useMemo(() => {
    const result: Date[] = [];
    const base = new Date(today);
    // Monday of this week
    base.setDate(base.getDate() - mondayIndex(base) + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      result.push(d);
    }
    return result;
  }, [today, weekOffset]);

  const weekLabel = useMemo(() => {
    const from = weekDays[0];
    const to   = weekDays[6];
    return `${from.getDate()} ${from.toLocaleString('ru', { month: 'short' })} – ${to.getDate()} ${to.toLocaleString('ru', { month: 'short' })}`;
  }, [weekDays]);

  // Set of dates that have logs
  const datesWithLogs = useMemo(() => new Set(intakeLogs.map(l => l.date)), [intakeLogs]);

  const logsForDate = useMemo(
    () => [...intakeLogs]
      .filter(l => l.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time)),
    [intakeLogs, selectedDate],
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Журнал</Text>
      </View>

      {/* Week navigation */}
      <View style={s.weekNav}>
        <TouchableOpacity style={s.weekNavBtn} onPress={() => setWeekOffset(w => w - 1)}>
          <Icon name="chevron-left" size={22} color={C.textSecondary} />
        </TouchableOpacity>
        <Text style={s.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity style={s.weekNavBtn} onPress={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
          <Icon name="chevron-right" size={22} color={weekOffset >= 0 ? C.textTertiary : C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Day strip */}
      <View style={s.daysRow}>
        {weekDays.map((d, i) => {
          const iso     = isoDate(d);
          const active  = iso === selectedDate;
          const hasLogs = datesWithLogs.has(iso);
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayCell, active && s.dayCellActive]}
              onPress={() => setSelectedDate(iso)}
              activeOpacity={0.8}
            >
              <Text style={[s.dayLabel, active && s.dayLabelActive]}>{WEEKDAYS_SHORT[i]}</Text>
              <Text style={[s.dayNum, active && s.dayNumActive]}>{d.getDate()}</Text>
              {hasLogs ? <View style={[s.dayDot, active && s.dayDotActive]} /> : <View style={{ height: 8 }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date label */}
      <View style={s.dateHeader}>
        <Text style={s.dateHeaderText}>{fmtDate(selectedDate)}</Text>
      </View>

      {/* Logs list */}
      <FlatList
        data={logsForDate}
        keyExtractor={l => l.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            kitten="calendar"
            title="Нет записей"
            subtitle="Добавьте запись о приёме препаратов"
            actionLabel="Добавить запись"
            onAction={() => navigation.navigate('AddIntakeLog', { date: selectedDate })}
          />
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.timeText}>{fmtTime(item.time)}</Text>
              <View style={{ flex: 1 }}>
                <View style={s.medRow}>
                  {item.entries.map((e, i) => (
                    <View key={i} style={s.medChip}>
                      <Icon name="pill" size={11} color={C.blueDark} />
                      <Text style={s.medChipText}>{e.medicineName} {e.quantity}{e.unit}</Text>
                    </View>
                  ))}
                </View>
                {item.symptoms.length > 0 && (
                  <View style={s.symptomRow}>
                    {item.symptoms.map((sym, i) => (
                      <View key={i} style={s.symptomChip}>
                        <Text style={s.symptomText}>{sym}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {item.notes ? <Text style={s.notesText}>{item.notes}</Text> : null}
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => navigation.navigate('AddIntakeLog', { date: selectedDate, logId: item.id })}
              >
                <Icon name="pencil" size={18} color={C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() =>
                  Alert.alert('Удалить запись?', undefined, [
                    { text: 'Отмена', style: 'cancel' },
                    { text: 'Удалить', style: 'destructive', onPress: () => deleteLog(item.id) },
                  ])
                }
              >
                <Icon name="delete" size={18} color={C.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate('AddIntakeLog', { date: selectedDate })}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={30} color={C.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
