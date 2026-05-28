import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, Switch, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import type { MedicineKit } from '../types';

let launchImageLibrary: any;
try {
  launchImageLibrary = require('react-native-image-picker').launchImageLibrary;
} catch {}

const ICONS = [
  '🏡', '🏠', '👨‍👩‍👧', '🌿', '🚗', '🏖', '💼', '⛺️', '🏥', '🧳',
  '❤️', '🌸', '🌞', '🐾', '🎒', '🍀', '⚽', '🎨', '🏋️', '✈️',
  '🧘', '🍃', '💊', '🩺', '🧬', '🫁', '🦷', '👶', '🧓', '🐶',
];

const COLORS = [
  // Blues
  '#A0CEFF', '#78A9FF', '#4D8CFF', '#1A5CCC', '#47C8FF',
  // Greens
  '#56CE53', '#80D8B0', '#3DB87A', '#B5E7A0', '#6FCF97',
  // Reds / Pinks
  '#FF7575', '#FF4D6D', '#FF9EC4', '#FFB3C1', '#E84393',
  // Oranges / Yellows
  '#FFB347', '#FFCF47', '#FF9F43', '#F7DC6F', '#FFA07A',
  // Purples
  '#A080FF', '#C39BD3', '#8E44AD', '#D7BDE2', '#7F8FA4',
  // Neutrals
  '#B0BEC5', '#78909C', '#607D8B', '#455A64', '#263238',
];

