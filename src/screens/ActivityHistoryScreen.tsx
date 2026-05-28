import React from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { KitActivityEvent } from '../types';

const EVENT_CONFIG: Record<KitActivityEvent['type'], { emoji: string; label: (e: KitActivityEvent) => string }> = {
  medicine_added:   { emoji: '➕', label: e => `Добавил(а) «${e.medicineName}»` },
  medicine_removed: { emoji: '🗑️', label: e => `Удалил(а) «${e.medicineName}»` },
  quantity_changed: { emoji: '📦', label: e => `Изменил(а) количество ${e.medicineName ? `«${e.medicineName}»` : ''} ${e.detail ?? ''}` },
  expiry_updated:   { emoji: '📅', label: e => `Обновил(а) срок годности «${e.medicineName}»` },
  member_joined:    { emoji: '👋', label: () => 'Присоединился(-ась) к аптечке' },
  member_left:      { emoji: '🚪', label: () => 'Покинул(а) аптечку' },
  share_created:    { emoji: '↗',  label: () => 'Создал(а) ссылку для приглашения' },
};

export function ActivityHistoryScreen() {
  const route  = useRoute<any>();
  const kitId: string = route.params?.kitId;
  const events: KitActivityEvent[] = [];

  function renderItem({ item }: { item: KitActivityEvent }) {
    const cfg    = EVENT_CONFIG[item.type];
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
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
              Нет истории изменений
            </Text>
          </View>
        }
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  list:   { padding: Spacing.lg, paddingBottom: 40 },
  row:    { flexDirection: 'row', marginBottom: Spacing.md },
  timelineLeft: { alignItems: 'center', marginRight: Spacing.md, width: 40 },
  emojiCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  line: { flex: 1, width: 2, backgroundColor: Colors.borderLight, marginTop: 4 },
  content: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  actor:  { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  action: { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 2 },
  time:   { fontSize: Typography.size.xs, color: Colors.textTertiary, marginTop: 6 },
});
