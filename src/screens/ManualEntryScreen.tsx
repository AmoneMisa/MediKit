import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { KitsStackParamList, MedicineForm, CompositionItem } from '../types';
import { useAppStore } from '../store';
import { scheduleMedicineExpiry, cancelMedicineExpiry } from '../utils/notificationScheduler';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import DatePicker from 'react-native-date-picker';
import { inferMedicineTags } from '../utils/medicineTags';
import { fetchMedicinePhoto } from '../utils/medicinePhoto';
import { HueSlider } from '../components/HueSlider';
import { useT } from '../i18n';

const MED_COLOR_SWATCHES = [
  '#78A9FF', '#56CE53', '#FF7575', '#FFCF47',
  '#C97FE8', '#00BFA5', '#FF9800', '#FF4081',
];

let launchCamera: any;
let launchImageLibrary: any;
try {
  const ip = require('react-native-image-picker');
  launchCamera       = ip.launchCamera;
  launchImageLibrary = ip.launchImageLibrary;
} catch {}

type Nav = NativeStackNavigationProp<KitsStackParamList, 'ManualEntry'>;

const FORMS: { value: MedicineForm; labelKey: string; icon: string }[] = [
  { value: 'tablets',   labelKey: 'me_form_tablets',   icon: 'pill' },
  { value: 'capsules',  labelKey: 'me_form_capsules',  icon: 'pill' },
  { value: 'syrup',     labelKey: 'me_form_syrup',     icon: 'bottle-tonic' },
  { value: 'spray',     labelKey: 'me_form_spray',     icon: 'spray' },
  { value: 'drops',     labelKey: 'me_form_drops',     icon: 'water' },
  { value: 'ointment',  labelKey: 'me_form_ointment',  icon: 'lotion-plus' },
  { value: 'injection', labelKey: 'me_form_injection', icon: 'needle' },
  { value: 'powder',    labelKey: 'me_form_powder',    icon: 'dots-horizontal-circle' },
  { value: 'other',     labelKey: 'me_form_other',     icon: 'stethoscope' },
];

const MEDICINE_TAGS: { key: string; labelKey: string; icon: string }[] = [
  { key: 'pain',       labelKey: 'me_tag_pain',       icon: 'pill' },
  { key: 'fever',      labelKey: 'me_tag_fever',      icon: 'thermometer' },
  { key: 'sleep',      labelKey: 'me_tag_sleep',      icon: 'sleep' },
  { key: 'allergy',    labelKey: 'me_tag_allergy',    icon: 'face-mask' },
  { key: 'cold',       labelKey: 'me_tag_cold',       icon: 'emoticon-sick' },
  { key: 'stomach',    labelKey: 'me_tag_stomach',    icon: 'food-apple' },
  { key: 'heart',      labelKey: 'me_tag_heart',      icon: 'heart' },
  { key: 'nerves',     labelKey: 'me_tag_nerves',     icon: 'brain' },
  { key: 'muscles',    labelKey: 'me_tag_muscles',    icon: 'arm-flex' },
  { key: 'antiseptic', labelKey: 'me_tag_antiseptic', icon: 'bandage' },
  { key: 'antibiotic', labelKey: 'me_tag_antibiotic', icon: 'microscope' },
  { key: 'vitamins',   labelKey: 'me_tag_vitamins',   icon: 'leaf' },
  { key: 'pressure',   labelKey: 'me_tag_pressure',   icon: 'stethoscope' },
  { key: 'skin',       labelKey: 'me_tag_skin',       icon: 'lotion-plus' },
  { key: 'eyes',       labelKey: 'me_tag_eyes',       icon: 'eye' },
  { key: 'diabetes',   labelKey: 'me_tag_diabetes',   icon: 'blood-bag' },
];

