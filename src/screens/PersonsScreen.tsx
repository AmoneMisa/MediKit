import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store';
import { ensureAuth, addContact, removeContact, listContacts, contactToPerson } from '../api';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { EmptyState } from '../components';
import type { Person } from '../types';
import { useT } from '../i18n';

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bgPage },

    myCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: C.blue, margin: Spacing.lg,
      borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.card,
    },
    myAvatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    },
    myAvatarText: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: '#FFFFFF' },
    myName:       { fontSize: Typography.size.lg, fontWeight: Typography.weight.extrabold, color: '#FFFFFF' },
    myNickname:   { fontSize: Typography.size.base, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
    myHint:       { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

    listHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    },
    listTitle: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    addBtn:    { backgroundColor: C.blue, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 4, ...Shadow.sm },
    addBtnText: { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.white },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.md,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card,
    },
    avatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold, color: C.blue },
    info:       { flex: 1 },
    personName:     { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },
    personNickname: { fontSize: Typography.size.body, color: C.blue, marginTop: 1 },
    kitsLabel:  { fontSize: Typography.size.xs, color: C.success, marginTop: Spacing.xs, fontWeight: Typography.weight.semibold },
    noKits:     { fontSize: Typography.size.xs, color: C.textTertiary, marginTop: Spacing.xs },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modal: {
      backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.xl, paddingBottom: Spacing.xxxl,
    },
    modalTitle: {
      fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary, marginBottom: Spacing.xs,
    },
    modalSub: { fontSize: Typography.size.body, color: C.textSecondary, marginBottom: Spacing.lg },
    fieldLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textSecondary, textTransform: 'uppercase',
      letterSpacing: 0.4, marginBottom: 5,
    },
    fieldInput: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: Spacing.md, height: 44,
      fontSize: Typography.size.md, color: C.textPrimary, marginBottom: Spacing.md,
      textAlignVertical: 'center',
    },
    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl,
      padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm, ...Shadow.card,
    },
    saveBtnText:  { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },
    cancelBtn:    { alignItems: 'center', padding: Spacing.md, marginTop: Spacing.sm },
    cancelBtnText: { fontSize: Typography.size.base, color: C.textSecondary },
  });
}

export function PersonsScreen() {
  const persons      = useAppStore(s => s.persons);
  const addPerson    = useAppStore(s => s.addPerson);
  const deletePerson = useAppStore(s => s.deletePerson);
  const hydrate      = useAppStore(s => s.hydrate);
  const user         = useAppStore(s => s.user);
  const kits         = useAppStore(s => s.kits);
  const C      = useColors();
  const t      = useT();
  const s      = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [name,         setName]         = useState('');
  const [surname,      setSurname]      = useState('');
  const [nickname,     setNickname]     = useState('');

  // Refresh contacts from the server on mount (stays local-first if offline).
  useEffect(() => {
    (async () => {
      try {
        await ensureAuth();
        const contacts = await listContacts();
        hydrate({ persons: contacts.map(contactToPerson) });
      } catch { /* offline → keep local persons */ }
    })();
  }, [hydrate]);

  function openModal() {
    setName(''); setSurname(''); setNickname('');
    setModalVisible(true);
  }

  async function handleAdd() {
    const trimNickname = nickname.trim().replace(/^@/, '');
    if (!trimNickname) {
      Alert.alert(t('specify_nickname'), t('nickname_required_msg'));
      return;
    }
    setModalVisible(false);
    try {
      await ensureAuth();
      const contact = await addContact(trimNickname);
      addPerson(contactToPerson(contact));
    } catch {
      // Offline / unknown nickname → keep a local-only placeholder contact.
      const displayName = [name.trim(), surname.trim()].filter(Boolean).join(' ') || trimNickname;
      const words    = displayName.split(/\s+/);
      const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
      addPerson({
        id:             `person-${Date.now()}`,
        name:           displayName,
        surname:        surname.trim() || undefined,
        nickname:       trimNickname,
        avatarInitials: initials || trimNickname.slice(0, 2).toUpperCase(),
        sharedKitIds:   [],
        createdAt:      new Date().toISOString(),
      });
    }
  }

  function handleDelete(person: Person) {
    Alert.alert(t('delete_contact'), `${t('delete_contact')} @${person.nickname}?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: () => {
          deletePerson(person.id);
          ensureAuth().then(() => removeContact(person.id)).catch(() => { /* best-effort */ });
        },
      },
    ]);
  }

  const myNickname = user.nickname ?? t('not_set');

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
          <Text style={s.myHint}>{t('your_nickname_hint')}</Text>
        </View>
      </View>

      <View style={s.listHeader}>
        <Text style={s.listTitle}>{t('medikit_contacts')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openModal} activeOpacity={0.85}>
          <Icon name="plus" size={14} color={C.white} />
          <Text style={s.addBtnText}>{t('add')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={persons}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            kitten="waving"
            title={t('no_contacts')}
            subtitle={t('no_contacts_sub')}
            actionLabel={t('add_contact')}
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
                  <Text style={s.noKits}>{t('no_shared_kits')}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={18} color={C.textTertiary} />
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
          <View style={[s.modal, { paddingBottom: Math.max(Spacing.xxxl, insets.bottom + Spacing.lg) }]}>
            <Text style={s.modalTitle}>{t('add_contact')}</Text>
            <Text style={s.modalSub}>{t('enter_medikit_nickname')}</Text>

            <Text style={s.fieldLabel}>{t('nickname_label')}</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="@nickname"
              placeholderTextColor={C.textTertiary}
              value={nickname}
              onChangeText={t => setNickname(t.startsWith('@') ? t : `@${t}`)}
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Text style={s.fieldLabel}>{t('first_name')}</Text>
            <TextInput
              style={s.fieldInput}
              placeholder={t('first_name')}
              placeholderTextColor={C.textTertiary}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
            <Text style={s.fieldLabel}>{t('last_name')}</Text>
            <TextInput
              style={s.fieldInput}
              placeholder={t('last_name')}
              placeholderTextColor={C.textTertiary}
              value={surname}
              onChangeText={setSurname}
              returnKeyType="done"
            />

            <TouchableOpacity style={s.saveBtn} onPress={handleAdd} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>{t('add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
