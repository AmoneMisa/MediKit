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
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import DatePicker from 'react-native-date-picker';
import { inferMedicineTags } from '../utils/medicineTags';
import { fetchMedicinePhoto } from '../utils/medicinePhoto';

let launchCamera: any;
let launchImageLibrary: any;
try {
  const ip = require('react-native-image-picker');
  launchCamera       = ip.launchCamera;
  launchImageLibrary = ip.launchImageLibrary;
} catch {}

type Nav = NativeStackNavigationProp<KitsStackParamList, 'ManualEntry'>;

const FORMS: { value: MedicineForm; label: string; emoji: string }[] = [
  { value: 'tablets',   label: 'Таблетки',  emoji: '💊' },
  { value: 'capsules',  label: 'Капсулы',   emoji: '💊' },
  { value: 'syrup',     label: 'Сироп',     emoji: '🍯' },
  { value: 'spray',     label: 'Спрей',     emoji: '💨' },
  { value: 'drops',     label: 'Капли',     emoji: '💧' },
  { value: 'ointment',  label: 'Мазь',      emoji: '🧴' },
  { value: 'injection', label: 'Инъекция',  emoji: '💉' },
  { value: 'powder',    label: 'Порошок',   emoji: '🧂' },
  { value: 'other',     label: 'Другое',    emoji: '🩺' },
];

const MEDICINE_TAGS: { key: string; label: string; emoji: string }[] = [
  { key: 'pain',       label: 'Боль',        emoji: '💊' },
  { key: 'fever',      label: 'Температура', emoji: '🌡️' },
  { key: 'sleep',      label: 'Сон',         emoji: '💤' },
  { key: 'allergy',    label: 'Аллергия',    emoji: '🤧' },
  { key: 'cold',       label: 'Простуда',    emoji: '🤒' },
  { key: 'stomach',    label: 'ЖКТ',         emoji: '🫃' },
  { key: 'heart',      label: 'Сердце',      emoji: '❤️' },
  { key: 'nerves',     label: 'Нервы',       emoji: '🧠' },
  { key: 'muscles',    label: 'Мышцы',       emoji: '💪' },
  { key: 'antiseptic', label: 'Антисептик',  emoji: '🩹' },
  { key: 'antibiotic', label: 'Антибиотик',  emoji: '🔬' },
  { key: 'vitamins',   label: 'Витамины',    emoji: '🌿' },
  { key: 'pressure',   label: 'Давление',    emoji: '🩺' },
  { key: 'skin',       label: 'Кожа',        emoji: '🧴' },
  { key: 'eyes',       label: 'Глаза',       emoji: '👁️' },
  { key: 'diabetes',   label: 'Диабет',      emoji: '🩸' },
];

