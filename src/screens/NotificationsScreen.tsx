import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppNotification, NotificationType, MedicineReminder, NotificationsStackParamList } from '../types';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState } from '../components';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<NotificationsStackParamList, 'NotificationsHome'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return 'только что';
    if (m < 60) return `${m} мин.`;
    if (h < 24) return `${h} ч.`;
    return `${d} дн.`;
  } catch { return ''; }
}

function isTakenToday(r: MedicineReminder): boolean {
  if (!r.lastTakenAt) return false;
  return new Date(r.lastTakenAt).toDateString() === new Date().toDateString();
}

function dueTodayTimes(r: MedicineReminder): string[] {
  if (!r.isActive) return [];
  const today = new Date().getDay();
  if (r.daysOfWeek.length > 0 && !r.daysOfWeek.includes(today)) return [];
  return r.times;
}

// ── Styles factory ─────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bgPage },

    header:  {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    title:   { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    markAll: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.blue },

    segmentRow: {
      flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
      backgroundColor: C.bgCardAlt, borderRadius: Radius.lg, padding: 3,
    },
    seg:          { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
    segActive:    { backgroundColor: C.bgCard, ...Shadow.sm },
    segText:      { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textTertiary },
    segTextActive:{ color: C.blue },

    searchBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard,
      borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm, height: 42, gap: Spacing.sm,
    },
    searchIcon:  { fontSize: 14, color: C.textTertiary },
    searchInput: { flex: 1, fontSize: Typography.size.md, color: C.textPrimary },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

    // Notification card
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, ...Shadow.card,
    },
    cardRead:       { opacity: 0.6 },
    dot:            { width: 10, height: 10, borderRadius: 5, marginTop: 5, flexShrink: 0 },
    body:           { flex: 1 },
    notifTitle:     { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },
    notifTitleRead: { fontWeight: Typography.weight.regular as any },
    notifSub:       { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 3 },
    right:          { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
    time:           { fontSize: Typography.size.xs, color: C.textTertiary },
    dismiss:        { fontSize: 14, color: C.textTertiary },

    // Reminder card
    remCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.md,
      borderLeftWidth: 4, borderLeftColor: C.blue, ...Shadow.card,
    },
    remCardInactive: { borderLeftColor: C.textTertiary, opacity: 0.7 },
    remHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
    remInfo:     { flex: 1 },
    remName:     { fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    remKit:      { fontSize: Typography.size.xs, color: C.textSecondary, marginTop: 2 },
    remBadge:    { marginLeft: Spacing.sm },
    remBadgeText:     { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
    remBadgeActive:   { backgroundColor: C.successLight, color: C.successDark },
    remBadgeInactive: { backgroundColor: C.bgCardAlt, color: C.textTertiary },

    timesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm, alignItems: 'center' },
    timeBubble:      { backgroundColor: C.blueLight, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    timeBubbleTaken: { backgroundColor: C.successLight },
    timeBubbleText:      { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.blueDark },
    timeBubbleTextTaken: { color: C.successDark },
    pillCountText: { fontSize: Typography.size.xs, color: C.textSecondary, fontWeight: Typography.weight.semibold },
    daysText:      { fontSize: Typography.size.xs, color: C.textSecondary, marginBottom: Spacing.sm },

    remActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    takenBtn:    { flex: 1, backgroundColor: C.blueLight, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
    takenBtnDone:{ backgroundColor: C.successLight },
    takenBtnText:{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.blue },
    actionBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCardAlt, alignItems: 'center', justifyContent: 'center' },
    deleteBtnBg: { backgroundColor: C.dangerLight },

    fab: {
      position: 'absolute', bottom: 24, right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', ...Shadow.card,
    },
    fabText: { fontSize: 28, color: C.white, lineHeight: 32 },
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const t          = useT();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);

  const notifications = useAppStore(state => state.notifications);
  const reminders     = useAppStore(state => state.reminders);
  const markRead      = useAppStore(state => state.markNotificationRead);
  const markAll       = useAppStore(state => state.markAllNotificationsRead);
  const dismiss       = useAppStore(state => state.dismissNotification);
  const markTaken     = useAppStore(state => state.markReminderTaken);
  const deleteRem     = useAppStore(state => state.deleteReminder);
  const updateRem     = useAppStore(state => state.updateReminder);

  const [tab,   setTab]   = useState<'alerts' | 'reminders'>('alerts');
  const [query, setQuery] = useState('');

  const unread = notifications.filter(n => !n.isRead).length;

  const filteredNotifs = useMemo(() => {
    if (!query.trim()) return notifications;
    const q = query.toLowerCase();
    return notifications.filter(
      n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [notifications, query]);

  const sortedReminders = useMemo(
    () => [...reminders].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (a.times[0] ?? '').localeCompare(b.times[0] ?? '');
    }),
    [reminders],
  );

  // Dot colours — semantic, not theme-dependent
  const DOT_COLORS: Record<NotificationType, string> = {
    expired:             '#FF7575',
    expiring_soon:       '#FFCF47',
    low_stock:           '#FFCF47',
    interaction_warning: '#FF7575',
    kit_update:          '#78A9FF',
  };
  const TYPE_EMOJI: Record<NotificationType, string> = {
    expired:             '🔴',
    expiring_soon:       '🟡',
    low_stock:           '📦',
    interaction_warning: '⚠️',
    kit_update:          '🔄',
  };

  function handleTaken(r: MedicineReminder) {
    if (isTakenToday(r)) return;
    Alert.alert(
      r.medicineName,
      `Отметить приём ${r.pillCount} шт. и уменьшить запас?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: '✅ Принято', onPress: () => markTaken(r.id) },
      ],
    );
  }

  function handleDeleteReminder(r: MedicineReminder) {
    Alert.alert('Удалить напоминание?', r.medicineName, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteRem(r.id) },
    ]);
  }

  function renderNotif({ item }: { item: AppNotification }) {
    const dotColor = DOT_COLORS[item.type] ?? '#78A9FF';
    const emoji    = TYPE_EMOJI[item.type]  ?? '🔄';
    return (
      <TouchableOpacity
        style={[s.card, item.isRead && s.cardRead]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.85}
      >
        <View style={[s.dot, { backgroundColor: dotColor, opacity: item.isRead ? 0.3 : 1 }]} />
        <View style={s.body}>
          <Text style={[s.notifTitle, item.isRead && s.notifTitleRead]}>
            {emoji} {item.title}
          </Text>
          <Text style={s.notifSub}>{item.body}</Text>
        </View>
        <View style={s.right}>
          <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
          <TouchableOpacity onPress={() => dismiss(item.id)} hitSlop={8}>
            <Text style={s.dismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  function renderReminder({ item: r }: { item: MedicineReminder }) {
    const taken = isTakenToday(r);
    return (
      <View style={[s.remCard, !r.isActive && s.remCardInactive]}>
        <View style={s.remHeader}>
          <View style={s.remInfo}>
            <Text style={s.remName}>{r.medicineName}</Text>
            <Text style={s.remKit}>🏠 {r.kitName}</Text>
          </View>
          <View style={s.remBadge}>
            <Text style={[s.remBadgeText, r.isActive ? s.remBadgeActive : s.remBadgeInactive]}>
              {r.isActive ? t('reminder_active') : t('reminder_paused')}
            </Text>
          </View>
        </View>

        <View style={s.timesRow}>
          {r.times.map((time, i) => (
            <View key={i} style={[s.timeBubble, taken && s.timeBubbleTaken]}>
              <Text style={[s.timeBubbleText, taken && s.timeBubbleTextTaken]}>🕐 {time}</Text>
            </View>
          ))}
          <Text style={s.pillCountText}>{r.pillCount} шт</Text>
        </View>

        {r.daysOfWeek.length > 0 && (
          <Text style={s.daysText}>
            {['Вс','Пн','Вт','Ср','Чт','Пт','Сб'].filter((_, i) => r.daysOfWeek.includes(i)).join(', ')}
          </Text>
        )}

        <View style={s.remActions}>
          <TouchableOpacity
            style={[s.takenBtn, taken && s.takenBtnDone]}
            onPress={() => handleTaken(r)}
            activeOpacity={0.8}
          >
            <Text style={s.takenBtnText}>{taken ? t('taken_today') : t('mark_taken')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => navigation.navigate('CreateReminder', { reminderId: r.id })}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => updateRem(r.id, { isActive: !r.isActive })}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>{r.isActive ? '⏸' : '▶️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, s.deleteBtnBg]}
            onPress={() => handleDeleteReminder(r)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>
          {tab === 'alerts' ? '🔔 Уведомления' : '💊 Напоминания'}
        </Text>
        {tab === 'alerts' && unread > 0 && (
          <TouchableOpacity onPress={markAll}>
            <Text style={s.markAll}>{t('mark_all_read')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segment tabs */}
      <View style={s.segmentRow}>
        <TouchableOpacity
          style={[s.seg, tab === 'alerts' && s.segActive]}
          onPress={() => setTab('alerts')}
          activeOpacity={0.8}
        >
          <Text style={[s.segText, tab === 'alerts' && s.segTextActive]}>
            {t('tab_alerts')}{unread > 0 ? ` (${unread})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.seg, tab === 'reminders' && s.segActive]}
          onPress={() => setTab('reminders')}
          activeOpacity={0.8}
        >
          <Text style={[s.segText, tab === 'reminders' && s.segTextActive]}>
            {t('tab_reminders')}{reminders.length > 0 ? ` (${reminders.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search (alerts only) */}
      {tab === 'alerts' && (
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder={t('search_ph')}
            placeholderTextColor={C.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={s.dismiss}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {tab === 'alerts' ? (
        <FlatList
          data={filteredNotifs}
          keyExtractor={n => n.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              kitten="sleeping"
              title={t('no_notifications')}
              subtitle={t('no_notifications_sub')}
            />
          }
          renderItem={renderNotif}
        />
      ) : (
        <FlatList
          data={sortedReminders}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              kitten="pill"
              title={t('no_reminders')}
              subtitle={t('no_reminders_sub')}
              actionLabel={t('add_reminder')}
              onAction={() => navigation.navigate('CreateReminder', {})}
            />
          }
          renderItem={renderReminder}
        />
      )}

      {tab === 'reminders' && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => navigation.navigate('CreateReminder', {})}
          activeOpacity={0.85}
        >
          <Text style={s.fabText}>＋</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
