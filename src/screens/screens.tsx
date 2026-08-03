import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, TextInput, Switch, Alert, Share, Clipboard, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore, getMedicineStatus } from '../store';
import { ensureAuth, createInvite, updateMe, signInWithGoogle, isGoogleConfigured, GoogleCancelled, triggerFullSync, stopSync, deleteAccount, signOutGoogle } from '../api';
import { useAllMedicinesSortedByExpiry, useExpiryLabel } from '../hooks';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState, MedicineIcon, WarningBanner } from '../components';
import { HueSlider } from '../components/HueSlider';
import type { AppNotification, NotificationType, Medicine, KitAccessRole, MedicineForm } from '../types';
import { useT } from '../i18n';

// ─── NotificationsScreen ──────────────────────────────────────────────────────

const NOTIF_CFG: Record<NotificationType, { icon: string; iconColor: string; dot: string }> = {
  expired:             { icon: 'alert-circle',   iconColor: Colors.danger,  dot: Colors.danger },
  expiring_soon:       { icon: 'alert-circle',   iconColor: Colors.warning, dot: Colors.warning },
  low_stock:           { icon: 'package-variant', iconColor: Colors.warning, dot: Colors.warning },
  interaction_warning: { icon: 'alert',           iconColor: Colors.danger,  dot: Colors.danger },
  kit_update:          { icon: 'sync',            iconColor: Colors.blue,    dot: Colors.blue },
};