export function CreateEditKitScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kitId: string | undefined = route.params?.kitId;

  const existingKit = useAppStore(s => kitId ? s.getKit(kitId) : undefined);
  const addKit      = useAppStore(s => s.addKit);
  const updateKit   = useAppStore(s => s.updateKit);
  const deleteKit   = useAppStore(s => s.deleteKit);
  const user        = useAppStore(s => s.user);

  const [name,        setName]        = useState(existingKit?.name        ?? '');
  const [description, setDescription] = useState(existingKit?.description ?? '');
  const [icon,        setIcon]        = useState(existingKit?.icon        ?? '🏡');
  const [colorTag,    setColorTag]    = useState(existingKit?.colorTag    ?? Colors.blue);
  const [isPrivate,   setIsPrivate]   = useState(existingKit?.isPrivate   ?? true);
  const [photoUri,    setPhotoUri]    = useState(existingKit?.photoUri    ?? '');
  const [coverMode,   setCoverMode]   = useState<'emoji' | 'photo'>(
    existingKit?.photoUri ? 'photo' : 'emoji',
  );
  const priority = existingKit?.priority ?? 0;

  const isEditing = !!kitId;

  function handlePickPhoto() {
    if (!launchImageLibrary) {
      Alert.alert('Недоступно', 'Модуль выбора фото не подключён.');
      return;
    }
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 1 }, (res: any) => {
      if (res.didCancel || res.errorCode) return;
      const uri = res.assets?.[0]?.uri;
      if (uri) { setPhotoUri(uri); setCoverMode('photo'); }
    });
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Укажите название аптечки');
      return;
    }
    const now = new Date().toISOString();
    const cover = coverMode === 'photo' && photoUri ? photoUri : undefined;

    if (isEditing && kitId) {
      updateKit(kitId, {
        name: name.trim(), description, icon, colorTag, isPrivate,
        photoUri: cover, priority,
      });
    } else {
      const newKit: MedicineKit = {
        id:          `kit-${Date.now()}`,
        name:        name.trim(),
        description: description.trim() || undefined,
        icon,
        colorTag,
        isPrivate,
        photoUri:    cover,
        priority:    0,
        ownerId:     user.id,
        members: [{
          userId:         user.id,
          name:           user.name,
          avatarInitials: user.avatarInitials,
          role:           'owner',
          syncStatus:     'active',
        }],
        createdAt: now,
        updatedAt: now,
      };
      addKit(newKit);
    }
    navigation.goBack();
  }

  function handleDelete() {
    Alert.alert(
      'Удалить аптечку',
      `Удалить «${name}»? Все препараты в ней тоже будут удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => { deleteKit(kitId!); navigation.popToTop(); },
        },
      ],
    );
  }

  const previewBg = colorTag + '22';
  const previewBorder = colorTag + '66';

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Preview card */}
        <View style={[s.preview, { backgroundColor: previewBg, borderColor: previewBorder }]}>
          {coverMode === 'photo' && photoUri ? (
            <Image source={{ uri: photoUri }} style={s.previewPhoto} resizeMode="cover" />
          ) : (
            <Text style={s.previewIcon}>{icon}</Text>
          )}
          <Text style={s.previewName}>{name || 'Название аптечки'}</Text>
          {description ? <Text style={s.previewDesc}>{description}</Text> : null}
        </View>

        {/* Name */}
        <Text style={s.label}>Название *</Text>
        <View style={s.card}>
          <TextInput
            style={s.input}
            placeholder="Домашняя аптечка"
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Description */}
        <Text style={s.label}>Описание / Местоположение</Text>
        <View style={s.card}>
          <TextInput
            style={s.input}
            placeholder="Кухонный шкаф, 2-я полка"
            placeholderTextColor={Colors.textTertiary}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Cover mode toggle */}
        <Text style={s.label}>Обложка</Text>
        <View style={[s.card, s.coverToggle]}>
          <TouchableOpacity
            style={[s.coverTab, coverMode === 'emoji' && { backgroundColor: colorTag + '33' }]}
            onPress={() => setCoverMode('emoji')}
            activeOpacity={0.8}
          >
            <Text style={[s.coverTabText, coverMode === 'emoji' && { color: colorTag }]}>
              Иконка
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.coverTab, coverMode === 'photo' && { backgroundColor: colorTag + '33' }]}
            onPress={() => { setCoverMode('photo'); if (!photoUri) handlePickPhoto(); }}
            activeOpacity={0.8}
          >
            <Text style={[s.coverTabText, coverMode === 'photo' && { color: colorTag }]}>
              Фото
            </Text>
          </TouchableOpacity>
        </View>

        {/* Emoji grid */}
        {coverMode === 'emoji' && (
          <>
            <Text style={s.label}>Иконка</Text>
            <View style={[s.card, s.iconGrid]}>
              {ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[s.iconOption, icon === ic && { borderColor: colorTag, borderWidth: 2.5 }]}
                  onPress={() => setIcon(ic)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 24 }}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Photo picker */}
        {coverMode === 'photo' && (
          <TouchableOpacity style={[s.card, s.photoPickerBtn]} onPress={handlePickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photoThumb} resizeMode="cover" />
            ) : (
              <Text style={s.photoPickerIcon}>📷</Text>
            )}
            <Text style={[s.photoPickerText, photoUri && { color: colorTag }]}>
              {photoUri ? 'Изменить фото' : 'Выбрать из галереи'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Color palette */}
        <Text style={s.label}>Цвет</Text>
        <View style={[s.card, s.colorGrid]}>
          {COLORS.map(c => (
            <TouchableOpacity
              key={c}
              style={[
                s.colorDot,
                { backgroundColor: c },
                colorTag === c && { borderWidth: 3.5, borderColor: Colors.textPrimary },
              ]}
              onPress={() => setColorTag(c)}
              activeOpacity={0.8}
            />
          ))}
        </View>

        {/* Privacy toggle */}
        <View style={[s.card, s.toggleRow]}>
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={s.toggleLabel}>Личная аптечка</Text>
            <Text style={s.toggleDesc}>Только вы можете видеть эту аптечку</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ true: Colors.blue, false: Colors.border }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Save */}
        <TouchableOpacity style={[s.saveBtn, { backgroundColor: colorTag }]} onPress={handleSave} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>
            {isEditing ? 'Сохранить изменения' : 'Создать аптечку'}
          </Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Text style={s.deleteBtnText}>Удалить аптечку</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgPage },
  scroll: { padding: Spacing.lg, paddingBottom: 48 },

  preview: {
    alignItems: 'center', padding: Spacing.xl,
    borderRadius: Radius.xl, borderWidth: 1.5,
    marginBottom: Spacing.lg, overflow: 'hidden',
  },
  previewPhoto: { width: 80, height: 80, borderRadius: 40, marginBottom: Spacing.sm },
  previewIcon:  { fontSize: 56, marginBottom: Spacing.sm },
  previewName: {
    fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold,
    color: Colors.textPrimary,
  },
  previewDesc: { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 4 },

  label: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.xs, marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.xs, ...Shadow.card,
  },
  input: {
    fontSize: Typography.size.md, color: Colors.textPrimary, height: 44,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },

  coverToggle: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm },
  coverTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md },
  coverTabText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.textSecondary },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconOption: {
    width: 50, height: 50, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCardAlt, borderWidth: 1.5,
    borderColor: 'transparent',
  },

  photoPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  photoThumb: { width: 52, height: 52, borderRadius: 8 },
  photoPickerIcon: { fontSize: 32 },
  photoPickerText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.textSecondary },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorDot: { width: 36, height: 36, borderRadius: 18 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  toggleDesc: { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: 2 },

  saveBtn: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card,
  },
  saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.white },
  deleteBtn: { padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  deleteBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.danger },
});
