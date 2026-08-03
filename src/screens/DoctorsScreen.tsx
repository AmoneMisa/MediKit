import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, Image, Share, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { searchDoctorsCatalog, contributeDoctorToCatalog } from '../api';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';
import type { Doctor, CatalogDoctor } from '../types';

let launchImageLibrary: any;
let launchCamera: any;
try {
  const ip = require('react-native-image-picker');
  launchImageLibrary = ip.launchImageLibrary;
  launchCamera       = ip.launchCamera;
} catch {}

// ─── Specialities ─────────────────────────────────────────────────────────────

const ALL_SPECIALITIES = [
  'Allergist', 'Anesthesiologist', 'Cardiologist', 'Dentist',
  'Dermatologist', 'Dietitian', 'Emergency Medicine', 'ENT',
  'Endocrinologist', 'Family Medicine', 'Gastroenterologist',
  'Gynecologist', 'Hematologist', 'Hepatologist', 'Immunologist',
  'Infectologist', 'Nephrologist', 'Neurologist', 'Oncologist',
  'Ophthalmologist', 'Orthopedist', 'Pediatrician', 'Physiotherapist',
  'Psychiatrist', 'Psychologist', 'Pulmonologist', 'Radiologist',
  'Rheumatologist', 'Surgeon', 'Therapist', 'Urologist',
  'Hospital', 'Clinic', 'Other',
];

/** Maps English DB value → i18n translation key. Falls back to the English name. */
const SPEC_KEY: Record<string, string> = {
  'Allergist': 'spec_allergist', 'Anesthesiologist': 'spec_anesthesiologist',
  'Cardiologist': 'spec_cardiologist', 'Dentist': 'spec_dentist',
  'Dermatologist': 'spec_dermatologist', 'Dietitian': 'spec_dietitian',
  'Emergency Medicine': 'spec_emergency_medicine', 'ENT': 'spec_ent',
  'Endocrinologist': 'spec_endocrinologist', 'Family Medicine': 'spec_family_medicine',
  'Gastroenterologist': 'spec_gastroenterologist', 'Gynecologist': 'spec_gynecologist',
  'Hematologist': 'spec_hematologist', 'Hepatologist': 'spec_hepatologist',
  'Immunologist': 'spec_immunologist', 'Infectologist': 'spec_infectologist',
  'Nephrologist': 'spec_nephrologist', 'Neurologist': 'spec_neurologist',
  'Oncologist': 'spec_oncologist', 'Ophthalmologist': 'spec_ophthalmologist',
  'Orthopedist': 'spec_orthopedist', 'Pediatrician': 'spec_pediatrician',
  'Physiotherapist': 'spec_physiotherapist', 'Psychiatrist': 'spec_psychiatrist',
  'Psychologist': 'spec_psychologist', 'Pulmonologist': 'spec_pulmonologist',
  'Radiologist': 'spec_radiologist', 'Rheumatologist': 'spec_rheumatologist',
  'Surgeon': 'spec_surgeon', 'Therapist': 'spec_therapist',
  'Urologist': 'spec_urologist', 'Hospital': 'spec_hospital',
  'Clinic': 'spec_clinic', 'Other': 'spec_other',
};