const CONTRAINDICATIONS: { key: string; icon: string; labelKey: string }[] = [
  { key: 'Беременность',                icon: 'human-pregnant',    labelKey: 'me_ci_pregnancy' },
  { key: 'Кормление грудью',            icon: 'baby-carriage',     labelKey: 'me_ci_breastfeeding' },
  { key: 'Дети до 6 лет',              icon: 'baby-face-outline',  labelKey: 'me_ci_children_6' },
  { key: 'Дети до 12 лет',             icon: 'human-child',        labelKey: 'me_ci_children_12' },
  { key: 'Дети до 18 лет',             icon: 'human',              labelKey: 'me_ci_children_18' },
  { key: 'Нарушения функции почек',    icon: 'water-outline',      labelKey: 'me_ci_kidney' },
  { key: 'Нарушения функции печени',   icon: 'water',              labelKey: 'me_ci_liver' },
  { key: 'Не управлять авто',          icon: 'car',                labelKey: 'me_ci_no_driving' },
  { key: 'Алкоголь несовместим',       icon: 'glass-wine',         labelKey: 'me_ci_no_alcohol' },
  { key: 'Язвенная болезнь',           icon: 'alert-circle',       labelKey: 'me_ci_ulcer' },
  { key: 'Только по назначению врача', icon: 'medical-bag',        labelKey: 'me_ci_prescription' },
];

function fmt(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}
function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 48 },
    sectionTitle: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md,
    },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.xs, ...Shadow.card,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgCard,
    },
    chipActive:         { backgroundColor: C.blue,         borderColor: C.blue },
    chipTagActive:      { backgroundColor: C.successLight, borderColor: C.success },
    chipWarnActive:     { backgroundColor: C.dangerLight,  borderColor: C.danger },
    chipText:           { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textSecondary },
    chipTextActive:     { color: C.white },
    chipTagTextActive:  { color: C.successDark },
    chipWarnTextActive: { color: C.dangerDark },

    compHeader: { flexDirection: 'row', marginBottom: 4 },
    compColLabel: {
      fontSize: Typography.size.xs, color: C.textTertiary,
      fontWeight: Typography.weight.bold, textTransform: 'uppercase',
    },
    compRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    compInput: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.sm, height: 40,
      fontSize: Typography.size.body, color: C.textPrimary,
      textAlignVertical: 'center',
    },
    compDelete: { width: 32, alignItems: 'center', justifyContent: 'center' },
    addCompBtn: {
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.blue,
      borderRadius: Radius.md, paddingVertical: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    addCompBtnText: { fontSize: Typography.size.body, color: C.blue, fontWeight: Typography.weight.bold },

    dateLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textSecondary, textTransform: 'uppercase',
      letterSpacing: 0.4, marginBottom: Spacing.xs,
    },
    dateSep: { height: 1, backgroundColor: C.borderLight, marginVertical: Spacing.sm },
    datePicker: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border, paddingHorizontal: Spacing.md, height: 44,
    },
    datePickerText: { fontSize: Typography.size.md, color: C.textPrimary, fontWeight: Typography.weight.semibold },

    noKitText: { color: C.textSecondary, fontSize: Typography.size.body },

    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl,
      padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.md, ...Shadow.card,
    },
    saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.white },

    // Photo
    photoSection:   { alignItems: 'center', paddingVertical: Spacing.md },
    photoThumb:     { width: 200, height: 200, borderRadius: Radius.xl, marginBottom: Spacing.md, alignSelf: 'center' },
    photoPlaceholder: {
      width: 120, height: 120, borderRadius: Radius.xl,
      backgroundColor: C.bgCardAlt, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
    },
    photoActions:   { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
    photoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingVertical: 7,
      borderRadius: Radius.pill, borderWidth: 1.5, borderColor: C.blue, backgroundColor: C.bgCard,
    },
    photoBtnText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.blue },
    photoRemoveBtn: { marginTop: Spacing.xs, alignSelf: 'center' },
    photoRemoveText: { fontSize: Typography.size.body, color: C.danger, fontWeight: Typography.weight.semibold, textAlign: 'center' },

    // Field sub-styles
    fieldWrap:  { marginBottom: Spacing.md },
    fieldLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textSecondary, marginBottom: 5,
      textTransform: 'uppercase', letterSpacing: 0.4,
    },
    fieldInput: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md,
      fontSize: Typography.size.md, color: C.textPrimary,
      height: 44, textAlignVertical: 'center',
    },
    fieldInputMulti: { height: 80, textAlignVertical: 'top', paddingTop: Spacing.sm },
  });
}

