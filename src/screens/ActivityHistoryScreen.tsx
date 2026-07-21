import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { KitActivityEvent } from '../types';
import { ensureAuth, listActivity } from '../api';

const EVENT_CONFIG: Record<KitActivityEvent['type'], { emoji: string; label: (e: KitActivityEvent) => string }> = {
  medicine_added:   { emoji: '➕', label: e => `Добавил(а) «${e.medicineName}»` },
  medicine_removed: { emoji: '🗑️', label: e => `Удалил(а) «${e.medicineName}»` },
  quantity_changed: { emoji: '📦', label: e => `Изменил(а) количество ${e.medicineName ? `«${e.medicineName}»` : ''} ${e.detail ?? ''}` },
  expiry_updated:   { emoji: '📅', label: e => `Обновил(а) срок годности «${e.medicineName}»` },
  member_joined:    { emoji: '👋', label: () => 'Присоединился(-ась) к аптечке' },
  member_left:      { emoji: '🚪', label: () => 'Покинул(а) аптечку' },
  share_created:    { emoji: '↗',  label: () => 'Создал(а) ссылку для приглашения' },
};

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    list:   { padding: Spacing.lg, paddingBottom: 40 },
    row:    { flexDirection: 'row', marginBottom: Spacing.md },
    timelineLeft: { alignItems: 'center', marginRight: Spacing.md, width: 40 },
    emojiCircle: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
    },
    line:    { flex: 1, width: 2, backgroundColor: C.borderLight, marginTop: 4 },
    content: {
      flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: Spacing.md, ...Shadow.sm,
    },
    actor:   { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textPrimary },
    action:  { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },
    time:    { fontSize: Typography.size.xs, color: C.textTertiary, marginTop: 6 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  });
}

export function ActivityHistoryScreen() {
  const route = useRoute<any>();
  const kitId: string = route.params?.kitId;
  const [events, setEvents] = useState<KitActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureAuth();
        const rows = await listActivity(kitId);
        if (alive) setEvents(rows);
      } catch {
        // Kit not yet synced to the server (offline-first) — show empty state.
        if (alive) setEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kitId]);

  function renderItem({ item }: { item: KitActivityEvent }) {
    const cfg     = EVENT_CONFIG[item.type];
    const timeAgo = formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true, locale: ru });

    return (
      <View style={s.row}>
        <View style={s.timelineLeft}>
          <View style={s.emojiCircle}>
            <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
          </View>
          <View style={s.line} />
        </View>
        <View style={s.content}>
          <Text style={s.actor}>{item.userName}</Text>
          <Text style={s.action}>{cfg.label(item)}</Text>
          <Text style={s.time}>{timeAgo}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <FlatList
        data={events}
        keyExtractor={e => e.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <ActivityIndicator color={C.blue} />
            </View>
          ) : (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
              <Text style={s.emptyTitle}>Нет истории изменений</Text>
            </View>
          )
        }
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}
