// ────────────────────────────────────────────────────────────────────────────
//  ShareKitScreen
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import type { KitAccessRole } from '../types';
import { useT } from '../i18n';
import { useColors, useGradient } from '../context/ThemeContext';

export function ShareKitScreen() {
  const t = useT();
  const route = useRoute<any>();
  const { kitId } = route.params;
  const kit = useAppStore(s => s.getKit(kitId));
  const [role, setRole] = useState<KitAccessRole>('viewer');

  if (!kit) return null;

  async function handleShare(channel: string) {
    const msg =
      `📦 ${t('sc_kit_word')} «${kit!.name}» — ${kit!.members.length > 1 ? t('sc_kit_shared') : t('sc_kit_personal')}\n` +
      `${t('sc_join')}: https://medikit.app/kit/${kitId}`;
    await Share.share({ message: msg });
  }

  const ACCESS_LEVELS: { role: KitAccessRole; icon: string; title: string; desc: string }[] = [
    { role: 'viewer', icon: 'eye',    title: t('sc_access_viewer_title'), desc: t('sc_access_viewer_desc') },
    { role: 'editor', icon: 'pencil', title: t('sc_access_editor_title'), desc: t('sc_access_editor_desc') },
    { role: 'synced', icon: 'sync',   title: t('sc_access_synced_title'), desc: t('sc_access_synced_desc') },
  ];

  return (
    <SafeAreaView style={ss.root}>
      <ScrollView contentContainerStyle={ss.scroll}>
        {/* QR block */}
        <View style={ss.qrBlock}>
          <View style={ss.qrPlaceholder}>
            <Text style={ss.qrText}>{t('sc_qr_code')}{'\n'}{t('sc_qr_of_kit')}</Text>
          </View>
          <Text style={ss.kitName}>{t('sc_kit_word')} «{kit.name}»</Text>
          <Text style={ss.kitSub}>
            {kit.members.length} {t('sc_participants')}
          </Text>
        </View>

        {/* Share buttons */}
        <ShareBtn iconName="send"    label={t('share_telegram')}  bg="#29B6F6" onPress={() => handleShare('tg')} />
        <ShareBtn iconName="message" label={t('share_whatsapp')}  bg="#25D366" onPress={() => handleShare('wa')} />
        <ShareBtn iconName="link"    label={t('copy_link')}   bg={Colors.bgCardAlt} textColor={Colors.blue} onPress={() => handleShare('copy')} />

        {/* Access level */}
        <View style={ss.card}>
          <Text style={ss.cardTitle}>{t('sc_access_level')}</Text>
          {ACCESS_LEVELS.map(a => (
            <TouchableOpacity
              key={a.role}
              style={ss.accessRow}
              onPress={() => setRole(a.role)}
              activeOpacity={0.8}
            >
              <View style={ss.accessAvatar}>
                <Icon name={a.icon} size={16} color={Colors.textSecondary} />
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
          <Text style={ss.cardTitle}>{t('members')} ({kit.members.length})</Text>
          {kit.members.map(m => (
            <View key={m.userId} style={ss.memberRow}>
              <View style={ss.memberAvatar}>
                <Text style={ss.memberInitials}>{m.avatarInitials}</Text>
              </View>
              <Text style={ss.memberName}>{m.name}</Text>
              <View style={[ss.rolePill, { backgroundColor: m.role === 'owner' ? Colors.blueLight : Colors.successLight }]}>
                <Text style={[ss.roleText, { color: m.role === 'owner' ? Colors.blueDark : Colors.successDark }]}>
                  {roleLabel(m.role, t)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShareBtn({ iconName, label, bg, textColor = '#fff', onPress }: any) {
  return (
    <TouchableOpacity style={[ss.shareBtn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
      <Icon name={iconName} size={18} color={textColor} />
      <Text style={[ss.shareBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function roleLabel(r: KitAccessRole, t: (k: any) => string) {
  return {
    owner: t('sc_role_owner'),
    editor: t('sc_role_editor'),
    viewer: t('sc_role_viewer'),
    synced: t('sc_role_synced'),
  }[r];
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
  const t          = useT();
  const user       = useAppStore(s => s.user);
  const kits       = useAppStore(s => s.kits);
  const navigation = useNavigation<any>();
  const C          = useColors();
  const gradient   = useGradient();

  const ITEMS = [
    { icon: 'home',          label: `${t('sc_my_kits')} (${kits.length})`, onPress: () => navigation.navigate('KitsTab') },
    { icon: 'account-group', label: t('pf_contacts'),                       onPress: () => navigation.navigate('Persons') },
    { icon: 'calendar',      label: t('pf_expiry_dates'),                   onPress: () => navigation.navigate('Expiry') },
    { icon: 'cog',           label: t('settings'),                          onPress: () => navigation.navigate('Settings') },
    { icon: 'help-circle',   label: t('sc_help_support'),                   onPress: () => navigation.navigate('Support') },
  ];

  return (
    <SafeAreaView style={ps.root}>
      <ScrollView contentContainerStyle={ps.scroll}>
        {/* Hero */}
        {gradient.enabled ? (
          <LinearGradient
            colors={gradient.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={ps.hero}
          >
            <View style={[ps.avatar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={[ps.avatarText, { color: Colors.white }]}>{user.avatarInitials}</Text>
            </View>
            <View>
              <Text style={ps.name}>{user.name}</Text>
              <Text style={ps.email}>{user.email}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={[ps.hero, { backgroundColor: C.blue }]}>
            <View style={ps.avatar}>
              <Text style={[ps.avatarText, { color: C.blue }]}>{user.avatarInitials}</Text>
            </View>
            <View>
              <Text style={ps.name}>{user.name}</Text>
              <Text style={ps.email}>{user.email}</Text>
            </View>
          </View>
        )}

        {/* Items */}
        <View style={ps.group}>
          {ITEMS.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity style={ps.item} activeOpacity={0.8} onPress={item.onPress}>
                <View style={ps.itemIcon}><Icon name={item.icon} size={18} color={Colors.textSecondary} /></View>
                <Text style={ps.itemLabel}>{item.label}</Text>
                <Text style={ps.chevron}>›</Text>
              </TouchableOpacity>
              {i < ITEMS.length - 1 && <View style={ps.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={ps.signout}>
          <Text style={ps.signoutText}>{t('sc_sign_out')}</Text>
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
    borderRadius: Radius.xl, overflow: 'hidden',
    padding: Spacing.lg, marginBottom: Spacing.lg,
  },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: Colors.white },
  name:  { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.white },
  email: { fontSize: Typography.size.body, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  group: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    marginBottom: Spacing.md, ...Shadow.card, overflow: 'hidden',
  },
  item:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  itemIcon: { width: 26, alignItems: 'center' },
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
  const t = useT();
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
        <SettingGroup title={t('notif_section')}>
          <SettingToggle
            icon="bell" label={t('push_enabled')}
            value={settings.reminders.pushEnabled}
            onToggle={() => toggle('pushEnabled')}
          />
          <SettingToggle
            icon="package-variant" label={t('low_stock_enabled')}
            value={settings.reminders.lowStockEnabled}
            onToggle={() => toggle('lowStockEnabled')}
          />
          <SettingToggle
            icon="account-group" label={t('kit_activity_enabled')}
            value={settings.reminders.kitActivityEnabled}
            onToggle={() => toggle('kitActivityEnabled')}
          />
          <SettingToggle
            icon="alert" label={t('interaction_warnings_enabled')}
            value={settings.reminders.interactionWarningsEnabled}
            onToggle={() => toggle('interactionWarningsEnabled')}
          />
        </SettingGroup>

        <SettingGroup title={t('sc_remind_before')}>
          {[90, 30, 7].map(d => (
            <View key={d} style={stl.item}>
              <View style={stl.itemIcon}><Icon name="calendar" size={18} color={Colors.textSecondary} /></View>
              <Text style={stl.itemLabel}>{d} {t('sc_days_before_expiry')}</Text>
              <View style={[stl.dot, { backgroundColor: settings.reminders.expiryDaysBefore.includes(d) ? Colors.success : Colors.border }]} />
            </View>
          ))}
        </SettingGroup>

        <SettingGroup title={t('sc_appearance')}>
          {([
            { key: 'light',  icon: 'weather-sunny' },
            { key: 'dark',   icon: 'weather-night' },
            { key: 'system', icon: 'cellphone' },
            { key: 'pastel', icon: 'flower' },
            { key: 'green',  icon: 'leaf' },
            { key: 'red',    icon: 'flower-tulip' },
            { key: 'mint',   icon: 'leaf-maple' },
          ] as const).map(th => (
            <TouchableOpacity
              key={th.key}
              style={stl.item}
              onPress={() => update({ theme: th.key })}
            >
              <View style={stl.itemIcon}><Icon name={th.icon} size={18} color={Colors.textSecondary} /></View>
              <Text style={stl.itemLabel}>{t(`theme_${th.key}` as any)}</Text>
              {settings.theme === th.key && <Icon name="check" size={18} color={Colors.success} />}
            </TouchableOpacity>
          ))}
        </SettingGroup>

        <SettingGroup title={t('sc_data')}>
          <TouchableOpacity style={stl.item}>
            <View style={stl.itemIcon}><Icon name="export-variant" size={18} color={Colors.textSecondary} /></View>
            <Text style={stl.itemLabel}>{t('sc_export_data')}</Text>
            <Text style={{ fontSize: 18, color: Colors.textTertiary }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={stl.item}>
            <View style={stl.itemIcon}><Icon name="trash-can" size={18} color={Colors.danger} /></View>
            <Text style={[stl.itemLabel, { color: Colors.danger }]}>{t('sc_delete_account')}</Text>
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

function SettingToggle({ icon, label, value, onToggle }: { icon: string; label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={stl.item} onPress={onToggle} activeOpacity={0.8}>
      <View style={stl.itemIcon}><Icon name={icon} size={18} color={Colors.textSecondary} /></View>
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
  itemIcon: { width: 26, alignItems: 'center' },
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

function StubScreen({ title, icon }: { title: string; icon: string }) {
  const t = useT();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={52} color={Colors.textTertiary} style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.textPrimary }}>{title}</Text>
      <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 8 }}>{t('sc_screen_in_dev')}</Text>
    </SafeAreaView>
  );
}

export const OnboardingScreen    = () => { const t = useT(); return <StubScreen icon="pill"            title={t('sc_welcome_medikit')} />; };
export const ScanMedicineScreen  = () => { const t = useT(); return <StubScreen icon="camera"          title={t('sc_scanning')} />; };
export const ManualEntryScreen   = () => { const t = useT(); return <StubScreen icon="pencil"          title={t('sc_manual_entry')} />; };
export const ShareMedicineScreen = () => { const t = useT(); return <StubScreen icon="share"           title={t('share_medicine')} />; };
export const InteractionScreen   = () => { const t = useT(); return <StubScreen icon="flask"           title={t('sc_compatibility')} />; };
export const SyncMembersScreen   = () => { const t = useT(); return <StubScreen icon="account-group"   title={t('members')} />; };
export const ActivityHistoryScreen = () => { const t = useT(); return <StubScreen icon="clipboard-list" title={t('sc_change_history')} />; };
export const CreateEditKitScreen = () => { const t = useT(); return <StubScreen icon="home"            title={t('sc_new_kit')} />; };
export const ReminderSettingsScreen = () => { const t = useT(); return <StubScreen icon="bell"         title={t('reminders')} />; };
export const SupportScreen       = () => { const t = useT(); return <StubScreen icon="help-circle"    title={t('sc_help')} />; };
