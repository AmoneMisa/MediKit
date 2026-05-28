import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAppStore } from '../store';
import { Colors, Spacing, Typography, Radius, Shadow } from '../theme';
import { EmptyState } from '../components';
import type { Person } from '../types';

export function PersonsScreen() {
  const persons      = useAppStore(s => s.persons);
  const addPerson    = useAppStore(s => s.addPerson);
  const deletePerson = useAppStore(s => s.deletePerson);
  const user         = useAppStore(s => s.user);
  const kits         = useAppStore(s => s.kits);

  const [modalVisible, setModalVisible] = useState(false);
  const [name,         setName]         = useState('');
  const [surname,      setSurname]      = useState('');
  const [nickname,     setNickname]     = useState('');

  function openModal() {
    setName(''); setSurname(''); setNickname('');
    setModalVisible(true);
  }

  function handleAdd() {
    const trimNickname = nickname.trim().replace(/^@/, '');
    if (!trimNickname) {
      Alert.alert('Укажите никнейм', 'Никнейм обязателен для поиска пользователя.');
      return;
    }
    const displayName = [name.trim(), surname.trim()].filter(Boolean).join(' ') || trimNickname;
    const words = displayName.split(/\s+/);
    const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
    addPerson({
      id:            `person-${Date.now()}`,
      name:          displayName,
      surname:       surname.trim() || undefined,
      nickname:      trimNickname,
      avatarInitials: initials || trimNickname.slice(0, 2).toUpperCase(),
      sharedKitIds:  [],
      createdAt:     new Date().toISOString(),
    });
    setModalVisible(false);
  }

  function handleDelete(person: Person) {
    Alert.alert('Удалить контакт', `Удалить @${person.nickname}?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => deletePerson(person.id) },
    ]);
  }

  const myNickname = user.nickname ?? 'не задан';

  return (
    <SafeAreaView style={s.root}>
      {/* My profile card */}
      <View style={s.myCard}>
        <View style={s.myAvatar}>
          <Text style={s.myAvatarText}>{user.avatarInitials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.myName}>{[user.name, user.surname].filter(Boolean).join(' ')}</Text>
          <Text style={s.myNickname}>@{myNickname}</Text>
          <Text style={s.myHint}>Ваш никнейм — поделитесь им, чтобы вас нашли</Text>
        </View>
      </View>

      <View style={s.listHeader}>
        <Text style={s.listTitle}>Контакты MediKit</Text>
        <TouchableOpacity style={s.addBtn} onPress={openModal} activeOpacity={0.85}>
          <Text style={s.addBtnText}>＋ Добавить</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={persons}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            emoji="👥"
            title="Нет контактов"
            subtitle="Добавьте других пользователей MediKit по никнейму, чтобы делиться аптечками"
            actionLabel="Добавить контакт"
            onAction={openModal}
          />
        }
        renderItem={({ item }) => {
          const sharedKits = kits.filter(k => item.sharedKitIds.includes(k.id));
          return (
            <View style={s.card}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.avatarInitials}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.personName}>{item.name}</Text>
                <Text style={s.personNickname}>@{item.nickname}</Text>
                {sharedKits.length > 0 ? (
                  <Text style={s.kitsLabel}>
                    {sharedKits.map(k => `${k.icon} ${k.name}`).join('  ')}
                  </Text>
                ) : (
                  <Text style={s.noKits}>Нет общих аптечек</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.deleteIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modal}>
            <Text style={s.modalTitle}>Добавить контакт</Text>
            <Text style={s.modalSub}>Введите никнейм пользователя MediKit</Text>

            <Text style={s.fieldLabel}>Никнейм *</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="@nickname"
              placeholderTextColor={Colors.textTertiary}
              value={nickname}
              onChangeText={t => setNickname(t.startsWith('@') ? t : `@${t}`)}
              autoCapitalize="none"
              returnKeyType="next"
            />

            <Text style={s.fieldLabel}>Имя</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="Имя"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />

            <Text style={s.fieldLabel}>Фамилия</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="Фамилия"
              placeholderTextColor={Colors.textTertiary}
              value={surname}
              onChangeText={setSurname}
              returnKeyType="done"
            />

            <TouchableOpacity style={s.saveBtn} onPress={handleAdd} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Добавить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPage },

  myCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.blue, margin: Spacing.lg,
    borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.card,
  },
  myAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  myAvatarText: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: Colors.white },
  myName: { fontSize: Typography.size.lg, fontWeight: Typography.weight.extrabold, color: Colors.white },
  myNickname: { fontSize: Typography.size.base, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  myHint: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  listTitle: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  addBtn: {
    backgroundColor: Colors.blue, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, ...Shadow.sm,
  },
  addBtnText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: Colors.white },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.blueLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold, color: Colors.blue },
  info: { flex: 1 },
  personName: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.textPrimary },
  personNickname: { fontSize: Typography.size.body, color: Colors.blue, marginTop: 1 },
  kitsLabel: { fontSize: Typography.size.xs, color: Colors.success, marginTop: Spacing.xs, fontWeight: Typography.weight.semibold },
  noKits: { fontSize: Typography.size.xs, color: Colors.textTertiary, marginTop: Spacing.xs },
  deleteIcon: { fontSize: 16, color: Colors.textTertiary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl, paddingBottom: Spacing.xxxl,
  },
  modalTitle: {
    fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold,
    color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  modalSub: { fontSize: Typography.size.body, color: Colors.textSecondary, marginBottom: Spacing.lg },
  fieldLabel: {
    fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
    color: Colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 5,
  },
  fieldInput: {
    backgroundColor: Colors.bgPage, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 44,
    fontSize: Typography.size.md, color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  saveBtn: {
    backgroundColor: Colors.blue, borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm, ...Shadow.card,
  },
  saveBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.white },
  cancelBtn: { alignItems: 'center', padding: Spacing.md, marginTop: Spacing.sm },
  cancelBtnText: { fontSize: Typography.size.base, color: Colors.textSecondary },
});
