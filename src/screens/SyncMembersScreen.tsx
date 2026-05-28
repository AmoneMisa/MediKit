import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  Share,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import type { KitAccessRole, KitMember } from '../types';

const ROLE_LABELS: Record<KitAccessRole, string> = {
  owner:  'Владелец',
  editor: 'Редактор',
  viewer: 'Просмотр',
  synced: 'Полный синк',
};

const ROLE_COLORS: Record<KitAccessRole, { bg: string; text: string }> = {
  owner:  { bg: Colors.blueLight,   text: Colors.blueDark     },
  editor: { bg: Colors.successLight, text: Colors.successDark  },
  viewer: { bg: Colors.bgCardAlt,   text: Colors.textSecondary },
  synced: { bg: '#E8F5FF',          text: '#0A6EBD'            },
};

export function SyncMembersScreen() {
  const route = useRoute<any>();
  const { kitId } = route.params;

  const kit       = useAppStore(s => s.getKit(kitId));
  const updateKit = useAppStore(s => s.updateKit);
  const user      = useAppStore(s => s.user);

  const [inviteEmail, setInviteEmail] = useState('');

  if (!kit) return null;

  const isOwner = kit.ownerId === user.id;

  function handleRoleChange(member: KitMember) {
    if (!isOwner || member.userId === user.id) return;
    const roles: KitAccessRole[] = ['viewer', 'editor', 'synced'];
    const currentIdx = roles.indexOf(member.role);
    const nextRole = roles[(currentIdx + 1) % roles.length];

    Alert.alert(
      'Изменить роль',
      `Назначить «${member.name}» роль: ${ROLE_LABELS[nextRole]}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Изменить',
          onPress: () => {
            const newMembers = kit.members.map(m =>
              m.userId === member.userId ? { ...m, role: nextRole } : m,
            );
            updateKit(kitId, { members: newMembers });
          },
        },
      ],
    );
  }

  function handleRevoke(member: KitMember) {
    Alert.alert(
      'Удалить участника',
      `Убрать «${member.name}» из аптечки?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            const newMembers = kit.members.filter(m => m.userId !== member.userId);
            updateKit(kitId, { members: newMembers });
          },
        },
      ],
    );
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const link = `https://medikit.app/invite/${kitId}?email=${encodeURIComponent(inviteEmail)}`;
    await Share.share({ message: `Приглашение в аптечку «${kit.name}»: ${link}` });
    setInviteEmail('');
  }

  return (
    <SafeAreaView style={s.root}>
      <FlatList
        data={kit.members}
        keyExtractor={m => m.userId}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            {/* Info banner */}
            <View style={s.infoBanner}>
              <Text style={s.infoText}>
                🔄 Участники с полным синком видят все изменения в реальном времени
              </Text>
            </View>

            {/* Invite row */}
            {isOwner && (
              <View style={s.inviteCard}>
                <Text style={s.inviteTitle}>Пригласить участника</Text>
                <View style={s.inviteRow}>
                  <TextInput
                    style={s.inviteInput}
                    placeholder="email@example.com"
                    placeholderTextColor={Colors.textTertiary}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={s.inviteBtn} onPress={handleInvite} activeOpacity={0.85}>
                    <Text style={s.inviteBtnText}>↗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={s.sectionTitle}>
              Участники ({kit.members.length})
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const roleCfg   = ROLE_COLORS[item.role];
          const canManage = isOwner && item.userId !== user.id;

          return (
            <View style={s.memberCard}>
              <View style={s.memberAvatar}>
                <Text style={s.memberInitials}>{item.avatarInitials}</Text>
              </View>

              <View style={s.memberInfo}>
                <Text style={s.memberName}>{item.name}</Text>
                <View style={s.memberStatusRow}>
                  <View style={[s.syncDot, {
                    backgroundColor:
                      item.syncStatus === 'active'      ? Colors.success :
                      item.syncStatus === 'pending'     ? Colors.warning :
                      item.syncStatus === 'failed'      ? Colors.danger  : Colors.textTertiary,
                  }]} />
                  <Text style={s.memberSub}>
                    {item.syncStatus === 'active'       ? 'Активен' :
                     item.syncStatus === 'pending'      ? 'Ожидает принятия' :
                     item.syncStatus === 'disconnected' ? 'Отключён' : 'Ошибка'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.rolePill, { backgroundColor: roleCfg.bg }]}
                onPress={() => handleRoleChange(item)}
                disabled={!canManage}
                activeOpacity={0.8}
              >
                <Text style={[s.roleText, { color: roleCfg.text }]}>
                  {ROLE_LABELS[item.role]}
                </Text>
              </TouchableOpacity>

              {canManage && (
                <TouchableOpacity onPress={() => handleRevoke(item)} hitSlop={8}>
                  <Text style={{ fontSize: 18, color: Colors.textTertiary }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={s.legend}>
            <Text style={s.legendTitle}>Уровни доступа</Text>
            {(Object.entries(ROLE_LABELS) as [KitAccessRole, string][]).map(([role, label]) => (
              <View key={role} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: ROLE_COLORS[role].bg }]} />
                <Text style={s.legendLabel}>
                  <Text style={{ fontWeight: '700' }}>{label}</Text>
                  {role === 'viewer'  ? ' — только просмотр' :
                   role === 'editor'  ? ' — может добавлять и редактировать' :
                   role === 'synced'  ? ' — полная синхронизация в реальном времени' :
                   ' — полный контроль'}
                </Text>
              </View>
            ))}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  list:   { padding: Spacing.lg, paddingBottom: 40 },

  infoBanner: {
    backgroundColor: Colors.blueLight, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  infoText: { fontSize: Typography.size.body, color: Colors.blueDark, fontWeight: '600' },

  inviteCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadow.card,
  },
  inviteTitle: {
    fontSize: Typography.size.body, fontWeight: Typography.weight.bold,
    color: Colors.textSecondary, marginBottom: Spacing.sm,
  },
  inviteRow: { flexDirection: 'row', gap: Spacing.sm },
  inviteInput: {
    flex: 1, height: 44, backgroundColor: Colors.bgCardAlt,
    borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, fontSize: Typography.size.md,
    color: Colors.textPrimary,
  },
  inviteBtn: {
    width: 44, height: 44, borderRadius: Radius.sm,
    backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
  },
  inviteBtnText: { fontSize: 20, color: Colors.white, fontWeight: '700' },

  sectionTitle: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm,
  },

  memberCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    ...Shadow.card,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
  },
  memberInitials: { fontSize: Typography.size.body, fontWeight: '800', color: Colors.white },
  memberInfo: { flex: 1 },
  memberName: {
    fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary,
  },
  memberStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  memberSub: { fontSize: Typography.size.xs, color: Colors.textSecondary },
  rolePill: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  roleText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },

  legend: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.lg, marginTop: Spacing.lg, ...Shadow.card,
  },
  legendTitle: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.md,
  },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  legendLabel: { flex: 1, fontSize: Typography.size.body, color: Colors.textPrimary, lineHeight: 20 },
});
