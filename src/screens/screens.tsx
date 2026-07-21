import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, TextInput, Switch, Alert, Share, Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore, getMedicineStatus } from '../store';
import { ensureAuth, createInvite } from '../api';
import { useAllMedicinesSortedByExpiry, useExpiryLabel } from '../hooks';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState, MedicineIcon, WarningBanner } from '../components';
import type { AppNotification, NotificationType, Medicine, KitAccessRole, MedicineForm } from '../types';
import { useT } from '../i18n';

// ─── NotificationsScreen ──────────────────────────────────────────────────────

const NOTIF_CFG: Record<NotificationType, { emoji: string; dot: string }> = {
  expired:             { emoji: '🔴', dot: Colors.danger },
  expiring_soon:       { emoji: '🟡', dot: Colors.warning },
  low_stock:           { emoji: '📦', dot: Colors.warning },
  interaction_warning: { emoji: '⚠️', dot: Colors.danger },
  kit_update:          { emoji: '🔄', dot: Colors.blue },
};

export function NotificationsScreen() {
  const notifications = useAppStore(s => s.notifications);
  const markRead = useAppStore(s => s.markNotificationRead);
  const markAll = useAppStore(s => s.markAllNotificationsRead);
  const dismiss = useAppStore(s => s.dismissNotification);
  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={ns.root}>
      <View style={ns.header}>
        <Text style={ns.title}>Уведомления</Text>
        {unread > 0 && <TouchableOpacity onPress={markAll}><Text style={ns.markAll}>Прочитать все</Text></TouchableOpacity>}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={ns.list}
        ListEmptyComponent={<EmptyState emoji="🔔" title="Нет уведомлений" subtitle="Всё под контролем" />}
        renderItem={({ item }: { item: AppNotification }) => {
          const cfg = NOTIF_CFG[item.type] ?? NOTIF_CFG.kit_update;
          return (
            <TouchableOpacity style={[ns.card, item.isRead && ns.cardRead]} onPress={() => markRead(item.id)} activeOpacity={0.85}>
              <View style={[ns.dot, { backgroundColor: cfg.dot, opacity: item.isRead ? 0.3 : 1 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[ns.notifTitle, item.isRead && { fontWeight: '400' as any }]}>{cfg.emoji} {item.title}</Text>
                <Text style={ns.notifSub}>{item.body}</Text>
              </View>
              <TouchableOpacity onPress={() => dismiss(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 14, color: Colors.textTertiary }}>✕</Text>
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
  const medicines = useAllMedicinesSortedByExpiry();
  const expired = medicines.filter(m => getMedicineStatus(m) === 'expired');
  const expiring = medicines.filter(m => getMedicineStatus(m) === 'expiring_soon');
  const ok = medicines.filter(m => !['expired', 'expiring_soon'].includes(getMedicineStatus(m)));
  const sorted = [...expired, ...expiring, ...ok];

  return (
    <SafeAreaView style={es.root}>
      <View style={es.headerWrap}>
        <Text style={es.title}>Сроки годности</Text>
        {expired.length > 0 && (
          <View style={es.alertBanner}>
            <Text style={es.alertText}>❌ {expired.length} просрочен{expired.length > 1 ? 'ы' : ''} — замените</Text>
          </View>
        )}
      </View>
      <FlatList
        data={sorted}
        keyExtractor={m => m.id}
        contentContainerStyle={es.list}
        ListEmptyComponent={<EmptyState emoji="✅" title="Все препараты в порядке" />}
        renderItem={({ item }: { item: Medicine }) => <ExpiryRow medicine={item} onPress={() => navigation.navigate('MedicineDetail', { medicineId: item.id, kitId: item.kitId })} />}
      />
    </SafeAreaView>
  );
}

function ExpiryRow({ medicine, onPress }: { medicine: Medicine; onPress: () => void }) {
  const expiry = useExpiryLabel(medicine.expirationDate);
  const status = getMedicineStatus(medicine);
  const daysLeft = Math.max(0, Math.floor((new Date(medicine.expirationDate).getTime() - Date.now()) / 86400000));
  const pct = Math.min(100, Math.round((daysLeft / 365) * 100));
  const barColor = status === 'expired' ? Colors.danger : status === 'expiring_soon' ? Colors.warning : Colors.success;
  const iconBg = status === 'expired' ? Colors.dangerLight : status === 'expiring_soon' ? Colors.warningLight : Colors.successLight;
  return (
    <TouchableOpacity style={es.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[es.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 20 }}>{status === 'expired' ? '❌' : status === 'expiring_soon' ? '⚠️' : '✅'}</Text>
      </View>
      <View style={es.info}>
        <Text style={es.medName}>{medicine.name}</Text>
        <Text style={[es.medDate, expiry.isExpired && { color: Colors.dangerDark }]}>{expiry.label}</Text>
        <View style={es.bar}><View style={[es.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} /></View>
      </View>
      <View style={[es.qty, { backgroundColor: iconBg }]}>
        <Text style={[es.qtyText, { color: barColor }]}>{medicine.remainingQuantity} шт</Text>
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

  const OPTIONS = [
    { emoji: '📷', bg: '#C8E8FF', title: 'Сканировать упаковку', subtitle: 'Штрих-код или фото', onPress: () => Alert.alert('Скоро', 'Функция в разработке') },
    { emoji: '✏️', bg: '#C8FFD8', title: 'Ввести вручную', subtitle: 'Название, форма, количество, срок', onPress: () => navigation.navigate('ManualEntry', { kitId }) },
  ];

  return (
    <SafeAreaView style={as.root}>
      <ScrollView contentContainerStyle={as.scroll}>
        <Text style={as.title}>Добавить препарат</Text>
        <Text style={as.sub}>Выберите способ добавления</Text>
        {OPTIONS.map(o => (
          <TouchableOpacity key={o.title} style={as.option} onPress={o.onPress} activeOpacity={0.85}>
            <View style={[as.optIcon, { backgroundColor: o.bg }]}><Text style={{ fontSize: 24 }}>{o.emoji}</Text></View>
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

const FORMS: { value: MedicineForm; label: string; emoji: string }[] = [
  { value: 'tablets', label: 'Таблетки', emoji: '💊' },
  { value: 'capsules', label: 'Капсулы', emoji: '💊' },
  { value: 'syrup', label: 'Сироп', emoji: '🍯' },
  { value: 'spray', label: 'Спрей', emoji: '💨' },
  { value: 'drops', label: 'Капли', emoji: '💧' },
  { value: 'other', label: 'Другое', emoji: '🩺' },
];

export function ManualEntryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kitId: string = route.params?.kitId ?? 'kit-1';
  const addMedicine = useAppStore(s => s.addMedicine);
  const kits = useAppStore(s => s.kits);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicineForm>('tablets');
  const [totalQty, setTotalQty] = useState('');
  const [remainingQty, setRemainingQty] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedKitId, setSelectedKitId] = useState(kitId);

  function handleSave() {
    if (!name.trim()) { Alert.alert('Укажите название'); return; }
    if (!expiryDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Формат даты: ГГГГ-ММ-ДД'); return; }
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
        <Text style={me.sec}>Основное</Text>
        <View style={me.card}>
          <MeField label="Название *" placeholder="Амброксол" value={name} onChange={setName} />
          <MeField label="Дозировка" placeholder="30 мг" value={dosage} onChange={setDosage} />
        </View>

        <Text style={me.sec}>Форма</Text>
        <View style={[me.card, { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }]}>
          {FORMS.map(f => (
            <TouchableOpacity key={f.value} style={[me.formPill, form === f.value && me.formPillActive]} onPress={() => setForm(f.value)} activeOpacity={0.8}>
              <Text style={{ fontSize: 16 }}>{f.emoji}</Text>
              <Text style={[me.formPillText, form === f.value && { color: Colors.white }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={me.sec}>Количество и срок</Text>
        <View style={me.card}>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1 }}><MeField label="Всего в уп." placeholder="20" value={totalQty} onChange={setTotalQty} keyboard="number-pad" /></View>
            <View style={{ flex: 1 }}><MeField label="Осталось" placeholder="12" value={remainingQty} onChange={setRemainingQty} keyboard="number-pad" /></View>
          </View>
          <MeField label="Срок годности *" placeholder="2026-06-12" value={expiryDate} onChange={setExpiryDate} />
        </View>

        <Text style={me.sec}>Заметки</Text>
        <View style={me.card}>
          <MeField label="Заметки" placeholder="Хранить при t° до 25°C…" value={notes} onChange={setNotes} multi />
        </View>

        <Text style={me.sec}>Аптечка</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg }}>
          {kits.map(k => (
            <TouchableOpacity key={k.id} style={[me.kitChip, selectedKitId === k.id && me.kitChipActive]} onPress={() => setSelectedKitId(k.id)} activeOpacity={0.8}>
              <Text style={{ fontSize: 16 }}>{k.icon}</Text>
              <Text style={[me.kitChipText, selectedKitId === k.id && { color: Colors.blueDark }]}>{k.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={me.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={me.saveBtnText}>💾 Сохранить</Text>
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

const ROLE_LABELS: Record<KitAccessRole, string> = {
  owner: 'Владелец', editor: 'Редактор', viewer: 'Просмотр', synced: 'Синк',
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
      <Text style={{ padding: 20, color: C.textPrimary }}>Аптечка не найдена</Text>
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
              <Text style={{ fontSize: 36 }}>🔲</Text>
              <Text style={sk.qrHint}>QR-код</Text>
            </View>
          )}
          <Text style={sk.kitName}>{kit.icon} {kit.name}</Text>
          <Text style={sk.kitSub}>{kit.members.length} участник{kit.members.length !== 1 ? 'а' : ''}</Text>
          <Text style={sk.shareUrlText} numberOfLines={1}>{shareUrl}</Text>
        </View>

        {/* ── Share buttons ── */}
        <TouchableOpacity style={[sk.shareBtn, sk.tgBtn]} onPress={() => handleShareApp('telegram')} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>✈️</Text>
          <Text style={sk.shareBtnText}>{t('share_telegram')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sk.shareBtn, sk.waBtn]} onPress={() => handleShareApp('whatsapp')} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>💬</Text>
          <Text style={sk.shareBtnText}>{t('share_whatsapp')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sk.shareBtn, sk.copyBtn]} onPress={handleCopyLink} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>{linkCopied ? '✅' : '🔗'}</Text>
          <Text style={[sk.shareBtnText, { color: C.blue }]}>
            {linkCopied ? t('link_copied') : t('copy_link')}
          </Text>
        </TouchableOpacity>

        {/* ── Invite by nickname ── */}
        <View style={sk.card}>
          <Text style={sk.cardTitle}>{t('invite_nickname')}</Text>
          <Text style={sk.cardSub}>Пользователь должен быть у вас в контактах</Text>
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
                  {ROLE_LABELS[m.role]}
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
  if (!kit) return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }}><Text style={{ padding: 20 }}>Не найдено</Text></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgPage }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.lg }}>
          Участники аптечки
        </Text>
        {kit.members.map(m => (
          <View key={m.userId} style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.white }}>{m.avatarInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary }}>{m.name}</Text>
              <Text style={{ fontSize: Typography.size.xs, color: Colors.textSecondary }}>{m.syncStatus === 'active' ? '🟢 Активен' : '🔴 Отключён'}</Text>
            </View>
            <View style={{ backgroundColor: Colors.blueLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill }}>
              <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: Colors.blueDark }}>
                {{ owner: 'Владелец', editor: 'Редактор', viewer: 'Просмотр', synced: 'Синк' }[m.role]}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CreateEditKitScreen ──────────────────────────────────────────────────────

const ICONS_LIST = ['🏡', '🏠', '👨‍👩‍👧', '🌿', '🚗', '🏖', '💼', '⛺️', '🏥', '🧳'];
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
  const [name, setName] = useState(existingKit?.name ?? '');
  const [description, setDescription] = useState(existingKit?.description ?? '');
  const [icon, setIcon] = useState(existingKit?.icon ?? '🏡');
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
          <Text style={{ fontSize: 52, marginBottom: Spacing.sm }}>{icon}</Text>
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
              <Text style={{ fontSize: 24 }}>{ic}</Text>
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
            <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary }}>🔒 Личная аптечка</Text>
            <Text style={{ fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 2 }}>Только вы можете видеть</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: Colors.blue, false: Colors.border }} thumbColor={Colors.white} />
        </View>
        <TouchableOpacity style={ck.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={ck.saveBtnText}>{isEditing ? '💾 Сохранить' : '✅ Создать аптечку'}</Text>
        </TouchableOpacity>
        {isEditing && (
          <TouchableOpacity style={{ padding: Spacing.lg, alignItems: 'center' }} onPress={handleDelete} activeOpacity={0.8}>
            <Text style={{ fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.danger }}>🗑️ Удалить аптечку</Text>
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
          <Text style={{ fontSize: 44 }}>⚗️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.dangerDark }}>Совместимость</Text>
            <Text style={{ fontSize: Typography.size.body, color: Colors.dangerDark, marginTop: 2 }}>{medicine.name}</Text>
          </View>
        </View>
        {medicine.incompatibleWith && medicine.incompatibleWith.length > 0 ? (
          medicine.incompatibleWith.map((item, i) => (
            <View key={i} style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.danger, ...Shadow.card }}>
              <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🚫</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary, marginBottom: 4 }}>{item}</Text>
                <Text style={{ fontSize: Typography.size.body, color: Colors.textSecondary, lineHeight: 20 }}>Одновременный приём может снизить эффективность или вызвать нежелательные реакции.</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: Spacing.xxxl, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, ...Shadow.card }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
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
  const user        = useAppStore(s => s.user);
  const updateUser  = useAppStore(s => s.updateUser);
  const kits        = useAppStore(s => s.kits);

  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(user.name);
  const [surname,  setSurname]  = useState(user.surname ?? '');
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [email,    setEmail]    = useState(user.email ?? '');

  function handleSave() {
    const trimName    = name.trim();
    const trimNick    = nickname.trim().replace(/^@/, '');
    if (!trimName) { Alert.alert('Укажите имя'); return; }
    const words    = [trimName, surname.trim()].filter(Boolean);
    const initials = words.map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
    updateUser({
      name:     trimName,
      surname:  surname.trim() || undefined,
      nickname: trimNick || undefined,
      email:    email.trim() || undefined,
      avatarInitials: initials || trimName.slice(0, 2).toUpperCase(),
    });
    setEditing(false);
  }

  const displayName = [user.name, user.surname].filter(Boolean).join(' ');
  const nickDisplay = user.nickname ? `@${user.nickname}` : 'Никнейм не задан';

  if (editing) {
    return (
      <SafeAreaView style={[ps.root]}>
        <ScrollView contentContainerStyle={ps.scroll}>
          <Text style={ps.label}>Имя</Text>
          <TextInput style={ps.input} placeholder="Имя" placeholderTextColor={C.textTertiary} value={name} onChangeText={setName} />
          <Text style={ps.label}>Фамилия</Text>
          <TextInput style={ps.input} placeholder="Фамилия" placeholderTextColor={C.textTertiary} value={surname} onChangeText={setSurname} />
          <Text style={ps.label}>Никнейм</Text>
          <TextInput style={ps.input} placeholder="@nickname" placeholderTextColor={C.textTertiary} value={nickname} onChangeText={tt => setNickname(tt.startsWith('@') ? tt : `@${tt}`)} autoCapitalize="none" />
          <Text style={ps.label}>E-mail</Text>
          <TextInput style={ps.input} placeholder="email@example.com" placeholderTextColor={C.textTertiary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TouchableOpacity style={ps.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={ps.saveBtnText}>Сохранить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', padding: Spacing.md }} onPress={() => setEditing(false)}>
            <Text style={{ fontSize: Typography.size.base, color: C.textSecondary }}>Отмена</Text>
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

        {[
          { emoji: '🏠', label: `Мои аптечки (${kits.length})`, onPress: () => {} },
          { emoji: '✏️', label: 'Редактировать профиль', onPress: () => setEditing(true) },
          { emoji: '👥', label: 'Контакты', onPress: () => navigation.navigate('Persons') },
          { emoji: '📅', label: 'Сроки годности', onPress: () => navigation.navigate('Expiry') },
          { emoji: '⚙️', label: 'Настройки', onPress: () => navigation.navigate('Settings') },
          { emoji: '❓', label: 'Помощь', onPress: () => navigation.navigate('Support') },
        ].map((item, i, arr) => (
          <View key={item.label}>
            <TouchableOpacity style={ps.row} onPress={item.onPress} activeOpacity={0.8}>
              <Text style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{item.emoji}</Text>
              <Text style={ps.rowText}>{item.label}</Text>
              <Icon name="chevron-right" size={20} color={C.textTertiary} />
            </TouchableOpacity>
            {i < arr.length - 1 && <View style={ps.divider} />}
          </View>
        ))}
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
  { key: 'light',  emoji: '☀️' },
  { key: 'dark',   emoji: '🌙' },
  { key: 'system', emoji: '📱' },
] as const;

const LANGUAGES: { key: 'en' | 'ru' | 'tr' | 'ro'; flag: string; name: string }[] = [
  { key: 'en', flag: '🇬🇧', name: 'English' },
  { key: 'ru', flag: '🇷🇺', name: 'Русский' },
  { key: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { key: 'ro', flag: '🇷🇴', name: 'Română' },
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
    { emoji: '🔔', key: 'pushEnabled'                  as const, label: t('push_enabled') },
    { emoji: '📦', key: 'lowStockEnabled'              as const, label: t('low_stock_enabled') },
    { emoji: '👥', key: 'kitActivityEnabled'           as const, label: t('kit_activity_enabled') },
    { emoji: '⚠️', key: 'interactionWarningsEnabled'  as const, label: t('interaction_warnings_enabled') },
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
                <Text style={{ fontSize: 20, width: 30, textAlign: 'center' }}>{th.emoji}</Text>
                <Text style={stg.rowLabel}>{t(`theme_${th.key}` as any)}</Text>
                <View style={[stg.radio, settings.theme === th.key && stg.radioActive]}>
                  {settings.theme === th.key && <View style={stg.radioDot} />}
                </View>
              </TouchableOpacity>
              {i < THEMES.length - 1 && <View style={stg.div} />}
            </View>
          ))}
        </View>

        {/* ── Language ── */}
        <Text style={stg.sec}>{t('language')}</Text>
        <View style={stg.card}>
          {LANGUAGES.map((lang, i) => (
            <View key={lang.key}>
              <TouchableOpacity style={stg.row} onPress={() => update({ language: lang.key })} activeOpacity={0.8}>
                <Text style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{lang.flag}</Text>
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
                <Text style={{ fontSize: 18, width: 30, textAlign: 'center' }}>{item.emoji}</Text>
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