export function NotificationsScreen() {
  const notifications = useAppStore(s => s.notifications);
  const markRead = useAppStore(s => s.markNotificationRead);
  const markAll = useAppStore(s => s.markAllNotificationsRead);
  const dismiss = useAppStore(s => s.dismissNotification);
  const unread = notifications.filter(n => !n.isRead).length;
  const t = useT();

  return (
    <SafeAreaView style={ns.root}>
      <View style={ns.header}>
        <Text style={ns.title}>{t('notifications')}</Text>
        {unread > 0 && <TouchableOpacity onPress={markAll}><Text style={ns.markAll}>{t('mark_all_read')}</Text></TouchableOpacity>}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={ns.list}
        ListEmptyComponent={<EmptyState iconName="bell" title={t('no_notifications')} subtitle={t('no_notifications_sub')} />}
        renderItem={({ item }: { item: AppNotification }) => {
          const cfg = NOTIF_CFG[item.type] ?? NOTIF_CFG.kit_update;
          return (
            <TouchableOpacity style={[ns.card, item.isRead && ns.cardRead]} onPress={() => markRead(item.id)} activeOpacity={0.85}>
              <View style={[ns.dot, { backgroundColor: cfg.dot, opacity: item.isRead ? 0.3 : 1 }]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={cfg.icon} size={16} color={cfg.iconColor} />
                  <Text style={[ns.notifTitle, item.isRead && { fontWeight: '400' as any }]}>{item.title}</Text>
                </View>
                <Text style={ns.notifSub}>{item.body}</Text>
              </View>
              <TouchableOpacity onPress={() => dismiss(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={14} color={Colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const ns = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, marginBottom: Spacing.md },
  title: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary },
  markAll: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.blue },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, ...Shadow.card },
  cardRead: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  notifTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  notifSub: { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 3 },
});

// ─── ExpiryScreen ─────────────────────────────────────────────────────────────

export function ExpiryScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const medicines = useAllMedicinesSortedByExpiry();
  const expired = medicines.filter(m => getMedicineStatus(m) === 'expired');
  const expiring = medicines.filter(m => getMedicineStatus(m) === 'expiring_soon');
  const ok = medicines.filter(m => !['expired', 'expiring_soon'].includes(getMedicineStatus(m)));
  const sorted = [...expired, ...expiring, ...ok];

  return (
    <SafeAreaView style={es.root}>
      <View style={es.headerWrap}>
        <Text style={es.title}>{t('expiry_title')}</Text>
        {expired.length > 0 && (
          <View style={es.alertBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="close-circle" size={16} color={Colors.dangerDark} />
              <Text style={es.alertText}>{expired.length} {t('pf_expired_count_replace')}</Text>
            </View>
          </View>
        )}
      </View>
      <FlatList
        data={sorted}
        keyExtractor={m => m.id}
        contentContainerStyle={es.list}
        ListEmptyComponent={<EmptyState iconName="check-circle" title={t('pf_all_medicines_ok')} />}
        renderItem={({ item }: { item: Medicine }) => <ExpiryRow medicine={item} onPress={() => navigation.navigate('MedicineDetail', { medicineId: item.id, kitId: item.kitId })} />}
      />
    </SafeAreaView>
  );
}

function ExpiryRow({ medicine, onPress }: { medicine: Medicine; onPress: () => void }) {
  const t = useT();
  const expiry = useExpiryLabel(medicine.expirationDate);
  const status = getMedicineStatus(medicine);
  const daysLeft = Math.max(0, Math.floor((new Date(medicine.expirationDate).getTime() - Date.now()) / 86400000));
  const pct = Math.min(100, Math.round((daysLeft / 365) * 100));
  const barColor = status === 'expired' ? Colors.danger : status === 'expiring_soon' ? Colors.warning : Colors.success;
  const iconBg = status === 'expired' ? Colors.dangerLight : status === 'expiring_soon' ? Colors.warningLight : Colors.successLight;
  return (
    <TouchableOpacity style={es.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[es.iconWrap, { backgroundColor: iconBg }]}>
        <Icon
          name={status === 'expired' ? 'close-circle' : status === 'expiring_soon' ? 'alert' : 'check-circle'}
          size={20}
          color={barColor}
        />
      </View>
      <View style={es.info}>
        <Text style={es.medName}>{medicine.name}</Text>
        <Text style={[es.medDate, expiry.isExpired && { color: Colors.dangerDark }]}>{expiry.label}</Text>
        <View style={es.bar}><View style={[es.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} /></View>
      </View>
      <View style={[es.qty, { backgroundColor: iconBg }]}>
        <Text style={[es.qtyText, { color: barColor }]}>{medicine.remainingQuantity} {t('pf_units')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const es = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },
  headerWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, marginBottom: Spacing.md },
  title: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.md },
  alertBanner: { backgroundColor: Colors.dangerLight, borderWidth: 1.5, borderColor: Colors.dangerBorder, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  alertText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.dangerDark },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  row: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card },
  iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  medName: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  medDate: { fontSize: Typography.size.xs, color: Colors.textSecondary, marginTop: 2 },
  bar: { height: 5, borderRadius: Radius.pill, backgroundColor: Colors.bgCardAlt, marginTop: Spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  qty: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  qtyText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold },
});

// ─── AddMedicineScreen ────────────────────────────────────────────────────────

export function AddMedicineScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kitId: string = route.params?.kitId ?? 'kit-1';
  const t = useT();

  const OPTIONS = [
    { icon: 'camera', bg: '#C8E8FF', title: t('scan_package'), subtitle: t('pf_barcode_or_photo'), onPress: () => Alert.alert(t('pf_coming_soon'), t('pf_feature_in_development')) },
    { icon: 'pencil', bg: '#C8FFD8', title: t('enter_manually'), subtitle: t('pf_manual_entry_subtitle'), onPress: () => navigation.navigate('ManualEntry', { kitId }) },
  ];

  return (
    <SafeAreaView style={as.root}>
      <ScrollView contentContainerStyle={as.scroll}>
        <Text style={as.title}>{t('add_medicine')}</Text>
        <Text style={as.sub}>{t('pf_choose_add_method')}</Text>
        {OPTIONS.map(o => (
          <TouchableOpacity key={o.title} style={as.option} onPress={o.onPress} activeOpacity={0.85}>
            <View style={[as.optIcon, { backgroundColor: o.bg }]}><Icon name={o.icon} size={24} color={Colors.textPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={as.optTitle}>{o.title}</Text>
              <Text style={as.optSub}>{o.subtitle}</Text>
            </View>
            <Text style={as.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const as = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg },
  title: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  sub: { fontSize: Typography.size.body, color: Colors.textSecondary, marginBottom: Spacing.lg },
  option: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card },
  optIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  optSub: { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: Colors.textTertiary },
});

// ─── ManualEntryScreen ────────────────────────────────────────────────────────

const FORMS: { value: MedicineForm; labelKey: string; icon: string }[] = [
  { value: 'tablets',  labelKey: 'pf_form_tablets',  icon: 'pill' },
  { value: 'capsules', labelKey: 'pf_form_capsules', icon: 'pill' },
  { value: 'syrup',    labelKey: 'pf_form_syrup',    icon: 'bottle-tonic' },
  { value: 'spray',    labelKey: 'pf_form_spray',    icon: 'spray' },
  { value: 'drops',    labelKey: 'pf_form_drops',    icon: 'water' },
  { value: 'other',    labelKey: 'pf_form_other',    icon: 'stethoscope' },
];

export function ManualEntryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kitId: string = route.params?.kitId ?? 'kit-1';
  const addMedicine = useAppStore(s => s.addMedicine);
  const kits = useAppStore(s => s.kits);
  const t = useT();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicineForm>('tablets');
  const [totalQty, setTotalQty] = useState('');
  const [remainingQty, setRemainingQty] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedKitId, setSelectedKitId] = useState(kitId);

  function handleSave() {
    if (!name.trim()) { Alert.alert(t('pf_enter_name')); return; }
    if (!expiryDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert(t('pf_date_format')); return; }
    const total = parseInt(totalQty, 10) || 1;
    const remaining = Math.min(parseInt(remainingQty, 10) || total, total);
    const now = new Date().toISOString();
    addMedicine({
      id: `med-${Date.now()}`, kitId: selectedKitId, name: name.trim(),
      dosage: dosage.trim() || undefined, form, totalQuantity: total,
      remainingQuantity: remaining, expirationDate: expiryDate,
      notes: notes.trim() || undefined, addedAt: now, updatedAt: now,
    });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={me.root}>
      <ScrollView contentContainerStyle={me.scroll} keyboardShouldPersistTaps="handled">
        <Text style={me.sec}>{t('pf_section_main')}</Text>
        <View style={me.card}>
          <MeField label={t('pf_field_name')} placeholder={t('pf_name_placeholder')} value={name} onChange={setName} />
          <MeField label={t('pf_field_dosage')} placeholder={t('pf_dosage_placeholder')} value={dosage} onChange={setDosage} />
        </View>

        <Text style={me.sec}>{t('pf_section_form')}</Text>
        <View style={[me.card, { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }]}>
          {FORMS.map(f => (
            <TouchableOpacity key={f.value} style={[me.formPill, form === f.value && me.formPillActive]} onPress={() => setForm(f.value)} activeOpacity={0.8}>
              <Icon name={f.icon} size={16} color={form === f.value ? Colors.white : Colors.textSecondary} />
              <Text style={[me.formPillText, form === f.value && { color: Colors.white }]}>{t(f.labelKey as any)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={me.sec}>{t('pf_section_qty_expiry')}</Text>
        <View style={me.card}>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1 }}><MeField label={t('pf_field_total_in_pack')} placeholder="20" value={totalQty} onChange={setTotalQty} keyboard="number-pad" /></View>
            <View style={{ flex: 1 }}><MeField label={t('pf_field_remaining')} placeholder="12" value={remainingQty} onChange={setRemainingQty} keyboard="number-pad" /></View>
          </View>
          <MeField label={t('pf_field_expiry')} placeholder="2026-06-12" value={expiryDate} onChange={setExpiryDate} />
        </View>

        <Text style={me.sec}>{t('pf_section_notes')}</Text>
        <View style={me.card}>
          <MeField label={t('pf_field_notes')} placeholder={t('pf_notes_placeholder')} value={notes} onChange={setNotes} multi />
        </View>

        <Text style={me.sec}>{t('kit_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg }}>
          {kits.map(k => (
            <TouchableOpacity key={k.id} style={[me.kitChip, selectedKitId === k.id && me.kitChipActive]} onPress={() => setSelectedKitId(k.id)} activeOpacity={0.8}>
              <Icon name={k.icon} size={16} color={k.colorTag} />
              <Text style={[me.kitChipText, selectedKitId === k.id && { color: Colors.blueDark }]}>{k.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={me.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="content-save" size={18} color={Colors.white} />
            <Text style={me.saveBtnText}>{t('save')}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MeField({ label, placeholder, value, onChange, keyboard, multi }: {
  label: string; placeholder: string; value: string;
  onChange: (t: string) => void; keyboard?: any; multi?: boolean;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <TextInput
        style={[mef.input, multi && mef.inputMulti]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        multiline={multi}
        numberOfLines={multi ? 3 : 1}
      />
    </View>
  );
}
const mef = StyleSheet.create({
  input: { backgroundColor: Colors.bgCardAlt, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: Typography.size.md, color: Colors.textPrimary, height: 44 },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: Spacing.sm },
});
const me = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  sec: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xs, ...Shadow.card },
  formPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  formPillActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  formPillText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.textSecondary },
  kitChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  kitChipActive: { backgroundColor: Colors.blueLight, borderColor: Colors.blue },
  kitChipText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.textSecondary },
  saveBtn: { backgroundColor: Colors.blue, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.md, ...Shadow.card },
  saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.white },
});

// ─── ShareKitScreen ────────────────────────────────────────────────────────────

let QRCode: any = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch {}

const ROLE_LABEL_KEYS: Record<KitAccessRole, string> = {
  owner: 'pf_role_owner', editor: 'pf_role_editor', viewer: 'pf_role_viewer', synced: 'pf_role_synced',
};

function makeShareKitStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 40 },

    qrBlock: {
      backgroundColor: C.blueLight, borderRadius: Radius.xl,
      padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg,
    },
    qrPlaceholder: {
      width: 130, height: 130, backgroundColor: C.bgCard,
      borderRadius: Radius.md, borderWidth: 2, borderStyle: 'dashed',
      borderColor: C.border, alignItems: 'center', justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    qrHint:       { fontSize: Typography.size.xs, color: C.textTertiary, marginTop: 4 },
    kitName:      { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary, marginTop: Spacing.md },
    kitSub:       { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 4 },
    shareUrlText: { fontSize: Typography.size.xs, color: C.blue, marginTop: 6, opacity: 0.7 },

    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.sm,
    },
    tgBtn:        { backgroundColor: '#29B6F6' },
    waBtn:        { backgroundColor: '#25D366' },
    copyBtn:      { backgroundColor: C.bgCardAlt, borderWidth: 1.5, borderColor: C.border },
    shareBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },

    card:      { backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.sm, ...Shadow.card },
    cardTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold, color: C.textPrimary, marginBottom: 4 },
    cardSub:   { fontSize: Typography.size.body, color: C.textSecondary, marginBottom: Spacing.md },

    nickRow:     { flexDirection: 'row', gap: Spacing.sm },
    nickInput:   {
      flex: 1, backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, height: 44,
      fontSize: Typography.size.md, color: C.textPrimary,
      textAlignVertical: 'center',
    },
    nickSendBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },

    suggestions:  { marginTop: Spacing.sm, borderRadius: Radius.md, overflow: 'hidden' },
    suggRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
    suggAvatar:   { width: 34, height: 34, borderRadius: 17, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
    suggInitials: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.white },
    suggName:     { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },
    suggNick:     { fontSize: Typography.size.xs, color: C.textSecondary },

    memberRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
    memberAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
    memberInitials: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.white },
    memberName:     { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },
    rolePill:       { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill },
    roleText:       { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },
  });
}

