import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, TextInput, Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import type { KitAccessRole, KitMember } from '../types';

const ROLE_LABELS: Record<KitAccessRole, string> = {
  owner:  'Владелец',
  editor: 'Редактор',
  viewer: 'Просмотр',
  synced: 'Полный синк',
};

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bgPage },
    list: { padding: Spacing.lg, paddingBottom: 40 },

    infoBanner: { backgroundColor: C.blueLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
    infoText:   { fontSize: Typography.size.body, color: C.blueDark, fontWeight: '600' },

    inviteCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadow.card,
    },
    inviteTitle: {
      fontSize: Typography.size.body, fontWeight: Typography.weight.bold,
      color: C.textSecondary, marginBottom: Spacing.sm,
    },
    inviteRow:  { flexDirection: 'row', gap: Spacing.sm },
    inviteInput: {
      flex: 1, height: 44, backgroundColor: C.bgCardAlt,
      borderRadius: Radius.sm, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, fontSize: Typography.size.md, color: C.textPrimary,
      textAlignVertical: 'center',
    },
    inviteBtn: {
      width: 44, height: 44, borderRadius: Radius.sm,
      backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
    },

    sectionTitle: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: Spacing.sm,
    },

    memberCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    memberAvatar:   { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
    memberInitials: { fontSize: Typography.size.body, fontWeight: '800', color: C.white },
    memberInfo:     { flex: 1 },
    memberName:     { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },
    memberStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    syncDot:        { width: 7, height: 7, borderRadius: 4 },
    memberSub:      { fontSize: Typography.size.xs, color: C.textSecondary },
    rolePill:       { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
    roleText:       { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },

    legend: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginTop: Spacing.lg, ...Shadow.card,
    },
    legendTitle: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: Spacing.md,
    },
    legendRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
    legendDot:   { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
    legendLabel: { flex: 1, fontSize: Typography.size.body, color: C.textPrimary, lineHeight: 20 },
  });
}

export function SyncMembersScreen() {
  const route = useRoute<any>();
  const { kitId } = route.params;
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  // Role colours defined inside component so they use current theme
  const ROLE_COLORS: Record<KitAccessRole, { bg: string; text: string }> = useMemo(() => ({
    owner:  { bg: C.blueLight,    text: C.blueDark      },
    editor: { bg: C.successLight, text: C.successDark   },
    viewer: { bg: C.bgCardAlt,    text: C.textSecondary },
    synced: { bg: '#E8F5FF',      text: '#0A6EBD'       },
  }), [C]);

  const kit       = useAppStore(st => st.getKit(kitId));
  const updateKit = useAppStore(st => st.updateKit);
  const user      = useAppStore(st => st.user);

  const [inviteEmail, setInviteEmail] = useState('');

  if (!kit) return null;

  const isOwner = kit.ownerId === user.id;

  function handleRoleChange(member: KitMember) {
    if (!isOwner || member.userId === user.id) return;
    const roles: KitAccessRole[] = ['viewer', 'editor', 'synced'];
    const currentIdx = roles.indexOf(member.role);
    const nextRole   = roles[(currentIdx + 1) % roles.length];
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
          text: 'Удалить', style: 'destructive',
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
            <View style={s.infoBanner}>
              <Text style={s.infoText}>
                🔄 Участники с полным синком видят все изменения в реальном времени
              </Text>
            </View>

            {isOwner && (
              <View style={s.inviteCard}>
                <Text style={s.inviteTitle}>Пригласить участника</Text>
                <View style={s.inviteRow}>
                  <TextInput
                    style={s.inviteInput}
                    placeholder="email@example.com"
                    placeholderTextColor={C.textTertiary}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={s.inviteBtn} onPress={handleInvite} activeOpacity={0.85}>
                    <Icon name="send" size={20} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={s.sectionTitle}>Участники ({kit.members.length})</Text>
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
                      item.syncStatus === 'active'  ? C.success :
                      item.syncStatus === 'pending' ? C.warning :
                      item.syncStatus === 'failed'  ? C.danger  : C.textTertiary,
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
                  <Icon name="close" size={18} color={C.textTertiary} />
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
                  {role === 'viewer' ? ' — только просмотр' :
                   role === 'editor' ? ' — может добавлять и редактировать' :
                   role === 'synced' ? ' — полная синхронизация в реальном времени' :
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