export function ManualEntryScreen() {
  const navigation  = useNavigation<Nav>();
  const route       = useRoute<any>();
  const kitId: string | undefined      = route.params?.kitId;
  const medicineId: string | undefined = route.params?.medicineId;
  const prefill                        = route.params?.prefill;
  const C  = useColors();
  const t  = useT();
  const st = useMemo(() => makeStyles(C), [C]);

  const addMedicine    = useAppStore(s => s.addMedicine);
  const updateMedicine = useAppStore(s => s.updateMedicine);
  const kits           = useAppStore(s => s.kits);
  const getMedicine    = useAppStore(s => s.getMedicine);
  const expiryDays     = useAppStore(s => s.settings.reminders.expiryDaysBefore);
  const existingMed    = medicineId ? getMedicine(medicineId) : undefined;

  const defaultExpiry = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; };

  const [name,             setName]             = useState('');
  const [manufacturer,     setManufacturer]     = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dosage,           setDosage]           = useState('');
  const [form,             setForm]             = useState<MedicineForm>('tablets');
  const [composition,      setComposition]      = useState<{ name: string; amount: string }[]>([]);
  const [totalQty,         setTotalQty]         = useState('');
  const [remainingQty,     setRemainingQty]     = useState('');
  const [startDate,        setStartDate]        = useState<Date>(new Date());
  const [expiryDate,       setExpiryDate]       = useState<Date>(defaultExpiry);
  const [startOpen,        setStartOpen]        = useState(false);
  const [expiryOpen,       setExpiryOpen]       = useState(false);
  const [notes,            setNotes]            = useState('');
  const [warnings,         setWarnings]         = useState<string[]>([]);
  const [selectedKitId,    setSelectedKitId]    = useState(kitId ?? kits[0]?.id ?? '');
  const [tags,             setTags]             = useState<string[]>([]);
  const [autoTagsDismissed, setAutoTagsDismissed] = useState(false);
  const [photoUri,         setPhotoUri]         = useState<string | undefined>(undefined);
  const [photoSearching,   setPhotoSearching]   = useState(false);
  const [colorTag,         setColorTag]         = useState<string | undefined>(undefined);

  // Auto-tag: infer tags from name + active ingredient after a short delay
  const suggestedTags = useMemo(() => {
    if (existingMed || prefill || autoTagsDismissed) return [];
    const inferred = inferMedicineTags(name, activeIngredient);
    return inferred.filter(t => !tags.includes(t));
  }, [name, activeIngredient, tags, existingMed, prefill, autoTagsDismissed]);

  function applyAutoTags() {
    setTags(prev => [...new Set([...prev, ...suggestedTags])]);
    setAutoTagsDismissed(true);
  }

  useEffect(() => {
    if (existingMed) {
      setName(existingMed.name);
      setManufacturer(existingMed.manufacturer ?? '');
      setActiveIngredient(existingMed.activeIngredient ?? '');
      setDosage(existingMed.dosage ?? '');
      setForm(existingMed.form);
      setComposition((existingMed.composition ?? []).map(c => ({ name: c.name, amount: c.amount ?? '' })));
      setTotalQty(String(existingMed.totalQuantity));
      setRemainingQty(String(existingMed.remainingQuantity));
      if (existingMed.startDate) setStartDate(fromIso(existingMed.startDate));
      setExpiryDate(fromIso(existingMed.expirationDate));
      setNotes(existingMed.notes ?? '');
      setWarnings(existingMed.warnings ?? []);
      setSelectedKitId(existingMed.kitId);
      setTags(existingMed.tags ?? []);
      if (existingMed.photoUri) setPhotoUri(existingMed.photoUri);
      if (existingMed.colorTag) setColorTag(existingMed.colorTag);
    } else if (prefill) {
      if (prefill.name)             setName(prefill.name);
      if (prefill.manufacturer)     setManufacturer(prefill.manufacturer);
      if (prefill.activeIngredient) setActiveIngredient(prefill.activeIngredient);
      if (prefill.dosage)           setDosage(prefill.dosage);
      if (prefill.form)             setForm(prefill.form);
      if (prefill.composition)      setComposition(prefill.composition.map((c: any) => ({ name: c.name, amount: c.amount ?? '' })));
      if (prefill.warnings)         setWarnings(prefill.warnings);
      if (prefill.tags?.length)     setTags(prefill.tags);
      if (prefill.photoUri)         setPhotoUri(prefill.photoUri);
      if (prefill.usageNotes)       setNotes(prefill.usageNotes);
      if (prefill.totalQuantity) {
        setTotalQty(String(prefill.totalQuantity));
        setRemainingQty(String(prefill.totalQuantity));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTag(key: string) {
    setTags(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }
  function toggleWarning(key: string) {
    setWarnings(prev => prev.includes(key) ? prev.filter(w => w !== key) : [...prev, key]);
  }
  function addCompositionRow() {
    setComposition(prev => [...prev, { name: '', amount: '' }]);
  }
  function updateComposition(index: number, field: 'name' | 'amount', value: string) {
    setComposition(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }
  function removeComposition(index: number) {
    setComposition(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCamera() {
    if (!launchCamera) { Alert.alert(t('me_camera_unavailable')); return; }
    const result = await launchCamera({ mediaType: 'photo', quality: 0.85, maxWidth: 900, maxHeight: 900 });
    if (result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  }

  async function handleGallery() {
    if (!launchImageLibrary) { Alert.alert(t('me_gallery_unavailable')); return; }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, maxWidth: 900, maxHeight: 900 });
    if (result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  }

  async function handleSearchApiPhoto() {
    if (!name.trim()) { Alert.alert(t('me_enter_name'), t('me_enter_name_for_photo')); return; }
    setPhotoSearching(true);
    const uri = await fetchMedicinePhoto(name);
    setPhotoSearching(false);
    if (uri) {
      setPhotoUri(uri);
    } else {
      Alert.alert(t('me_photo_not_found'), t('me_photo_not_found_sub'));
    }
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert(t('me_specify_name'), t('me_name_required')); return; }
    if (!selectedKitId) { Alert.alert(t('me_choose_kit'), t('me_create_kit_first')); return; }

    const total     = parseInt(totalQty, 10) || 1;
    const remaining = parseInt(remainingQty, 10) || total;
    const now       = new Date().toISOString();
    const comp: CompositionItem[] = composition
      .filter(c => c.name.trim())
      .map(c => ({ name: c.name.trim(), amount: c.amount.trim() || undefined }));

    const fields = {
      name:              name.trim(),
      manufacturer:      manufacturer.trim() || undefined,
      activeIngredient:  activeIngredient.trim() || undefined,
      dosage:            dosage.trim() || undefined,
      form,
      composition:       comp.length > 0 ? comp : undefined,
      kitId:             selectedKitId,
      totalQuantity:     total,
      remainingQuantity: Math.min(remaining, total),
      startDate:         toIso(startDate),
      expirationDate:    toIso(expiryDate),
      notes:             notes.trim() || undefined,
      warnings:          warnings.length > 0 ? warnings : undefined,
      tags:              tags.length > 0 ? tags : undefined,
      photoUri:          photoUri || undefined,
      colorTag:          colorTag || undefined,
    };

    if (existingMed && medicineId) {
      updateMedicine(medicineId, fields);
      // Reschedule expiry alerts with updated expiry date
      const updated = { ...existingMed, ...fields };
      cancelMedicineExpiry(medicineId)
        .then(() => scheduleMedicineExpiry(updated as any, expiryDays))
        .catch(() => {});
    } else {
      const newMed = { id: `med-${Date.now()}`, ...fields, addedAt: now, updatedAt: now };
      addMedicine(newMed);
      scheduleMedicineExpiry(newMed as any, expiryDays).catch(() => {});
    }
    navigation.goBack();
  }

  const isEditing = !!existingMed;

  return (
    <SafeAreaView style={st.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Photo ── */}
          <Text style={st.sectionTitle}>{t('me_photo')}</Text>
          <View style={[st.card, st.photoSection]}>
            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={st.photoThumb} resizeMode="cover" />
                <TouchableOpacity style={st.photoRemoveBtn} onPress={() => setPhotoUri(undefined)}>
                  <Text style={st.photoRemoveText}>{t('me_remove_photo')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={st.photoPlaceholder}>
                <Icon name="camera-plus-outline" size={36} color={C.textTertiary} />
              </View>
            )}
            <View style={st.photoActions}>
              <TouchableOpacity style={st.photoBtn} onPress={handleCamera} activeOpacity={0.8}>
                <Icon name="camera" size={14} color={C.blue} />
                <Text style={st.photoBtnText}>{t('me_camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.photoBtn} onPress={handleGallery} activeOpacity={0.8}>
                <Icon name="image" size={14} color={C.blue} />
                <Text style={st.photoBtnText}>{t('me_gallery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.photoBtn} onPress={handleSearchApiPhoto} activeOpacity={0.8} disabled={photoSearching}>
                {photoSearching
                  ? <ActivityIndicator size="small" color={C.blue} />
                  : <Icon name="web-search" size={14} color={C.blue} />}
                <Text style={st.photoBtnText}>{t('me_find_online')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Basic info ── */}
          <Text style={st.sectionTitle}>{t('me_basic')}</Text>
          <View style={st.card}>
            <Field label={t('me_name_label')}             placeholder={t('me_name_placeholder')}            value={name}             onChangeText={setName}             styles={st} colors={C} />
            <Field label={t('manufacturer')}          placeholder={t('me_manufacturer_placeholder')}               value={manufacturer}     onChangeText={setManufacturer}     styles={st} colors={C} />
            <Field label={t('active_ingredient')}   placeholder={t('me_active_ingredient_placeholder')}     value={activeIngredient} onChangeText={setActiveIngredient} styles={st} colors={C} />
            <Field label={t('dosage')}              placeholder={t('me_dosage_placeholder')}     value={dosage}           onChangeText={setDosage}           styles={st} colors={C} />
          </View>

          {/* ── Form type ── */}
          <Text style={st.sectionTitle}>{t('me_form_type')}</Text>
          <View style={st.chipRow}>
            {FORMS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[st.chip, form === f.value && st.chipActive]}
                onPress={() => setForm(f.value)} activeOpacity={0.8}
              >
                <Icon name={f.icon} size={15} color={form === f.value ? C.white : C.textSecondary} />
                <Text style={[st.chipText, form === f.value && st.chipTextActive]}>{t(f.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Composition ── */}
          <Text style={st.sectionTitle}>{t('me_composition_section')}</Text>
          <View style={st.card}>
            {composition.length > 0 && (
              <View style={st.compHeader}>
                <Text style={[st.compColLabel, { flex: 1 }]}>{t('me_component')}</Text>
                <Text style={[st.compColLabel, { width: 100 }]}>{t('me_amount')}</Text>
                <View style={{ width: 32 }} />
              </View>
            )}
            {composition.map((item, i) => (
              <View key={i} style={st.compRow}>
                <TextInput
                  style={[st.compInput, { flex: 1 }]}
                  placeholder={t('me_component_placeholder')}
                  placeholderTextColor={C.textTertiary}
                  value={item.name}
                  onChangeText={v => updateComposition(i, 'name', v)}
                />
                <TextInput
                  style={[st.compInput, { width: 100 }]}
                  placeholder={t('me_amount_placeholder')}
                  placeholderTextColor={C.textTertiary}
                  value={item.amount}
                  onChangeText={v => updateComposition(i, 'amount', v)}
                />
                <TouchableOpacity onPress={() => removeComposition(i)} style={st.compDelete}>
                  <Icon name="close" size={18} color={C.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={st.addCompBtn} onPress={addCompositionRow} activeOpacity={0.8}>
              <Icon name="plus" size={14} color={C.blue} />
              <Text style={st.addCompBtnText}>{t('me_add_component')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Auto-tag suggestion ── */}
          {suggestedTags.length > 0 && (
            <View style={{
              backgroundColor: C.blueLight, borderRadius: Radius.md,
              padding: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.xs,
              flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
            }}>
              <Icon name="auto-fix" size={18} color={C.blueDark} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.blueDark }}>
                  {t('me_auto_tags')}: {suggestedTags.join(', ')}
                </Text>
                <Text style={{ fontSize: Typography.size.xs, color: C.blueDark, opacity: 0.7, marginTop: 2 }}>
                  {t('me_auto_tags_sub')}
                </Text>
              </View>
              <TouchableOpacity onPress={applyAutoTags} style={{ backgroundColor: C.blue, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 }}>
                <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.white }}>{t('me_apply')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAutoTagsDismissed(true)}>
                <Icon name="close" size={16} color={C.blueDark} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Tags ── */}
          <Text style={st.sectionTitle}>{t('me_used_for')}</Text>
          <View style={st.chipRow}>
            {MEDICINE_TAGS.map(tag => (
              <TouchableOpacity
                key={tag.key}
                style={[st.chip, tags.includes(tag.key) && st.chipTagActive]}
                onPress={() => toggleTag(tag.key)} activeOpacity={0.8}
              >
                <Icon name={tag.icon} size={14} color={tags.includes(tag.key) ? C.successDark : C.textSecondary} />
                <Text style={[st.chipText, tags.includes(tag.key) && st.chipTagTextActive]}>{t(tag.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Contraindications ── */}
          <Text style={st.sectionTitle}>{t('me_contraindications')}</Text>
          <View style={st.chipRow}>
            {CONTRAINDICATIONS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[st.chip, warnings.includes(c.key) && st.chipWarnActive]}
                onPress={() => toggleWarning(c.key)} activeOpacity={0.8}
              >
                <Icon name={c.icon} size={14} color={warnings.includes(c.key) ? C.dangerDark : C.textSecondary} />
                <Text style={[st.chipText, warnings.includes(c.key) && st.chipWarnTextActive]}>{t(c.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Quantity ── */}
          <Text style={st.sectionTitle}>Количество</Text>
          <View style={st.card}>
            <View style={st.row}>
              <View style={{ flex: 1 }}>
                <Field label="Всего в упаковке" placeholder="20" value={totalQty}     onChangeText={setTotalQty}     keyboardType="number-pad" styles={st} colors={C} />
              </View>
              <View style={{ width: Spacing.md }} />
              <View style={{ flex: 1 }}>
                <Field label="Осталось"         placeholder="20" value={remainingQty} onChangeText={setRemainingQty} keyboardType="number-pad" styles={st} colors={C} />
              </View>
            </View>
          </View>

          {/* ── Dates ── */}
          <Text style={st.sectionTitle}>Даты</Text>
          <View style={st.card}>
            <Text style={st.dateLabel}>Куплено / открыто</Text>
            <TouchableOpacity style={st.datePicker} onPress={() => setStartOpen(true)} activeOpacity={0.8}>
              <Text style={st.datePickerText}>{fmt(startDate)}</Text>
              <Icon name="calendar" size={20} color={C.textSecondary} />
            </TouchableOpacity>
            <View style={st.dateSep} />
            <Text style={st.dateLabel}>Срок годности *</Text>
            <TouchableOpacity style={st.datePicker} onPress={() => setExpiryOpen(true)} activeOpacity={0.8}>
              <Text style={st.datePickerText}>{fmt(expiryDate)}</Text>
              <Icon name="calendar" size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Notes ── */}
          <Text style={st.sectionTitle}>Заметки</Text>
          <View style={st.card}>
            <Field label="Условия хранения и особые указания" placeholder="Хранить при t° до 25°C…" value={notes} onChangeText={setNotes} multiline styles={st} colors={C} />
          </View>

          {/* ── Kit selector ── */}
          {kits.length > 0 ? (
            <>
              <Text style={st.sectionTitle}>{isEditing ? 'Аптечка' : 'Добавить в аптечку'}</Text>
              <View style={st.chipRow}>
                {kits.map(k => (
                  <TouchableOpacity
                    key={k.id}
                    style={[st.chip, selectedKitId === k.id && st.chipActive]}
                    onPress={() => setSelectedKitId(k.id)} activeOpacity={0.8}
                  >
                    <Icon name={k.icon} size={15} color={k.colorTag} />
                    <Text style={[st.chipText, selectedKitId === k.id && st.chipTextActive]}>{k.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View style={[st.card, { marginTop: Spacing.md }]}>
              <Text style={st.noKitText}>Сначала создайте аптечку на вкладке «Аптечки»</Text>
            </View>
          )}

          {/* ── Color label ── */}
          <Text style={st.sectionTitle}>{t('me_color_label')}</Text>
          <View style={[st.card, { gap: Spacing.sm }]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
              {MED_COLOR_SWATCHES.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColorTag(colorTag === c ? undefined : c)}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: colorTag === c ? 3 : 0,
                    borderColor: C.textPrimary,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  activeOpacity={0.8}
                />
              ))}
              {colorTag && !MED_COLOR_SWATCHES.includes(colorTag) && (
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: colorTag,
                  borderWidth: 3, borderColor: C.textPrimary,
                }} />
              )}
            </View>
            <HueSlider
              value={colorTag ?? '#78A9FF'}
              onChange={setColorTag}
            />
            {colorTag && (
              <TouchableOpacity onPress={() => setColorTag(undefined)}>
                <Text style={{ fontSize: Typography.size.body, color: C.danger, fontWeight: Typography.weight.semibold }}>{t('me_color_clear')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Save ── */}
          <TouchableOpacity style={st.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={st.saveBtnText}>
              {isEditing ? 'Сохранить изменения' : 'Сохранить препарат'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePicker modal open={startOpen} date={startDate} mode="date"
        title="Куплено / открыто" confirmText="Готово" cancelText="Отмена"
        onConfirm={d => { setStartOpen(false); setStartDate(d); }}
        onCancel={() => setStartOpen(false)} />
      <DatePicker modal open={expiryOpen} date={expiryDate} mode="date"
        title="Срок годности" confirmText="Готово" cancelText="Отмена"
        onConfirm={d => { setExpiryOpen(false); setExpiryDate(d); }}
        onCancel={() => setExpiryOpen(false)} />
    </SafeAreaView>
  );
}

// ── Field sub-component ────────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChangeText, keyboardType, multiline, styles: st, colors: C,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (t: string) => void; keyboardType?: any; multiline?: boolean;
  styles: ReturnType<typeof makeStyles>; colors: ColorPalette;
}) {
  return (
    <View style={st.fieldWrap}>
      <Text style={st.fieldLabel}>{label}</Text>
      <TextInput
        style={[st.fieldInput, multiline && st.fieldInputMulti]}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}