const CONTRAINDICATIONS: { key: string; label: string }[] = [
  { key: 'Беременность',                label: '🤰 Беременность' },
  { key: 'Кормление грудью',            label: '🤱 Кормление грудью' },
  { key: 'Дети до 6 лет',              label: '👶 Дети до 6 лет' },
  { key: 'Дети до 12 лет',             label: '🧒 Дети до 12 лет' },
  { key: 'Дети до 18 лет',             label: '🧑 Дети до 18 лет' },
  { key: 'Нарушения функции почек',    label: '🫘 Нарушения почек' },
  { key: 'Нарушения функции печени',   label: '🫁 Нарушения печени' },
  { key: 'Не управлять авто',          label: '🚗 Не за руль' },
  { key: 'Алкоголь несовместим',       label: '🍷 Без алкоголя' },
  { key: 'Язвенная болезнь',           label: '🔴 Язвенная болезнь' },
  { key: 'Только по назначению врача', label: '⚕️ По рецепту' },
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
    photoThumb:     { width: 120, height: 120, borderRadius: Radius.xl, marginBottom: Spacing.md },
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
    photoRemoveBtn: { marginTop: Spacing.xs },
    photoRemoveText: { fontSize: Typography.size.body, color: C.danger, fontWeight: Typography.weight.semibold },

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
  const st = useMemo(() => makeStyles(C), [C]);

  const addMedicine    = useAppStore(s => s.addMedicine);
  const updateMedicine = useAppStore(s => s.updateMedicine);
  const kits           = useAppStore(s => s.kits);
  const getMedicine    = useAppStore(s => s.getMedicine);
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
    if (!launchCamera) { Alert.alert('Камера недоступна'); return; }
    const result = await launchCamera({ mediaType: 'photo', quality: 0.85, maxWidth: 900, maxHeight: 900 });
    if (result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  }

  async function handleGallery() {
    if (!launchImageLibrary) { Alert.alert('Галерея недоступна'); return; }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, maxWidth: 900, maxHeight: 900 });
    if (result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  }

  async function handleSearchApiPhoto() {
    if (!name.trim()) { Alert.alert('Введите название', 'Для поиска фото нужно название препарата.'); return; }
    setPhotoSearching(true);
    const uri = await fetchMedicinePhoto(name);
    setPhotoSearching(false);
    if (uri) {
      setPhotoUri(uri);
    } else {
      Alert.alert('Фото не найдено', 'Попробуйте другое написание или добавьте фото вручную.');
    }
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert('Укажите название', 'Название препарата обязательно.'); return; }
    if (!selectedKitId) { Alert.alert('Выберите аптечку', 'Сначала создайте аптечку на вкладке «Аптечки».'); return; }

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
    };

    if (existingMed && medicineId) {
      updateMedicine(medicineId, fields);
    } else {
      addMedicine({ id: `med-${Date.now()}`, ...fields, addedAt: now, updatedAt: now });
    }
    navigation.goBack();
  }

  const isEditing = !!existingMed;

  return (
    <SafeAreaView style={st.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Photo ── */}
          <Text style={st.sectionTitle}>Фото</Text>
          <View style={[st.card, st.photoSection]}>
            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={st.photoThumb} resizeMode="cover" />
                <TouchableOpacity style={st.photoRemoveBtn} onPress={() => setPhotoUri(undefined)}>
                  <Text style={st.photoRemoveText}>Удалить фото</Text>
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
                <Text style={st.photoBtnText}>Камера</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.photoBtn} onPress={handleGallery} activeOpacity={0.8}>
                <Icon name="image" size={14} color={C.blue} />
                <Text style={st.photoBtnText}>Галерея</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.photoBtn} onPress={handleSearchApiPhoto} activeOpacity={0.8} disabled={photoSearching}>
                {photoSearching
                  ? <ActivityIndicator size="small" color={C.blue} />
                  : <Icon name="web-search" size={14} color={C.blue} />}
                <Text style={st.photoBtnText}>Найти онлайн</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Basic info ── */}
          <Text style={st.sectionTitle}>Основное</Text>
          <View style={st.card}>
            <Field label="Название *"             placeholder="Название препарата"            value={name}             onChangeText={setName}             styles={st} colors={C} />
            <Field label="Производитель"          placeholder="Bayer, Pfizer…"               value={manufacturer}     onChangeText={setManufacturer}     styles={st} colors={C} />
            <Field label="Действующее вещество"   placeholder="МНН / активный компонент"     value={activeIngredient} onChangeText={setActiveIngredient} styles={st} colors={C} />
            <Field label="Дозировка"              placeholder="500 мг, 0.1%, 10000 ЕД…"     value={dosage}           onChangeText={setDosage}           styles={st} colors={C} />
          </View>

          {/* ── Form type ── */}
          <Text style={st.sectionTitle}>Форма выпуска</Text>
          <View style={st.chipRow}>
            {FORMS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[st.chip, form === f.value && st.chipActive]}
                onPress={() => setForm(f.value)} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 15 }}>{f.emoji}</Text>
                <Text style={[st.chipText, form === f.value && st.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Composition ── */}
          <Text style={st.sectionTitle}>Состав (компоненты)</Text>
          <View style={st.card}>
            {composition.length > 0 && (
              <View style={st.compHeader}>
                <Text style={[st.compColLabel, { flex: 1 }]}>Компонент</Text>
                <Text style={[st.compColLabel, { width: 100 }]}>Количество</Text>
                <View style={{ width: 32 }} />
              </View>
            )}
            {composition.map((item, i) => (
              <View key={i} style={st.compRow}>
                <TextInput
                  style={[st.compInput, { flex: 1 }]}
                  placeholder="Нимесулид, Магний…"
                  placeholderTextColor={C.textTertiary}
                  value={item.name}
                  onChangeText={v => updateComposition(i, 'name', v)}
                />
                <TextInput
                  style={[st.compInput, { width: 100 }]}
                  placeholder="100 мг"
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
              <Text style={st.addCompBtnText}>Добавить компонент</Text>
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
                  Авто-теги: {suggestedTags.join(', ')}
                </Text>
                <Text style={{ fontSize: Typography.size.xs, color: C.blueDark, opacity: 0.7, marginTop: 2 }}>
                  Мы определили категории по названию
                </Text>
              </View>
              <TouchableOpacity onPress={applyAutoTags} style={{ backgroundColor: C.blue, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 }}>
                <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.white }}>Применить</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAutoTagsDismissed(true)}>
                <Icon name="close" size={16} color={C.blueDark} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Tags ── */}
          <Text style={st.sectionTitle}>Применяется при</Text>
          <View style={st.chipRow}>
            {MEDICINE_TAGS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[st.chip, tags.includes(t.key) && st.chipTagActive]}
                onPress={() => toggleTag(t.key)} activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                <Text style={[st.chipText, tags.includes(t.key) && st.chipTagTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Contraindications ── */}
          <Text style={st.sectionTitle}>Противопоказания</Text>
          <View style={st.chipRow}>
            {CONTRAINDICATIONS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[st.chip, warnings.includes(c.key) && st.chipWarnActive]}
                onPress={() => toggleWarning(c.key)} activeOpacity={0.8}
              >
                <Text style={[st.chipText, warnings.includes(c.key) && st.chipWarnTextActive]}>{c.label}</Text>
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
                    <Text style={{ fontSize: 15 }}>{k.icon}</Text>
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
