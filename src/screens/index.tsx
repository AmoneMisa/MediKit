// ────────────────────────────────────────────────────────────────────────────
//  ShareKitScreen
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Share,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import type { KitAccessRole } from '../types';

export function ShareKitScreen() {
  const route = useRoute<any>();
  const { kitId } = route.params;
  const kit = useAppStore(s => s.getKit(kitId));
  const [role, setRole] = useState<KitAccessRole>('viewer');

  if (!kit) return null;

  async function handleShare(channel: string) {
    const msg =
      `📦 Аптечка «${kit!.name}» — ${kit!.members.length > 1 ? 'Общая' : 'Личная'}\n` +
      `Присоединиться: https://medikit.app/kit/${kitId}`;
    await Share.share({ message: msg });
  }

  const ACCESS_LEVELS: { role: KitAccessRole; emoji: string; title: string; desc: string }[] = [
    { role: 'viewer', emoji: '👁',  title: 'Только просмотр',      desc: 'Видит список, не может редактировать' },
    { role: 'editor', emoji: '✏️', title: 'Редактор',              desc: 'Может добавлять и изменять препараты' },
    { role: 'synced', emoji: '🔄', title: 'Полная синхронизация',  desc: 'Видит все изменения в реальном времени' },
  ];

  return (
    <SafeAreaView style={ss.root}>
      <ScrollView contentContainerStyle={ss.scroll}>
        {/* QR block */}
        <View style={ss.qrBlock}>
          <View style={ss.qrPlaceholder}>
            <Text style={ss.qrText}>QR-код{'\n'}аптечки</Text>
          </View>
          <Text style={ss.kitName}>Аптечка «{kit.name}»</Text>
          <Text style={ss.kitSub}>
            {kit.members.length} участник{kit.members.length > 1 ? 'а' : ''}
          </Text>
        </View>

        {/* Share buttons */}
        <ShareBtn emoji="✈️" label="Отправить в Telegram"  bg="#29B6F6" onPress={() => handleShare('tg')} />
        <ShareBtn emoji="💬" label="Отправить в WhatsApp"  bg="#25D366" onPress={() => handleShare('wa')} />
        <ShareBtn emoji="🔗" label="Скопировать ссылку"   bg={Colors.bgCardAlt} textColor={Colors.blue} onPress={() => handleShare('copy')} />

        {/* Access level */}
        <View style={ss.card}>
          <Text style={ss.cardTitle}>Уровень доступа</Text>
          {ACCESS_LEVELS.map(a => (
            <TouchableOpacity
              key={a.role}
              style={ss.accessRow}
              onPress={() => setRole(a.role)}
              activeOpacity={0.8}
            >
              <View style={ss.accessAvatar}>
                <Text style={{ fontSize: 16 }}>{a.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.accessName}>{a.title}</Text>
                <Text style={ss.accessDesc}>{a.desc}</Text>
              </View>
              <View style={[ss.radio, role === a.role && ss.radioActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Members */}
        <View style={ss.card}>
          <Text style={ss.cardTitle}>Участники ({kit.members.length})</Text>
          {kit.members.map(m => (
            <View key={m.userId} style={ss.memberRow}>
              <View style={ss.memberAvatar}>
                <Text style={ss.memberInitials}>{m.avatarInitials}</Text>
              </View>
              <Text style={ss.memberName}>{m.name}</Text>
              <View style={[ss.rolePill, { backgroundColor: m.role === 'owner' ? Colors.blueLight : Colors.successLight }]}>
                <Text style={[ss.roleText, { color: m.role === 'owner' ? Colors.blueDark : Colors.successDark }]}>
                  {roleLabel(m.role)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShareBtn({ emoji, label, bg, textColor = '#fff', onPress }: any) {
  return (
    <TouchableOpacity style={[ss.shareBtn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[ss.shareBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function roleLabel(r: KitAccessRole) {
  return { owner: 'Владелец', editor: 'Редактор', viewer: 'Просмотр', synced: 'Синк' }[r];
}

const ss = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  qrBlock: {
    backgroundColor: Colors.blueLight, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg,
  },
  qrPlaceholder: {
    width: 130, height: 130, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, borderWidth: 2, borderStyle: 'dashed',
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  qrText: { fontSize: Typography.size.xs, color: Colors.textTertiary, fontWeight: '700', textAlign: 'center' },
  kitName: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary },
  kitSub:  { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 4 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  shareBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.lg, marginTop: Spacing.sm, ...Shadow.card,
  },
  cardTitle: {
    fontSize: Typography.size.sm, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.md,
  },
  accessRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  accessAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bgCardAlt, alignItems: 'center', justifyContent: 'center',
  },
  accessName: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  accessDesc: { fontSize: Typography.size.xs, color: Colors.textSecondary },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
  },
  radioActive: { borderColor: Colors.blue, backgroundColor: Colors.blue },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center',
  },
  memberInitials: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.white },
  memberName: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  rolePill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill },
  roleText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },
});


// ────────────────────────────────────────────────────────────────────────────
//  ProfileScreen
// ────────────────────────────────────────────────────────────────────────────
export function ProfileScreen() {
  const user = useAppStore(s => s.user);
  const kits = useAppStore(s => s.kits);

  const ITEMS = [
    { emoji: '🏠', label: `Мои аптечки (${kits.length})`,   screen: 'KitList' },
    { emoji: '👥', label: 'Общий доступ',                    screen: 'SyncMembers' },
    { emoji: '🔔', label: 'Уведомления',                     screen: 'Settings' },
    { emoji: '⚙️', label: 'Настройки',                      screen: 'Settings' },
    { emoji: '❓', label: 'Помощь и поддержка',              screen: 'Support' },
  ];

  return (
    <SafeAreaView style={ps.root}>
      <ScrollView contentContainerStyle={ps.scroll}>
        {/* Hero */}
        <View style={ps.hero}>
          <View style={ps.avatar}>
            <Text style={ps.avatarText}>{user.avatarInitials}</Text>
          </View>
          <View>
            <Text style={ps.name}>{user.name}</Text>
            <Text style={ps.email}>{user.email}</Text>
          </View>
        </View>

        {/* Items */}
        <View style={ps.group}>
          {ITEMS.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity style={ps.item} activeOpacity={0.8}>
                <Text style={ps.itemEmoji}>{item.emoji}</Text>
                <Text style={ps.itemLabel}>{item.label}</Text>
                <Text style={ps.chevron}>›</Text>
              </TouchableOpacity>
              {i < ITEMS.length - 1 && <View style={ps.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={ps.signout}>
          <Text style={ps.signoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    backgroundColor: Colors.blue, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.lg,
  },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: Colors.blue },
  name:  { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.white },
  email: { fontSize: Typography.size.body, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  group: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    marginBottom: Spacing.md, ...Shadow.card, overflow: 'hidden',
  },
  item:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  itemEmoji: { fontSize: 18, width: 26, textAlign: 'center' },
  itemLabel: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  chevron:   { fontSize: 18, color: Colors.textTertiary },
  divider:   { height: 1, backgroundColor: Colors.borderLight, marginLeft: 58 },
  signout: { padding: Spacing.lg, alignItems: 'center' },
  signoutText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.danger },
});


// ────────────────────────────────────────────────────────────────────────────
//  SettingsScreen
// ────────────────────────────────────────────────────────────────────────────
export function SettingsScreen() {
  const settings = useAppStore(s => s.settings);
  const update   = useAppStore(s => s.updateSettings);

  function toggle(key: 'pushEnabled' | 'lowStockEnabled' | 'kitActivityEnabled' | 'interactionWarningsEnabled') {
    update({
      reminders: {
        ...settings.reminders,
        [key]: !settings.reminders[key],
      },
    });
  }

  return (
    <SafeAreaView style={stl.root}>
      <ScrollView contentContainerStyle={stl.scroll}>
        <SettingGroup title="Уведомления">
          <SettingToggle
            emoji="🔔" label="Push-уведомления"
            value={settings.reminders.pushEnabled}
            onToggle={() => toggle('pushEnabled')}
          />
          <SettingToggle
            emoji="📦" label="Предупреждение о запасах"
            value={settings.reminders.lowStockEnabled}
            onToggle={() => toggle('lowStockEnabled')}
          />
          <SettingToggle
            emoji="👥" label="Активность в общих аптечках"
            value={settings.reminders.kitActivityEnabled}
            onToggle={() => toggle('kitActivityEnabled')}
          />
          <SettingToggle
            emoji="⚠️" label="Предупреждения о совместимости"
            value={settings.reminders.interactionWarningsEnabled}
            onToggle={() => toggle('interactionWarningsEnabled')}
          />
        </SettingGroup>

        <SettingGroup title="Напоминать за">
          {[90, 30, 7].map(d => (
            <View key={d} style={stl.item}>
              <Text style={stl.itemEmoji}>📅</Text>
              <Text style={stl.itemLabel}>{d} дней до истечения</Text>
              <View style={[stl.dot, { backgroundColor: settings.reminders.expiryDaysBefore.includes(d) ? Colors.success : Colors.border }]} />
            </View>
          ))}
        </SettingGroup>

        <SettingGroup title="Внешний вид">
          {(['light','dark','pastel'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={stl.item}
              onPress={() => update({ theme: t })}
            >
              <Text style={stl.itemEmoji}>
                {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌸'}
              </Text>
              <Text style={stl.itemLabel}>
                {t === 'light' ? 'Светлая' : t === 'dark' ? 'Тёмная' : 'Пастель'}
              </Text>
              {settings.theme === t && <Text style={{ color: Colors.success, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </SettingGroup>

        <SettingGroup title="Данные">
          <TouchableOpacity style={stl.item}>
            <Text style={stl.itemEmoji}>📤</Text>
            <Text style={stl.itemLabel}>Экспортировать данные</Text>
            <Text style={{ fontSize: 18, color: Colors.textTertiary }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={stl.item}>
            <Text style={stl.itemEmoji}>🗑️</Text>
            <Text style={[stl.itemLabel, { color: Colors.danger }]}>Удалить аккаунт</Text>
            <Text style={{ fontSize: 18, color: Colors.textTertiary }}>›</Text>
          </TouchableOpacity>
        </SettingGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={stl.groupTitle}>{title}</Text>
      <View style={stl.group}>{children}</View>
    </View>
  );
}

function SettingToggle({ emoji, label, value, onToggle }: { emoji: string; label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={stl.item} onPress={onToggle} activeOpacity={0.8}>
      <Text style={stl.itemEmoji}>{emoji}</Text>
      <Text style={stl.itemLabel}>{label}</Text>
      <View style={[stl.toggle, !value && stl.toggleOff]}>
        <View style={[stl.toggleThumb, value && stl.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const stl = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  groupTitle: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  group: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    overflow: 'hidden', ...Shadow.card,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  itemEmoji: { fontSize: 18, width: 26, textAlign: 'center' },
  itemLabel: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: Colors.success, justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOff: { backgroundColor: Colors.border },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
});


// ────────────────────────────────────────────────────────────────────────────
//  Stub screens (filled with placeholder UI)
// ────────────────────────────────────────────────────────────────────────────

function StubScreen({ title, emoji }: { title: string; emoji: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 52, marginBottom: 16 }}>{emoji}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.textPrimary }}>{title}</Text>
      <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 8 }}>Экран в разработке</Text>
    </SafeAreaView>
  );
}

export const OnboardingScreen    = () => <StubScreen emoji="💊" title="Добро пожаловать в MediKit" />;
export const ScanMedicineScreen  = () => <StubScreen emoji="📷" title="Сканирование" />;
export const ManualEntryScreen   = () => <StubScreen emoji="✏️" title="Ввод вручную" />;
export const ShareMedicineScreen = () => <StubScreen emoji="↗"  title="Поделиться препаратом" />;
export const InteractionScreen   = () => <StubScreen emoji="⚗️" title="Совместимость" />;
export const SyncMembersScreen   = () => <StubScreen emoji="👥" title="Участники" />;
export const ActivityHistoryScreen = () => <StubScreen emoji="📋" title="История изменений" />;
export const CreateEditKitScreen = () => <StubScreen emoji="🏡" title="Новая аптечка" />;
export const ReminderSettingsScreen = () => <StubScreen emoji="⏰" title="Напоминания" />;
export const SupportScreen       = () => <StubScreen emoji="❓" title="Помощь" />;