function specLabel(t: ReturnType<typeof useT>, spec: string): string {
  const key = SPEC_KEY[spec];
  return key ? (t as any)(key) || spec : spec;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 60 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg,
      marginBottom: Spacing.md, gap: Spacing.sm,
    },
    title:  { flex: 1, fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },

    // Search bar
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      borderWidth: 1.5, borderColor: C.border,
      marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md, gap: Spacing.sm,
      ...Shadow.sm,
    },
    searchInput: { flex: 1, fontSize: Typography.size.md, color: C.textPrimary, height: 44 },

    // Filter pills
    filterRow: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, flexGrow: 0 },

    // Doctor card
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
      ...Shadow.card, overflow: 'hidden',
    },
    cardInner: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: Spacing.md },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.bgCardAlt, alignItems: 'center', justifyContent: 'center' },
    avatarPhoto: { width: 56, height: 56, borderRadius: 28 },
    avatarText: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.blue },
    cardBody:   { flex: 1 },
    cardName:   { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.textPrimary },
    cardSpec:   { fontSize: Typography.size.body, color: C.blue, fontWeight: Typography.weight.semibold, marginTop: 2 },
    cardSub:    { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },
    cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.borderLight },
    cardAction:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, flexDirection: 'row', gap: 4 },
    cardActionText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.textSecondary },
    cardActionSep:  { width: 1, backgroundColor: C.borderLight },
    freeBadge: {
      backgroundColor: C.successLight, paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: Radius.pill, alignSelf: 'flex-start', marginTop: 4,
    },
    freeBadgeText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.successDark },
    payBadge:      { backgroundColor: C.accentLight },
    payBadgeText:  { color: C.accent },

    // Form
    formCard: { backgroundColor: C.bgCard, borderRadius: Radius.xl, ...Shadow.card, marginBottom: Spacing.sm, overflow: 'hidden' },
    sec:  {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: Spacing.sm, marginTop: Spacing.lg,
    },
    label: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textSecondary, marginBottom: 4,
    },
    input: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, height: 44,
      fontSize: Typography.size.md, color: C.textPrimary,
    },
    inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: Spacing.sm },
    fieldWrap:  { marginBottom: Spacing.md },
    row2:       { flexDirection: 'row', gap: Spacing.sm },
    flex1:      { flex: 1 },

    chip: {
      paddingHorizontal: Spacing.md, paddingVertical: 7,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.bgCard, marginRight: Spacing.xs, marginBottom: Spacing.xs,
    },
    chipActive: { backgroundColor: C.blue, borderColor: C.blue },
    chipText:   { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textSecondary },
    chipTextA:  { color: C.white },

    toggleRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm,
    },
    toggleLabel: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: C.textPrimary },

    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl,
      padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.md, ...Shadow.card,
    },
    saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.white },
    deleteBtn:   { alignItems: 'center', padding: Spacing.md, marginTop: Spacing.xs },
    deleteBtnText: { fontSize: Typography.size.md, color: C.danger, fontWeight: Typography.weight.semibold },

    photoSection: { alignItems: 'center', paddingVertical: Spacing.md },
    photoThumb:   { width: 100, height: 100, borderRadius: 50, marginBottom: Spacing.md },
    photoPlaceholder: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: C.bgCardAlt, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
    },
    photoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingVertical: 7,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.blue,
    },
    photoBtnText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.blue },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    emptyText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.textPrimary, marginTop: Spacing.md },
    emptySub:  { fontSize: Typography.size.body, color: C.textSecondary, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xl },

    selectionBar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.blue, borderRadius: Radius.xl,
      marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
      padding: Spacing.sm, gap: Spacing.sm,
    },
    selectionText: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.white },
  });
}

// ─── SpecialityPickerModal ─────────────────────────────────────────────────────

function SpecialityPickerModal({ visible, value, onSelect, onClose, includeAll = false }: {
  visible: boolean;
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  includeAll?: boolean;
}) {
  const C = useColors();
  const t = useT();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = includeAll ? ['', ...ALL_SPECIALITIES] : ALL_SPECIALITIES;
    return base.filter(s => s.toLowerCase().includes(q));
  }, [search, includeAll]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm }}>
          <Icon name="magnify" size={18} color={C.textTertiary} />
          <TextInput
            style={{ flex: 1, fontSize: Typography.size.md, color: C.textPrimary, height: 40 }}
            placeholder={t('doc_spec_search_ph')}
            placeholderTextColor={C.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={{ height: 1, backgroundColor: C.borderLight }} />
        <FlatList
          data={filtered}
          keyExtractor={s => s || '__all__'}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const label = item === '' ? t('doc_filter_all') : specLabel(t, item);
            const active = value === item;
            return (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight }}
                onPress={() => { onSelect(item); setSearch(''); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={{ flex: 1, fontSize: Typography.size.md, color: active ? C.blue : C.textPrimary, fontWeight: active ? Typography.weight.bold : Typography.weight.regular as any }}>
                  {label}
                </Text>
                {active && <Icon name="check" size={18} color={C.blue} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ─── DoctorAvatar ─────────────────────────────────────────────────────────────

function DoctorAvatar({ doctor, size = 56, style }: { doctor: Doctor; size?: number; style?: any }) {
  const C = useColors();
  if (doctor.photoUri) {
    return <Image source={{ uri: doctor.photoUri }} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
  }
  const initials = doctor.name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.35, fontWeight: '800', color: C.blue }}>{initials}</Text>
    </View>
  );
}

// ─── DoctorCard ───────────────────────────────────────────────────────────────