export function ShareKitScreen() {
  const route   = useRoute<any>();
  const kitId   = route.params?.kitId ?? '';
  const kit     = useAppStore(s => s.getKit(kitId));
  const persons = useAppStore(s => s.persons);
  const t       = useT();
  const C       = useColors();
  const sk      = useMemo(() => makeShareKitStyles(C), [C]);

  const [nickInput, setNickInput]   = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  if (!kit) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgPage }}>
      <Text style={{ padding: 20, color: C.textPrimary }}>{t('kit_not_found')}</Text>
    </SafeAreaView>
  );

  const shareUrl = `https://medikit.app/join/${kitId}`;

  async function handleShareApp(via: 'telegram' | 'whatsapp' | 'native') {
    const msg = `${t('share_kit')}: «${kit!.name}»\n${shareUrl}`;
    if (via === 'telegram') {
      await Share.share({ message: msg, title: kit!.name });
    } else if (via === 'whatsapp') {
      await Share.share({ message: msg });
    } else {
      await Share.share({ message: msg, url: shareUrl });
    }
  }

  function handleCopyLink() {
    try { (Clipboard as any).setString(shareUrl); } catch {}
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleInviteByNick() {
    const q = nickInput.replace(/^@/, '').toLowerCase().trim();
    if (!q) return;
    try {
      await ensureAuth();
      await createInvite(kitId, { nickname: q, role: 'viewer' });
      Alert.alert(t('invite_sent'), `@${q}`);
      setNickInput('');
    } catch {
      // Offline / unknown nickname → fall back to the local contact list.
      const found = persons.find(
        p => p.nickname?.toLowerCase() === q || p.nickname?.toLowerCase() === `@${q}`,
      );
      if (!found) {
        Alert.alert(t('person_not_found'), `@${q}`);
        return;
      }
      Alert.alert(t('invite_sent'), `${found.name} (@${found.nickname})`);
      setNickInput('');
    }
  }

  return (
    <SafeAreaView style={sk.root}>
      <ScrollView contentContainerStyle={sk.scroll} keyboardShouldPersistTaps="handled">

        {/* ── QR block ── */}
        <View style={sk.qrBlock}>
          {QRCode ? (
            <QRCode value={shareUrl} size={130} backgroundColor="transparent" color={C.blueDark} />
          ) : (
            <View style={sk.qrPlaceholder}>
              <Icon name="qrcode" size={36} color={C.textTertiary} />
              <Text style={sk.qrHint}>{t('sc_qr_code')}</Text>
            </View>
          )}
          <Text style={sk.kitName}>{kit.icon} {kit.name}</Text>
          <Text style={sk.kitSub}>{kit.members.length} {t('pf_members_word')}</Text>
          <Text style={sk.shareUrlText} numberOfLines={1}>{shareUrl}</Text>
        </View>

        {/* ── Share buttons ── */}
        <TouchableOpacity style={[sk.shareBtn, sk.tgBtn]} onPress={() => handleShareApp('telegram')} activeOpacity={0.85}>
          <Icon name="send" size={20} color="#fff" />
          <Text style={sk.shareBtnText}>{t('share_telegram')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sk.shareBtn, sk.waBtn]} onPress={() => handleShareApp('whatsapp')} activeOpacity={0.85}>
          <Icon name="message" size={20} color="#fff" />
          <Text style={sk.shareBtnText}>{t('share_whatsapp')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sk.shareBtn, sk.copyBtn]} onPress={handleCopyLink} activeOpacity={0.85}>
          <Icon name={linkCopied ? 'check' : 'link'} size={20} color={C.blue} />
          <Text style={[sk.shareBtnText, { color: C.blue }]}>
            {linkCopied ? t('link_copied') : t('copy_link')}
          </Text>
        </TouchableOpacity>

        {/* ── Invite by nickname ── */}
        <View style={sk.card}>
          <Text style={sk.cardTitle}>{t('invite_nickname')}</Text>
          <Text style={sk.cardSub}>{t('pf_user_must_be_contact')}</Text>
          <View style={sk.nickRow}>
            <TextInput
              style={sk.nickInput}
              placeholder={t('nickname_ph')}
              placeholderTextColor={C.textTertiary}
              value={nickInput}
              onChangeText={setNickInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={sk.nickSendBtn} onPress={handleInviteByNick} activeOpacity={0.85}>
              <Icon name="send" size={20} color={C.white} />
            </TouchableOpacity>
          </View>
          {nickInput.length >= 1 && (() => {
            const q = nickInput.replace(/^@/, '').toLowerCase();
            const matches = persons.filter(
              p => p.nickname?.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
            ).slice(0, 4);
            if (matches.length === 0) return null;
            return (
              <View style={sk.suggestions}>
                {matches.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={sk.suggRow}
                    onPress={() => setNickInput(p.nickname ? `@${p.nickname}` : p.name)}
                    activeOpacity={0.8}
                  >
                    <View style={sk.suggAvatar}>
                      <Text style={sk.suggInitials}>{p.avatarInitials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={sk.suggName}>{p.name}</Text>
                      {p.nickname ? <Text style={sk.suggNick}>@{p.nickname}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
        </View>

        {/* ── Members ── */}
        <View style={sk.card}>
          <Text style={sk.cardTitle}>{t('members')} ({kit.members.length})</Text>
          {kit.members.map(m => (
            <View key={m.userId} style={sk.memberRow}>
              <View style={sk.memberAvatar}>
                <Text style={sk.memberInitials}>{m.avatarInitials}</Text>
              </View>
              <Text style={sk.memberName}>{m.name}</Text>
              <View style={[sk.rolePill, {
                backgroundColor: m.role === 'owner' ? C.blueLight : C.successLight,
              }]}>
                <Text style={[sk.roleText, {
                  color: m.role === 'owner' ? C.blueDark : C.successDark,
                }]}>
                  {t(ROLE_LABEL_KEYS[m.role] as any)}
                </Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SyncMembersScreen ────────────────────────────────────────────────────────

export function SyncMembersScreen() {
  const route = useRoute<any>();
  const kitId = route.params?.kitId ?? '';
  const kit = useAppStore(s => s.getKit(kitId));
  const t = useT();
  if (!kit) return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }}><Text style={{ padding: 20 }}>{t('pf_not_found')}</Text></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.lg }}>
          {t('pf_kit_members')}
        </Text>
        {kit.members.map(m => (
          <View key={m.userId} style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.white }}>{m.avatarInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary }}>{m.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="circle" size={10} color={m.syncStatus === 'active' ? Colors.success : Colors.danger} />
                <Text style={{ fontSize: Typography.size.xs, color: Colors.textSecondary }}>{m.syncStatus === 'active' ? t('pf_status_active') : t('pf_status_disabled')}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: Colors.blueLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill }}>
              <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: Colors.blueDark }}>
                {t(ROLE_LABEL_KEYS[m.role] as any)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CreateEditKitScreen ──────────────────────────────────────────────────────

const ICONS_LIST = ['home', 'home-outline', 'account-group', 'leaf', 'car', 'umbrella', 'briefcase', 'tent', 'hospital-box', 'bag-suitcase'];
const COLORS_LIST = ['#A0CEFF', '#78A9FF', '#FFB347', '#56CE53', '#FF7575', '#A080FF', '#FF775C', '#47C8FF', '#FFCF47', '#80D8B0'];

export function CreateEditKitScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kitId: string | undefined = route.params?.kitId;
  const existingKit = useAppStore(s => kitId ? s.getKit(kitId) : undefined);
  const addKit = useAppStore(s => s.addKit);
  const updateKit = useAppStore(s => s.updateKit);
  const deleteKit = useAppStore(s => s.deleteKit);
  const user = useAppStore(s => s.user);
  const t = useT();
  const [name, setName] = useState(existingKit?.name ?? '');
  const [description, setDescription] = useState(existingKit?.description ?? '');
  const [icon, setIcon] = useState(existingKit?.icon ?? 'home');
  const [colorTag, setColorTag] = useState(existingKit?.colorTag ?? Colors.blue);
  const [isPrivate, setIsPrivate] = useState(existingKit?.isPrivate ?? true);
  const isEditing = !!kitId;

  function handleSave() {
    if (!name.trim()) { Alert.alert('Укажите название аптечки'); return; }
    const now = new Date().toISOString();
    if (isEditing && kitId) {
      updateKit(kitId, { name: name.trim(), description, icon, colorTag, isPrivate });
    } else {
      addKit({ id: `kit-${Date.now()}`, name: name.trim(), description: description.trim() || undefined, icon, colorTag, isPrivate, ownerId: user.id, members: [{ userId: user.id, name: user.name, avatarInitials: user.avatarInitials, role: 'owner', syncStatus: 'active' }], createdAt: now, updatedAt: now });
    }
    navigation.goBack();
  }

  function handleDelete() {
    Alert.alert('Удалить аптечку', `Удалить «${name}»? Все препараты будут удалены.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => { deleteKit(kitId!); navigation.popToTop(); } },
    ]);
  }

  return (
    <SafeAreaView style={ck.root}>
      <ScrollView contentContainerStyle={ck.scroll} keyboardShouldPersistTaps="handled">
        <View style={[ck.preview, { backgroundColor: colorTag + '22', borderColor: colorTag + '66' }]}>
          <Icon name={icon} size={52} color={colorTag} style={{ marginBottom: Spacing.sm }} />
          <Text style={ck.previewName}>{name || 'Название аптечки'}</Text>
        </View>
        <Text style={ck.sec}>Название *</Text>
        <TextInput style={ck.input} placeholder="Домашняя аптечка" placeholderTextColor={Colors.textTertiary} value={name} onChangeText={setName} />
        <Text style={ck.sec}>Описание</Text>
        <TextInput style={ck.input} placeholder="Кухонный шкаф…" placeholderTextColor={Colors.textTertiary} value={description} onChangeText={setDescription} />
        <Text style={ck.sec}>Иконка</Text>
        <View style={[ck.card, { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }]}>
          {ICONS_LIST.map(ic => (
            <TouchableOpacity key={ic} style={[ck.iconOpt, icon === ic && { borderColor: colorTag, borderWidth: 2.5 }]} onPress={() => setIcon(ic)} activeOpacity={0.8}>
              <Icon name={ic} size={26} color={icon === ic ? colorTag : Colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={ck.sec}>Цвет</Text>
        <View style={[ck.card, { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }]}>
          {COLORS_LIST.map(c => (
            <TouchableOpacity key={c} style={[ck.colorDot, { backgroundColor: c }, colorTag === c && { borderWidth: 3, borderColor: Colors.textPrimary }]} onPress={() => setColorTag(c)} activeOpacity={0.8} />
          ))}
        </View>
        <View style={[ck.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="lock" size={16} color={Colors.textPrimary} />
              <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary }}>Личная аптечка</Text>
            </View>
            <Text style={{ fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 2 }}>Только вы можете видеть</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: Colors.blue, false: Colors.border }} thumbColor={Colors.white} />
        </View>
        <TouchableOpacity style={ck.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={isEditing ? 'content-save' : 'check-circle'} size={18} color={Colors.white} />
            <Text style={ck.saveBtnText}>{isEditing ? 'Сохранить' : 'Создать аптечку'}</Text>
          </View>
        </TouchableOpacity>
        {isEditing && (
          <TouchableOpacity style={{ padding: Spacing.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }} onPress={handleDelete} activeOpacity={0.8}>
            <Icon name="trash-can" size={16} color={Colors.danger} />
            <Text style={{ fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.danger }}>Удалить аптечку</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const ck = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  preview: { alignItems: 'center', padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1.5, marginBottom: Spacing.lg },
  previewName: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary },
  sec: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.lg, height: 48, fontSize: Typography.size.md, color: Colors.textPrimary, marginBottom: Spacing.xs, ...Shadow.sm },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xs, ...Shadow.card },
  iconOpt: { width: 50, height: 50, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCardAlt, borderWidth: 1.5, borderColor: 'transparent' },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  saveBtn: { backgroundColor: Colors.blue, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card },
  saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.white },
});

// ─── InteractionScreen ────────────────────────────────────────────────────────

export function InteractionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { medicineId } = route.params ?? {};
  const medicine = useAppStore(s => s.getMedicine(medicineId ?? ''));
  if (!medicine) return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }}><Text style={{ padding: 20 }}>Не найдено</Text></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <View style={{ backgroundColor: Colors.dangerLight, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg }}>
          <Icon name="flask" size={44} color={Colors.dangerDark} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.dangerDark }}>Совместимость</Text>
            <Text style={{ fontSize: Typography.size.body, color: Colors.dangerDark, marginTop: 2 }}>{medicine.name}</Text>
          </View>
        </View>
        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          medicine.incompatibleWith.map((item, i) => (
            <View key={i} style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.danger, ...Shadow.card }}>
              <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="cancel" size={22} color={Colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary, marginBottom: 4 }}>{item}</Text>
                <Text style={{ fontSize: Typography.size.body, color: Colors.textSecondary, lineHeight: 20 }}>Одновременный приём может снизить эффективность или вызвать нежелательные реакции.</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: Spacing.xxxl, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, ...Shadow.card }}>
            <Icon name="check-circle" size={40} color={Colors.success} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.textPrimary }}>Нет противопоказаний</Text>
          </View>
        )}
        <TouchableOpacity style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.xl, ...Shadow.sm }} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={{ fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.blue }}>← Назад к {medicine.name}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

function makeProfileStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bgPage },
    scroll:  { padding: Spacing.lg, paddingBottom: 40 },
    label:   {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: Spacing.xs, marginTop: Spacing.sm,
    },
    input:   {
      backgroundColor: C.bgCard, borderRadius: Radius.xl, borderWidth: 1.5,
      borderColor: C.border, paddingHorizontal: Spacing.lg, height: 48,
      fontSize: Typography.size.md, color: C.textPrimary, marginBottom: Spacing.xs,
      textAlignVertical: 'center', ...Shadow.sm,
    },
    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl, padding: Spacing.lg,
      alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, ...Shadow.card,
    },
    saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.white },
    row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: C.bgCard },
    rowText: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: C.textPrimary },
    divider: { height: 1, backgroundColor: C.borderLight, marginLeft: 58 },
  });
}

export function ProfileScreen() {
  const navigation  = useNavigation<any>();
  const C           = useColors();
  const ps          = useMemo(() => makeProfileStyles(C), [C]);
  const t           = useT();
  const user        = useAppStore(s => s.user);
  const updateUser  = useAppStore(s => s.updateUser);
  const kits        = useAppStore(s => s.kits);

  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(user.name);
  const [surname,  setSurname]  = useState(user.surname ?? '');
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [email,    setEmail]    = useState(user.email ?? '');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function handleLogout() {
    Alert.alert(
      t('pf_logout'),
      t('pf_logout_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('pf_logout'),
          style: 'destructive',
          onPress: () => {
            stopSync();
            signOutGoogle().catch(() => {});
            updateUser({ googleLinked: false });
          },
        },
      ],
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      t('pf_delete_account'),
      t('pf_delete_account_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('pf_delete_account'),
          style: 'destructive',
          onPress: async () => {
            setDeleteBusy(true);
            try { await deleteAccount(); } catch { /* best-effort */ }
            stopSync();
            signOutGoogle().catch(() => {});
            updateUser({ googleLinked: false });
            setDeleteBusy(false);
          },
        },
      ],
    );
  }

  async function handleGoogle() {
    setGoogleBusy(true);
    try {
      const apiUser = await signInWithGoogle();
      updateUser({
        id: apiUser.id, nickname: apiUser.nickname, name: apiUser.name,
        surname: apiUser.surname, email: apiUser.email,
        avatarInitials: apiUser.avatarInitials, googleLinked: true,
      });
      triggerFullSync(); // re-pull server data so kits appear immediately
      Alert.alert(t('pf_google_linked'), t('pf_google_linked_msg'));
    } catch (e) {
      if (e instanceof GoogleCancelled) return; // user backed out — no error
      Alert.alert(t('pf_google_failed'), e instanceof Error ? e.message : t('pf_try_again'));
    } finally {
      setGoogleBusy(false);
    }
  }

  function handleSave() {
    const trimName    = name.trim();
    const trimNick    = nickname.trim().replace(/^@/, '');
    if (!trimName) { Alert.alert(t('pf_name_required')); return; }
    const words    = [trimName, surname.trim()].filter(Boolean);
    const initials = words.map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
    const changes = {
      name:     trimName,
      surname:  surname.trim() || undefined,
      nickname: trimNick || undefined,
      email:    email.trim() || undefined,
      avatarInitials: initials || trimName.slice(0, 2).toUpperCase(),
    };
    updateUser(changes);
    setEditing(false);
    // Persist to the server so the edit survives relaunch (GET /auth/me would
    // otherwise overwrite it). Best-effort: stays local-first when offline.
    updateMe(changes).catch(() => { /* offline → retry on next edit */ });
  }

  const displayName = [user.name, user.surname].filter(Boolean).join(' ');
  const nickDisplay = user.nickname ? `@${user.nickname}` : t('pf_no_nickname');

  if (editing) {
    return (
      <SafeAreaView style={[ps.root]}>
        <ScrollView contentContainerStyle={ps.scroll}>
          <Text style={ps.label}>{t('pf_first_name')}</Text>
          <TextInput style={ps.input} placeholder={t('pf_first_name')} placeholderTextColor={C.textTertiary} value={name} onChangeText={setName} />
          <Text style={ps.label}>{t('pf_last_name')}</Text>
          <TextInput style={ps.input} placeholder={t('pf_last_name')} placeholderTextColor={C.textTertiary} value={surname} onChangeText={setSurname} />
          <Text style={ps.label}>{t('pf_nickname')}</Text>
          <TextInput style={ps.input} placeholder="@nickname" placeholderTextColor={C.textTertiary} value={nickname} onChangeText={tt => setNickname(tt.startsWith('@') ? tt : `@${tt}`)} autoCapitalize="none" />
          <Text style={ps.label}>{t('pf_email')}</Text>
          <TextInput style={ps.input} placeholder="email@example.com" placeholderTextColor={C.textTertiary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TouchableOpacity style={ps.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={ps.saveBtnText}>{t('save')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', padding: Spacing.md }} onPress={() => setEditing(false)}>
            <Text style={{ fontSize: Typography.size.base, color: C.textSecondary }}>{t('cancel')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ps.root}>
      <ScrollView contentContainerStyle={ps.scroll}>
        {/* Header card */}
        <TouchableOpacity
          style={{ backgroundColor: C.blue, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg }}
          onPress={() => setEditing(true)} activeOpacity={0.85}
        >
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF' }}>{user.avatarInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: '#FFFFFF' }}>{displayName}</Text>
            <Text style={{ fontSize: Typography.size.body, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{nickDisplay}</Text>
            {user.email ? <Text style={{ fontSize: Typography.size.body, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{user.email}</Text> : null}
          </View>
          <Icon name="pencil" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Google account link — hidden until a Web client ID is configured. */}
        {isGoogleConfigured() && (
          user.googleLinked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg }}>
              <Icon name="check-circle" size={18} color={Colors.success} style={{ width: 26 }} />
              <Text style={{ flex: 1, fontSize: Typography.size.base, color: C.textSecondary }}>{t('pf_google_linked')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.bgCard, borderColor: C.borderLight, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg }}
              onPress={handleGoogle} disabled={googleBusy} activeOpacity={0.85}
            >
              {googleBusy
                ? <ActivityIndicator color={C.textSecondary} />
                : <>
                    <Icon name="google" size={18} color={C.textSecondary} />
                    <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: C.textPrimary }}>{t('pf_google_signin')}</Text>
                  </>}
            </TouchableOpacity>
          )
        )}

        {[
          { icon: 'home',         label: t('pf_my_kits').replace('{count}', String(kits.length)), onPress: () => {} },
          { icon: 'pencil',       label: t('pf_edit_profile'), onPress: () => setEditing(true) },
          { icon: 'account-group', label: t('pf_contacts'), onPress: () => navigation.navigate('Persons') },
          { icon: 'doctor',        label: t('pf_doctors'), onPress: () => navigation.navigate('Doctors') },
          { icon: 'file-document-multiple', label: t('pf_analyses_archive'), onPress: () => navigation.navigate('AnalysesArchive') },
          { icon: 'calendar',     label: t('pf_expiry_dates'), onPress: () => navigation.navigate('Expiry') },
          { icon: 'cog',          label: t('pf_settings'), onPress: () => navigation.navigate('Settings') },
          { icon: 'help-circle',  label: t('pf_help'), onPress: () => navigation.navigate('Support') },
        ].map((item, i, arr) => (
          <View key={item.label}>
            <TouchableOpacity style={ps.row} onPress={item.onPress} activeOpacity={0.8}>
              <Icon name={item.icon} size={18} color={C.textSecondary} style={{ width: 26, textAlign: 'center' }} />
              <Text style={ps.rowText}>{item.label}</Text>
              <Icon name="chevron-right" size={20} color={C.textTertiary} />
            </TouchableOpacity>
            {i < arr.length - 1 && <View style={ps.divider} />}
          </View>
        ))}

        {/* ── Account actions ── */}
        <Text style={[ps.label, { marginTop: Spacing.xl }]}>{t('pf_account_section')}</Text>
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.card }}>
          <TouchableOpacity
            style={[ps.row, { borderRadius: 0 }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Icon name="logout" size={18} color={Colors.warning} style={{ width: 26, textAlign: 'center' }} />
            <Text style={[ps.rowText, { color: Colors.warning }]}>{t('pf_logout')}</Text>
          </TouchableOpacity>
          <View style={ps.divider} />
          <TouchableOpacity
            style={[ps.row, { borderRadius: 0 }]}
            onPress={handleDeleteAccount}
            disabled={deleteBusy}
            activeOpacity={0.8}
          >
            {deleteBusy
              ? <ActivityIndicator color={Colors.danger} style={{ width: 26 }} />
              : <Icon name="delete-forever" size={18} color={Colors.danger} style={{ width: 26, textAlign: 'center' }} />}
            <Text style={[ps.rowText, { color: Colors.danger }]}>{t('pf_delete_account')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

function makeSettingsStyles(C: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bgPage },
    sec: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.lg,
    },
    card:     { backgroundColor: C.bgCard, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.card, marginBottom: Spacing.xs },
    row:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    rowLabel: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: C.textPrimary },
    div:      { height: 1, backgroundColor: C.borderLight, marginLeft: 60 },
    radio:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: C.blue },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },
    toggle:   { width: 46, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 3 },
    toggleOn: { backgroundColor: C.success },
    toggleOff:{ backgroundColor: C.border },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.white },
    thumbRight:  { alignSelf: 'flex-end' },
    thumbLeft:   { alignSelf: 'flex-start' },
  });
}

const THEMES = [
  { key: 'light',       icon: 'weather-sunny' },
  { key: 'dark',        icon: 'weather-night' },
  { key: 'system',      icon: 'cellphone' },
  { key: 'pastel',      icon: 'flower' },
  { key: 'green',       icon: 'leaf' },
  { key: 'red',         icon: 'flower-tulip' },
  { key: 'mint',        icon: 'leaf-maple' },
  { key: 'dark-pastel', icon: 'star-four-points' },
  { key: 'dark-green',  icon: 'pine-tree' },
  { key: 'dark-red',    icon: 'alert-circle' },
  { key: 'dark-mint',   icon: 'waves' },
  { key: 'custom',      icon: 'palette' },
] as const;


const LANGUAGES: { key: 'en' | 'ru' | 'tr' | 'ro'; abbr: string; name: string }[] = [
  { key: 'en', abbr: 'EN', name: 'English' },
  { key: 'ru', abbr: 'RU', name: 'Русский' },
  { key: 'tr', abbr: 'TR', name: 'Türkçe' },
  { key: 'ro', abbr: 'RO', name: 'Română' },
];

export function SettingsScreen() {
  const settings = useAppStore(s => s.settings);
  const update   = useAppStore(s => s.updateSettings);
  const t        = useT();
  const C        = useColors();
  const stg      = useMemo(() => makeSettingsStyles(C), [C]);

  function toggle(key: 'pushEnabled' | 'lowStockEnabled' | 'kitActivityEnabled' | 'interactionWarningsEnabled') {
    update({ reminders: { ...settings.reminders, [key]: !settings.reminders[key] } });
  }

  const notifItems = [
    { icon: 'bell',          key: 'pushEnabled'                 as const, label: t('push_enabled') },
    { icon: 'package-variant', key: 'lowStockEnabled'           as const, label: t('low_stock_enabled') },
    { icon: 'account-group', key: 'kitActivityEnabled'          as const, label: t('kit_activity_enabled') },
    { icon: 'alert',         key: 'interactionWarningsEnabled'  as const, label: t('interaction_warnings_enabled') },
  ];

  return (
    <SafeAreaView style={stg.root}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>

        {/* ── Theme ── */}
        <Text style={stg.sec}>{t('theme')}</Text>
        <View style={stg.card}>
          {THEMES.map((th, i) => (
            <View key={th.key}>
              <TouchableOpacity style={stg.row} onPress={() => update({ theme: th.key })} activeOpacity={0.8}>
                <Icon name={th.icon} size={20} color={C.textSecondary} style={{ width: 30, textAlign: 'center' }} />
                <Text style={stg.rowLabel}>{t(`theme_${th.key}` as any)}</Text>
                <View style={[stg.radio, settings.theme === th.key && stg.radioActive]}>
                  {settings.theme === th.key && <View style={stg.radioDot} />}
                </View>
              </TouchableOpacity>
              {i < THEMES.length - 1 && <View style={stg.div} />}
            </View>
          ))}
        </View>

        {/* ── Custom color pickers (4 hue sliders) ── */}
        {settings.theme === 'custom' && (
          <>
            <Text style={stg.sec}>{t('theme_custom_colors')}</Text>
            <View style={[stg.card, { padding: Spacing.md, gap: Spacing.lg }]}>
              <HueSlider
                label={t('theme_custom_accent')}
                value={settings.accentColor ?? '#78A9FF'}
                onChange={v => update({ accentColor: v })}
              />
              <View style={{ height: 1, backgroundColor: C.borderLight }} />
              <HueSlider
                label={t('theme_custom_bg')}
                value={settings.customBg ?? '#F7F8FD'}
                onChange={v => update({ customBg: v })}
                saturation={20}
                lightness={97}
              />
              <View style={{ height: 1, backgroundColor: C.borderLight }} />
              <HueSlider
                label={t('theme_custom_card')}
                value={settings.customCard ?? '#FFFFFF'}
                onChange={v => update({ customCard: v })}
                saturation={15}
                lightness={99}
              />
              <View style={{ height: 1, backgroundColor: C.borderLight }} />
              <HueSlider
                label={t('theme_custom_text')}
                value={settings.customText ?? '#364052'}
                onChange={v => update({ customText: v })}
                saturation={25}
                lightness={22}
              />
            </View>
          </>
        )}

        {/* ── Gradient toggle ── */}
        <View style={stg.card}>
          <TouchableOpacity
            style={stg.row}
            onPress={() => update({ useGradient: !settings.useGradient })}
            activeOpacity={0.8}
          >
            <Icon name="gradient-vertical" size={20} color={C.textSecondary} style={{ width: 30, textAlign: 'center' }} />
            <View style={{ flex: 1 }}>
              <Text style={stg.rowLabel}>{t('theme_gradient')}</Text>
              <Text style={{ fontSize: Typography.size.xs, color: C.textTertiary, marginTop: 2 }}>{t('theme_gradient_sub')}</Text>
            </View>
            <View style={[stg.toggle, settings.useGradient ? stg.toggleOn : stg.toggleOff]}>
              <View style={[stg.toggleThumb, settings.useGradient ? stg.thumbRight : stg.thumbLeft]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Language ── */}
        <Text style={stg.sec}>{t('language')}</Text>
        <View style={stg.card}>
          {LANGUAGES.map((lang, i) => (
            <View key={lang.key}>
              <TouchableOpacity style={stg.row} onPress={() => update({ language: lang.key })} activeOpacity={0.8}>
                <View style={{ width: 30, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSecondary, letterSpacing: 0.5 }}>{lang.abbr}</Text>
                </View>
                <Text style={stg.rowLabel}>{lang.name}</Text>
                <View style={[stg.radio, settings.language === lang.key && stg.radioActive]}>
                  {settings.language === lang.key && <View style={stg.radioDot} />}
                </View>
              </TouchableOpacity>
              {i < LANGUAGES.length - 1 && <View style={stg.div} />}
            </View>
          ))}
        </View>

        {/* ── Notifications toggles ── */}
        <Text style={stg.sec}>{t('notif_section')}</Text>
        <View style={stg.card}>
          {notifItems.map((item, i) => (
            <View key={item.key}>
              <TouchableOpacity style={stg.row} onPress={() => toggle(item.key)} activeOpacity={0.8}>
                <Icon name={item.icon} size={18} color={C.textSecondary} style={{ width: 30, textAlign: 'center' }} />
                <Text style={stg.rowLabel}>{item.label}</Text>
                <View style={[stg.toggle, settings.reminders[item.key] ? stg.toggleOn : stg.toggleOff]}>
                  <View style={[stg.toggleThumb, settings.reminders[item.key] ? stg.thumbRight : stg.thumbLeft]} />
                </View>
              </TouchableOpacity>
              {i < notifItems.length - 1 && <View style={stg.div} />}
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
