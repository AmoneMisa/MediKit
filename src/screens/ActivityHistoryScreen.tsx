import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru, enUS, tr, ro } from 'date-fns/locale';
import { useAppStore } from '../store';

const DATE_LOCALES = { en: enUS, ru, tr, ro } as const;
import type { KitActivityEvent } from '../types';
import { ensureAuth, listActivity } from '../api';

type LabelFn = (e: KitActivityEvent, t: ReturnType<typeof useT>) => string;

const EVENT_CONFIG: Record<KitActivityEvent['type'], { icon: string; label: LabelFn }> = {
  medicine_added:   { icon: 'plus-circle',      label: (e, t) => t('ah_medicine_added').replace('{name}', e.medicineName ?? '') },
  medicine_removed: { icon: 'trash-can',         label: (e, t) => t('ah_medicine_removed').replace('{name}', e.medicineName ?? '') },
  quantity_changed: { icon: 'package-variant',   label: (e, t) => t('ah_quantity_changed').replace('{name}', e.medicineName ? `«${e.medicineName}»` : '').replace('{detail}', e.detail ?? '') },
  expiry_updated:   { icon: 'calendar',          label: (e, t) => t('ah_expiry_updated').replace('{name}', e.medicineName ?? '') },
  member_joined:    { icon: 'hand-wave',         label: (_e, t) => t('ah_member_joined') },
  member_left:      { icon: 'door',              label: (_e, t) => t('ah_member_left') },
  share_created:    { icon: 'share',             label: (_e, t) => t('ah_share_created') },
};

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    list:   { padding: Spacing.lg, paddingBottom: 100 },
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
  const t = useT();
  const lang = useAppStore(state => state.settings.language);

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
    const timeAgo = formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true, locale: DATE_LOCALES[lang] ?? enUS });

    return (
      <View style={s.row}>
        <View style={s.timelineLeft}>
          <View style={s.emojiCircle}>
            <Icon name={cfg.icon} size={16} color={C.textSecondary} />
          </View>
          <View style={s.line} />
        </View>
        <View style={s.content}>
          <Text style={s.actor}>{item.userName}</Text>
          <Text style={s.action}>{cfg.label(item, t)}</Text>
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
              <Icon name="clipboard-list" size={40} color={C.textTertiary} style={{ marginBottom: 12 }} />
              <Text style={s.emptyTitle}>{t('ah_no_history')}</Text>
            </View>
          )
        }
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}