function DoctorCard({
  doctor, selected, onPress, onLongPress, onEdit, onShare, onAppointments,
}: {
  doctor: Doctor;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onEdit: () => void;
  onShare: () => void;
  onAppointments: () => void;
}) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const t = useT();

  const contactLine = [doctor.city, doctor.country].filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      style={[s.card, selected && { borderWidth: 2, borderColor: C.blue }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      <View style={s.cardInner}>
        <DoctorAvatar doctor={doctor} />
        <View style={s.cardBody}>
          <Text style={s.cardName}>{doctor.name}</Text>
          <Text style={s.cardSpec}>{specLabel(t, doctor.speciality)}{doctor.experienceYears ? `  ·  ${t('doc_experience_years').replace('{n}', String(doctor.experienceYears))}` : ''}</Text>
          {contactLine ? <Text style={s.cardSub}>{contactLine}</Text> : null}
          {doctor.phone ? (
            <View style={s.cardRow}>
              <Icon name="phone" size={12} color={C.textTertiary} />
              <Text style={s.cardSub}>{doctor.phone}</Text>
            </View>
          ) : null}
          {doctor.isFree !== undefined && (
            <View style={[s.freeBadge, doctor.isFree ? {} : s.payBadge]}>
              <Text style={[s.freeBadgeText, doctor.isFree ? {} : s.payBadgeText]}>
                {doctor.isFree ? t('doc_free') : (doctor.cost ? `${t('doc_paid')} · ${doctor.cost}` : t('doc_paid'))}
              </Text>
            </View>
          )}
        </View>
        {selected && <Icon name="check-circle" size={22} color={C.blue} />}
      </View>

      <View style={s.cardActions}>
        {doctor.whatsapp ? (
          <TouchableOpacity style={s.cardAction} activeOpacity={0.7}>
            <Icon name="whatsapp" size={16} color="#25D366" />
            <Text style={[s.cardActionText, { color: '#25D366' }]}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
        {doctor.telegram ? (
          <>
            {doctor.whatsapp ? <View style={s.cardActionSep} /> : null}
            <TouchableOpacity style={s.cardAction} activeOpacity={0.7}>
              <Icon name="send" size={14} color="#0088CC" />
              <Text style={[s.cardActionText, { color: '#0088CC' }]}>Telegram</Text>
            </TouchableOpacity>
          </>
        ) : null}
        <View style={s.cardActionSep} />
        <TouchableOpacity style={s.cardAction} onPress={onAppointments} activeOpacity={0.7}>
          <Icon name="calendar-clock" size={14} color={C.blue} />
          <Text style={[s.cardActionText, { color: C.blue }]}>{t('doc_appointments')}</Text>
        </TouchableOpacity>
        <View style={s.cardActionSep} />
        <TouchableOpacity style={s.cardAction} onPress={onEdit} activeOpacity={0.7}>
          <Icon name="pencil" size={14} color={C.textSecondary} />
          <Text style={s.cardActionText}>{t('edit')}</Text>
        </TouchableOpacity>
        <View style={s.cardActionSep} />
        <TouchableOpacity style={s.cardAction} onPress={onShare} activeOpacity={0.7}>
          <Icon name="share-variant" size={14} color={C.textSecondary} />
          <Text style={s.cardActionText}>{t('share_kit')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── DoctorsListScreen ────────────────────────────────────────────────────────

export function DoctorsListScreen() {
  const navigation = useNavigation<any>();
  const C = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(C), [C]);

  const doctors      = useAppStore(state => state.doctors);
  const deleteDoctor = useAppStore(state => state.deleteDoctor);

  const [query,        setQuery]        = useState('');
  const [filterSpec,   setFilterSpec]   = useState<string | null>(null);
  const [filterPaid,   setFilterPaid]   = useState<'all' | 'free' | 'paid'>('all');
  const [selected,     setSelected]     = useState<string[]>([]);
  const selecting = selected.length > 0;

  const filtered = useMemo(() => {
    let list = doctors;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.speciality.toLowerCase().includes(q) ||
        (d.city ?? '').toLowerCase().includes(q),
      );
    }
    if (filterSpec) list = list.filter(d => d.speciality === filterSpec);
    if (filterPaid === 'free') list = list.filter(d => d.isFree === true);
    if (filterPaid === 'paid') list = list.filter(d => d.isFree === false);
    return list;
  }, [doctors, query, filterSpec, filterPaid]);

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleDoctorPress(id: string) {
    if (selecting) { toggleSelect(id); return; }
  }

  function buildShareText(docs: Doctor[]): string {
    return docs.map(d => {
      const lines = [`🩺 ${d.name} (${d.speciality})`];
      if (d.phone)    lines.push(`📞 ${d.phone}`);
      if (d.email)    lines.push(`✉️ ${d.email}`);
      if (d.whatsapp) lines.push(`💬 WhatsApp: ${d.whatsapp}`);
      if (d.telegram) lines.push(`✈️ Telegram: ${d.telegram}`);
      if (d.address)  lines.push(`📍 ${[d.address, d.city, d.country].filter(Boolean).join(', ')}`);
      if (d.isFree !== undefined) lines.push(d.isFree ? '✅ Free' : `💰 Paid${d.cost ? ` · ${d.cost}` : ''}`);
      if (d.notes)    lines.push(`📝 ${d.notes}`);
      return lines.join('\n');
    }).join('\n\n---\n\n');
  }

  async function handleShareSelected() {
    const docs = doctors.filter(d => selected.includes(d.id));
    const text = buildShareText(docs);
    await Share.share({ message: text, title: t('doc_share_title') });
    setSelected([]);
  }

  async function handleShareOne(doc: Doctor) {
    const text = buildShareText([doc]);
    await Share.share({ message: text, title: doc.name });
  }

  function handleDeleteSelected() {
    Alert.alert(
      t('delete'),
      t('doc_delete_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: () => { selected.forEach(id => deleteDoctor(id)); setSelected([]); },
        },
      ],
    );
  }

  const specs = useMemo(() =>
    [...new Set(doctors.map(d => d.speciality))].sort(),
  [doctors]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{t('doc_title')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('DoctorCatalog')}
          style={{ backgroundColor: C.bgCard, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: C.border }}
          activeOpacity={0.85}
        >
          <Icon name="earth" size={16} color={C.blue} />
          <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: C.blue }}>{t('doc_catalog_btn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('DoctorForm', {})}
          style={{ backgroundColor: C.blue, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={18} color="#fff" />
          <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: '#fff' }}>{t('add')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Icon name="magnify" size={20} color={C.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder={t('doc_search_ph')}
          placeholderTextColor={C.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query ? <TouchableOpacity onPress={() => setQuery('')}><Icon name="close" size={18} color={C.textTertiary} /></TouchableOpacity> : null}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.lg, alignItems: 'center' }}>
        {(['all', 'free', 'paid'] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilterPaid(f)}
            style={[s.chip, filterPaid === f && s.chipActive]}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, filterPaid === f && s.chipTextA]}>{t(`doc_filter_${f}`)}</Text>
          </TouchableOpacity>
        ))}
        {specs.map(spec => (
          <TouchableOpacity
            key={spec}
            onPress={() => setFilterSpec(filterSpec === spec ? null : spec)}
            style={[s.chip, filterSpec === spec && s.chipActive]}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, filterSpec === spec && s.chipTextA]}>{specLabel(t, spec)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Multi-select bar */}
      {selecting && (
        <View style={s.selectionBar}>
          <TouchableOpacity onPress={() => setSelected([])}>
            <Icon name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.selectionText}>{selected.length} {t('doc_selected')}</Text>
          <TouchableOpacity onPress={handleShareSelected} style={{ padding: 4 }}>
            <Icon name="share-variant" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteSelected} style={{ padding: 4 }}>
            <Icon name="delete" size={20} color="#FFAAAA" />
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Icon name="doctor" size={54} color={C.textTertiary} />
          <Text style={s.emptyText}>{doctors.length === 0 ? t('doc_empty_title') : t('doc_no_results')}</Text>
          <Text style={s.emptySub}>{doctors.length === 0 ? t('doc_empty_sub') : t('doc_no_results_sub')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={d => d.id}
          contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <DoctorCard
              doctor={item}
              selected={selected.includes(item.id)}
              onPress={() => handleDoctorPress(item.id)}
              onLongPress={() => toggleSelect(item.id)}
              onEdit={() => navigation.navigate('DoctorForm', { doctorId: item.id })}
              onShare={() => handleShareOne(item)}
              onAppointments={() => navigation.navigate('Appointments', { doctorId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── DoctorFormScreen ─────────────────────────────────────────────────────────

export function DoctorFormScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const doctorId   = route.params?.doctorId as string | undefined;

  const C = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(C), [C]);

  const doctors      = useAppStore(state => state.doctors);
  const addDoctor    = useAppStore(state => state.addDoctor);
  const updateDoctor = useAppStore(state => state.updateDoctor);
  const deleteDoctor = useAppStore(state => state.deleteDoctor);

  const existing = doctorId ? doctors.find(d => d.id === doctorId) : undefined;

  const [name,       setName]       = useState(existing?.name ?? '');
  const [speciality, setSpeciality] = useState(existing?.speciality ?? '');
  const [phone,      setPhone]      = useState(existing?.phone ?? '');
  const [email,      setEmail]      = useState(existing?.email ?? '');
  const [address,    setAddress]    = useState(existing?.address ?? '');
  const [city,       setCity]       = useState(existing?.city ?? '');
  const [country,    setCountry]    = useState(existing?.country ?? '');
  const [languages,  setLanguages]  = useState<string[]>(existing?.languages ?? []);
  const [isFree,          setIsFree]          = useState<boolean | undefined>(existing?.isFree);
  const [cost,            setCost]            = useState(existing?.cost ?? '');
  const [whatsapp,        setWhatsapp]        = useState(existing?.whatsapp ?? '');
  const [telegram,        setTelegram]        = useState(existing?.telegram ?? '');
  const [viber,           setViber]           = useState(existing?.viber ?? '');
  const [experienceYears, setExperienceYears] = useState(existing?.experienceYears?.toString() ?? '');
  const [notes,           setNotes]           = useState(existing?.notes ?? '');
  const [photoUri,        setPhotoUri]        = useState(existing?.photoUri ?? '');

  const [langInput,  setLangInput]  = useState('');
  const [specModalVisible, setSpecModalVisible] = useState(false);

  async function handlePhoto() {
    if (!launchImageLibrary) return;
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 600, maxHeight: 600 });
    if (res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
  }

  function toggleLanguage(lang: string) {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  }

  function addCustomLang() {
    const l = langInput.trim();
    if (l && !languages.includes(l)) setLanguages(prev => [...prev, l]);
    setLangInput('');
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert(t('doc_name_required')); return; }
    if (!speciality)  { Alert.alert(t('doc_spec_required')); return; }

    const now = new Date().toISOString();
    const expNum = parseInt(experienceYears, 10);
    const data: Omit<Doctor, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      speciality,
      phone:           phone.trim() || undefined,
      email:           email.trim() || undefined,
      address:         address.trim() || undefined,
      city:            city.trim() || undefined,
      country:         country.trim() || undefined,
      languages:       languages.length > 0 ? languages : undefined,
      isFree,
      cost:            cost.trim() || undefined,
      whatsapp:        whatsapp.trim() || undefined,
      telegram:        telegram.trim() || undefined,
      viber:           viber.trim() || undefined,
      experienceYears: !isNaN(expNum) && expNum > 0 ? expNum : undefined,
      notes:           notes.trim() || undefined,
      photoUri:        photoUri || undefined,
    };

    if (existing && doctorId) {
      updateDoctor(doctorId, data);
    } else {
      addDoctor({ id: `doc-${Date.now()}`, ...data, createdAt: now, updatedAt: now });
    }
    navigation.goBack();
  }

  function handleDelete() {
    Alert.alert(t('delete'), t('doc_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: () => { deleteDoctor(doctorId!); navigation.goBack(); },
      },
    ]);
  }

  const LANGS = ['English', 'Russian', 'Turkish', 'Romanian', 'Arabic', 'German', 'French', 'Spanish', 'Ukrainian'];

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Photo */}
          <View style={s.photoSection}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photoThumb} resizeMode="cover" />
            ) : (
              <View style={s.photoPlaceholder}>
                <Icon name="doctor" size={36} color={C.textTertiary} />
              </View>
            )}
            <TouchableOpacity style={s.photoBtn} onPress={handlePhoto} activeOpacity={0.8}>
              <Icon name="camera" size={14} color={C.blue} />
              <Text style={s.photoBtnText}>{photoUri ? t('me_gallery') : t('doc_add_photo')}</Text>
            </TouchableOpacity>
            {photoUri ? (
              <TouchableOpacity onPress={() => setPhotoUri('')} style={{ marginTop: 4 }}>
                <Text style={{ fontSize: Typography.size.body, color: C.danger }}>{t('me_remove_photo')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Basic */}
          <Text style={s.sec}>{t('me_basic')}</Text>
          <View style={s.formCard}>
            <View style={{ padding: Spacing.md }}>
              <FormField label={t('doc_name')} value={name} onChangeText={setName} placeholder="Dr. John Smith" s={s} C={C} />
            </View>
          </View>

          {/* Speciality */}
          <Text style={s.sec}>{t('doc_speciality')}</Text>
          <TouchableOpacity
            style={[s.formCard, { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginBottom: Spacing.sm }]}
            onPress={() => setSpecModalVisible(true)}
            activeOpacity={0.8}
          >
            <Icon name="stethoscope" size={18} color={C.textSecondary} style={{ marginRight: Spacing.sm }} />
            <Text style={{ flex: 1, fontSize: Typography.size.md, color: speciality ? C.textPrimary : C.textTertiary }}>
              {speciality ? specLabel(t, speciality) : t('doc_spec_select')}
            </Text>
            <Icon name="chevron-right" size={20} color={C.textTertiary} />
          </TouchableOpacity>
          <SpecialityPickerModal
            visible={specModalVisible}
            value={speciality}
            onSelect={setSpeciality}
            onClose={() => setSpecModalVisible(false)}
          />

          {/* Experience */}
          <Text style={s.sec}>{t('doc_experience_label')}</Text>
          <View style={s.formCard}>
            <View style={{ padding: Spacing.md }}>
              <FormField
                label={t('doc_experience_label')}
                value={experienceYears}
                onChangeText={v => setExperienceYears(v.replace(/[^0-9]/g, ''))}
                placeholder={t('doc_experience_ph')}
                keyboardType="numeric"
                s={s} C={C}
              />
            </View>
          </View>

          {/* Contact */}
          <Text style={s.sec}>{t('doc_contact')}</Text>
          <View style={s.formCard}>
            <View style={{ padding: Spacing.md, gap: Spacing.md }}>
              <FormField label={t('doc_phone')} value={phone} onChangeText={setPhone} placeholder="+1 234 567 8900" keyboardType="phone-pad" s={s} C={C} />
              <FormField label={t('doc_email')} value={email} onChangeText={setEmail} placeholder="doctor@clinic.com" keyboardType="email-address" s={s} C={C} />
            </View>
          </View>

          {/* Location */}
          <Text style={s.sec}>{t('doc_location')}</Text>
          <View style={s.formCard}>
            <View style={{ padding: Spacing.md, gap: Spacing.md }}>
              <FormField label={t('doc_address')} value={address} onChangeText={setAddress} placeholder={t('doc_address_ph')} s={s} C={C} />
              <View style={s.row2}>
                <View style={s.flex1}>
                  <FormField label={t('doc_city')} value={city} onChangeText={setCity} placeholder={t('doc_city_ph')} s={s} C={C} />
                </View>
                <View style={s.flex1}>
                  <FormField label={t('doc_country')} value={country} onChangeText={setCountry} placeholder={t('doc_country_ph')} s={s} C={C} />
                </View>
              </View>
            </View>
          </View>

          {/* Languages */}
          <Text style={s.sec}>{t('doc_languages')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm }}>
            {LANGS.map(l => (
              <TouchableOpacity
                key={l}
                onPress={() => toggleLanguage(l)}
                style={[s.chip, languages.includes(l) && s.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, languages.includes(l) && s.chipTextA]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm }}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={langInput}
              onChangeText={setLangInput}
              placeholder={t('doc_lang_custom')}
              placeholderTextColor={C.textTertiary}
              onSubmitEditing={addCustomLang}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={addCustomLang}
              style={{ backgroundColor: C.blue, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Pricing */}
          <Text style={s.sec}>{t('doc_pricing')}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm }}>
            {([undefined, true, false] as const).map(v => {
              const label = v === undefined ? t('doc_unspecified') : v ? t('doc_free') : t('doc_paid');
              const active = isFree === v;
              return (
                <TouchableOpacity key={String(v)} onPress={() => setIsFree(v)} style={[s.chip, active && s.chipActive]} activeOpacity={0.8}>
                  <Text style={[s.chipText, active && s.chipTextA]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isFree === false && (
            <View style={s.formCard}>
              <View style={{ padding: Spacing.md }}>
                <FormField label={t('doc_cost')} value={cost} onChangeText={setCost} placeholder="50 USD / visit" s={s} C={C} />
              </View>
            </View>
          )}

          {/* Messengers */}
          <Text style={s.sec}>{t('doc_messengers')}</Text>
          <View style={s.formCard}>
            <View style={{ padding: Spacing.md, gap: Spacing.md }}>
              <FormField label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} placeholder="+1 234 567 8900" keyboardType="phone-pad" icon="whatsapp" iconColor="#25D366" s={s} C={C} />
              <FormField label="Telegram" value={telegram} onChangeText={setTelegram} placeholder="@username" icon="send" iconColor="#0088CC" s={s} C={C} />
              <FormField label="Viber"    value={viber}    onChangeText={setViber}    placeholder="+1 234 567 8900" keyboardType="phone-pad" icon="phone-in-talk" iconColor="#7360F2" s={s} C={C} />
            </View>
          </View>

          {/* Notes */}
          <Text style={s.sec}>{t('doc_notes')}</Text>
          <View style={s.formCard}>
            <View style={{ padding: Spacing.md }}>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('doc_notes_ph')}
                placeholderTextColor={C.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Save / Delete */}
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>{existing ? t('save') : t('doc_add_btn')}</Text>
          </TouchableOpacity>
          {existing && (
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteBtnText}>{t('doc_delete')}</Text>
            </TouchableOpacity>
          )}
          {existing && (
            <ContributeButton doctor={existing} />
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── FormField helper ─────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, keyboardType, multiline,
  icon, iconColor, s, C,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
  icon?: string; iconColor?: string;
  s: ReturnType<typeof makeStyles>; C: ColorPalette;
}) {
  return (
    <View style={s.fieldWrap}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {icon ? <Icon name={icon} size={13} color={iconColor ?? C.textTertiary} /> : null}
        <Text style={s.label}>{label}</Text>
      </View>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="none"
      />
    </View>
  );
}

// ─── ContributeButton ──────────────────────────────────────────────────────────

function ContributeButton({ doctor }: { doctor: Doctor }) {
  const C = useColors();
  const t = useT();
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);

  function handleContribute() {
    Alert.alert(
      t('doc_contribute'),
      t('doc_contribute_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('doc_contribute'),
          onPress: async () => {
            setBusy(true);
            try {
              await contributeDoctorToCatalog({
                name: doctor.name, speciality: doctor.speciality,
                phone: doctor.phone, email: doctor.email,
                address: doctor.address, city: doctor.city, country: doctor.country,
                languages: doctor.languages, isFree: doctor.isFree, cost: doctor.cost,
                whatsapp: doctor.whatsapp, telegram: doctor.telegram, viber: doctor.viber,
                photoUri: doctor.photoUri, experienceYears: doctor.experienceYears,
                notes: doctor.notes,
              });
              setDone(true);
            } catch { Alert.alert(t('pf_try_again')); }
            setBusy(false);
          },
        },
      ],
    );
  }

  return (
    <TouchableOpacity
      style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, padding: Spacing.md }}
      onPress={handleContribute}
      disabled={busy || done}
      activeOpacity={0.7}
    >
      {busy
        ? <ActivityIndicator color={C.blue} size="small" />
        : <Icon name={done ? 'check-circle' : 'earth-plus'} size={16} color={done ? C.success : C.blue} />}
      <Text style={{ fontSize: Typography.size.body, color: done ? C.success : C.blue, fontWeight: Typography.weight.semibold }}>
        {done ? t('doc_contributed') : t('doc_contribute')}
      </Text>
    </TouchableOpacity>
  );
}

// ─── DoctorCatalogScreen ───────────────────────────────────────────────────────

export function DoctorCatalogScreen() {
  const navigation = useNavigation<any>();
  const C = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(C), [C]);

  const myDoctors  = useAppStore(st => st.doctors);
  const addDoctor  = useAppStore(st => st.addDoctor);

  const [query,      setQuery]      = useState('');
  const [filterSpec, setFilterSpec] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState('');
  const [results,    setResults]    = useState<CatalogDoctor[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [addedIds,        setAddedIds]        = useState<Set<string>>(new Set());
  const [specModalVisible, setSpecModalVisible] = useState(false);

  const doSearch = useCallback(async (q = query, spec = filterSpec, city = filterCity) => {
    setLoading(true);
    try {
      const res = await searchDoctorsCatalog(q, spec ?? undefined, city || undefined);
      setResults(res);
    } catch { setResults([]); }
    setLoading(false);
  }, [query, filterSpec, filterCity]);

  // Auto-load on mount and when filters change
  useEffect(() => { void doSearch(); }, [filterSpec, filterCity]);

  function handleAdd(doc: CatalogDoctor) {
    const now = new Date().toISOString();
    addDoctor({
      id: `doc-${Date.now()}`,
      name: doc.name, speciality: doc.speciality,
      phone: doc.phone, email: doc.email,
      address: doc.address, city: doc.city, country: doc.country,
      languages: doc.languages, isFree: doc.isFree, cost: doc.cost,
      whatsapp: doc.whatsapp, telegram: doc.telegram, viber: doc.viber,
      photoUri: doc.photoUri, experienceYears: doc.experienceYears,
      notes: doc.notes,
      createdAt: now, updatedAt: now,
    });
    setAddedIds(prev => new Set([...prev, doc.id]));
  }

  const myNames = useMemo(() => new Set(myDoctors.map(d => d.name.toLowerCase())), [myDoctors]);

  return (
    <SafeAreaView style={s.root}>
      {/* Search bar */}
      <View style={[s.searchWrap, { marginTop: Spacing.md }]}>
        <Icon name="earth" size={20} color={C.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder={t('doc_catalog_search_ph')}
          placeholderTextColor={C.textTertiary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={doSearch}
          autoFocus
        />
        {query ? <TouchableOpacity onPress={() => setQuery('')}><Icon name="close" size={18} color={C.textTertiary} /></TouchableOpacity> : null}
        <TouchableOpacity onPress={doSearch} activeOpacity={0.8}>
          <Icon name="magnify" size={22} color={C.blue} />
        </TouchableOpacity>
      </View>

      {/* Filters row: speciality + city */}
      <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <TouchableOpacity
          style={[s.chip, !!filterSpec && s.chipActive, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
          onPress={() => setSpecModalVisible(true)}
          activeOpacity={0.8}
        >
          <Icon name="stethoscope" size={13} color={filterSpec ? '#fff' : C.textSecondary} />
          <Text style={[s.chipText, !!filterSpec && s.chipTextA]}>
            {filterSpec ? specLabel(t, filterSpec) : t('doc_filter_all')}
          </Text>
          {filterSpec
            ? <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPress={() => setFilterSpec(null)}><Icon name="close" size={12} color="#fff" /></TouchableOpacity>
            : null}
        </TouchableOpacity>

        <View style={[s.searchWrap, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
          <Icon name="map-marker-outline" size={15} color={C.textTertiary} />
          <TextInput
            style={[s.searchInput, { height: 36 }]}
            placeholder={t('doc_city_filter_ph')}
            placeholderTextColor={C.textTertiary}
            value={filterCity}
            onChangeText={setFilterCity}
            returnKeyType="search"
            onSubmitEditing={() => doSearch()}
          />
          {filterCity ? <TouchableOpacity onPress={() => setFilterCity('')}><Icon name="close" size={15} color={C.textTertiary} /></TouchableOpacity> : null}
        </View>
      </View>
      <SpecialityPickerModal
        visible={specModalVisible}
        value={filterSpec ?? ''}
        onSelect={sp => setFilterSpec(sp === '' ? null : sp)}
        onClose={() => setSpecModalVisible(false)}
        includeAll
      />

      {/* Content */}
      {loading ? (
        <View style={s.emptyWrap}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : results.length === 0 ? (
        <View style={s.emptyWrap}>
          <Icon name="doctor" size={54} color={C.textTertiary} />
          <Text style={s.emptyText}>{t('doc_catalog_empty')}</Text>
          <Text style={s.emptySub}>{t('doc_catalog_empty_sub')}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={d => d.id}
          contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const alreadyAdded = addedIds.has(item.id) || myNames.has(item.name.toLowerCase());
            const contactLine = [item.city, item.country].filter(Boolean).join(', ');
            const initials = item.name.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
            return (
              <View style={s.card}>
                <View style={s.cardInner}>
                  {item.photoUri
                    ? <Image source={{ uri: item.photoUri }} style={s.avatarPhoto} />
                    : <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
                  }
                  <View style={s.cardBody}>
                    <Text style={s.cardName}>{item.name}</Text>
                    <Text style={s.cardSpec}>{specLabel(t, item.speciality)}{item.experienceYears ? `  ·  ${t('doc_experience_years').replace('{n}', String(item.experienceYears))}` : ''}</Text>
                    {contactLine ? <Text style={s.cardSub}>{contactLine}</Text> : null}
                    {item.isFree !== undefined && (
                      <View style={[s.freeBadge, item.isFree ? {} : s.payBadge]}>
                        <Text style={[s.freeBadgeText, item.isFree ? {} : s.payBadgeText]}>
                          {item.isFree ? t('doc_free') : (item.cost ? `${t('doc_paid')} · ${item.cost}` : t('doc_paid'))}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity
                    style={[s.cardAction, { flex: 1 }]}
                    onPress={() => !alreadyAdded && handleAdd(item)}
                    disabled={alreadyAdded}
                    activeOpacity={0.7}
                  >
                    <Icon name={alreadyAdded ? 'check' : 'plus-circle'} size={16} color={alreadyAdded ? C.success : C.blue} />
                    <Text style={[s.cardActionText, { color: alreadyAdded ? C.success : C.blue }]}>
                      {alreadyAdded ? t('doc_already_added') : t('doc_add_to_my_list')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
