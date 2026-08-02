import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Alert, Share, Linking,
  TextInput, Switch, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore } from '../store';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';
import type { DoctorAppointment, AppointmentAnalysis, AppointmentPrescription } from '../types';
import {
  scheduleAppointmentNotifications,
  cancelAppointmentNotifications,
} from '../utils/notificationScheduler';

// Try-require optional packages
let DocumentPicker: any = null;
let DatePicker: any = null;
let RNCalendarEvents: any = null;
let RNFS: any = null;
try { DocumentPicker = require('react-native-document-picker').default ?? require('react-native-document-picker'); } catch {}
try { DatePicker = require('react-native-date-picker').default; } catch {}
try { RNCalendarEvents = require('react-native-calendar-events').default ?? require('react-native-calendar-events'); } catch {}
try { RNFS = require('react-native-fs'); } catch {}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 80 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg,
      marginBottom: Spacing.md, gap: Spacing.sm,
    },
    title:    { flex: 1, fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    subtitle: { fontSize: Typography.size.body, color: C.textTertiary, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.sm, ...Shadow.card,
    },
    cardRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardDate: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    cardTime: { fontSize: Typography.size.body, color: C.textSecondary },
    cardDesc: { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 4 },

    statusBadge: {
      alignSelf: 'flex-start', borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3, marginTop: Spacing.xs,
    },
    statusText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold },

    onlineBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: '#E8F5E9', borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4,
    },
    onlineBadgeText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: '#388E3C' },

    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.sm, paddingVertical: 6,
      borderRadius: Radius.md, borderWidth: 1, borderColor: C.border,
    },
    actionText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.textSecondary },

    fab: {
      position: 'absolute', right: Spacing.lg, bottom: 28,
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
      ...Shadow.card,
    },

    emptyWrap: { alignItems: 'center', marginTop: 60, gap: Spacing.md },
    emptyText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.textSecondary },
    emptySub:  { fontSize: Typography.size.body, color: C.textTertiary, textAlign: 'center' },

    // Modal / form
    overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet:      { backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, maxHeight: '92%' },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: Spacing.sm },
    sheetTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary, padding: Spacing.lg, paddingBottom: Spacing.sm },
    sheetScroll: { padding: Spacing.lg, paddingTop: 0, paddingBottom: 40 },

    sec:  { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
    input: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
      padding: Spacing.md, fontSize: Typography.size.base, color: C.textPrimary,
      marginBottom: Spacing.sm,
    },
    multilineInput: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
      padding: Spacing.md, fontSize: Typography.size.base, color: C.textPrimary,
      minHeight: 72, textAlignVertical: 'top', marginBottom: Spacing.sm,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
    toggleLabel: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary },

    saveBtn: {
      backgroundColor: C.blue, borderRadius: Radius.xl,
      padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.lg,
    },
    saveBtnText: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: C.white },

    rxRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
    rxInput: { flex: 1, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, padding: Spacing.sm, fontSize: Typography.size.base, color: C.textPrimary },
    addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    addRowText: { fontSize: Typography.size.body, color: C.blue, fontWeight: Typography.weight.bold },

    analysisItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
    analysisName: { flex: 1, fontSize: Typography.size.base, color: C.textPrimary },
    analysisDate: { fontSize: Typography.size.xs, color: C.textTertiary },

    datePill: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: C.blueLight, borderRadius: Radius.md,
      padding: Spacing.md, marginBottom: Spacing.sm,
    },
    datePillText: { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.blueDark },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

function statusColor(status: DoctorAppointment['status']): { bg: string; fg: string } {
  switch (status) {
    case 'upcoming':   return { bg: '#E3F2FD', fg: '#1565C0' };
    case 'completed':  return { bg: '#E8F5E9', fg: '#2E7D32' };
    case 'cancelled':  return { bg: '#FFEBEE', fg: '#C62828' };
  }
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

/** Request calendar permission. Returns true if granted. */
async function requestCalendarPermission(): Promise<boolean> {
  if (!RNCalendarEvents) return false;
  try {
    const status = await RNCalendarEvents.requestPermissions();
    return status === 'authorized';
  } catch {
    return false;
  }
}

function buildCalendarDetails(appt: DoctorAppointment, doctorName: string) {
  const start = new Date(appt.dateTime);
  const end   = new Date(start.getTime() + 60 * 60 * 1000); // default +1 h
  return {
    startDate: start.toISOString(),
    endDate:   end.toISOString(),
    location:  appt.address  ?? '',
    notes:     [appt.description, appt.questionsForDoctor].filter(Boolean).join('\n\n'),
    url:       appt.meetLink ?? '',
    alarms:    [{ date: -60 }, { date: -1440 }], // 1 h and 24 h before (native calendar alerts)
  };
}

/**
 * Create a new calendar event. Returns the event ID, or null on failure.
 * Shows an Alert if permission was denied.
 */
async function createCalendarEvent(appt: DoctorAppointment, doctorName: string): Promise<string | null> {
  if (!RNCalendarEvents) return null;
  const granted = await requestCalendarPermission();
  if (!granted) {
    Alert.alert('Calendar permission denied', 'Please enable calendar access in Settings to add appointments.');
    return null;
  }
  try {
    const id = await RNCalendarEvents.saveEvent(
      `Dr. ${doctorName}`,
      buildCalendarDetails(appt, doctorName),
    );
    return id ?? null;
  } catch {
    return null;
  }
}

/**
 * Update an existing calendar event in-place. Falls back to recreating if the
 * event no longer exists. Returns the (possibly new) event ID.
 */
async function updateCalendarEvent(
  existingEventId: string,
  appt: DoctorAppointment,
  doctorName: string,
): Promise<string | null> {
  if (!RNCalendarEvents) return null;
  const granted = await requestCalendarPermission();
  if (!granted) return null;
  try {
    const id = await RNCalendarEvents.saveEvent(
      `Dr. ${doctorName}`,
      buildCalendarDetails(appt, doctorName),
      { id: existingEventId },
    );
    return id ?? existingEventId;
  } catch {
    // Event may have been deleted by the user in the system calendar — recreate it.
    return createCalendarEvent(appt, doctorName);
  }
}

/** Remove a calendar event silently. */
async function removeCalendarEvent(eventId: string): Promise<void> {
  if (!RNCalendarEvents) return;
  try { await RNCalendarEvents.removeEvent(eventId); } catch {}
}

// ─── Appointment card ─────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  doctorName,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  appt: DoctorAppointment;
  doctorName: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: DoctorAppointment['status']) => void;
}) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const { date, time } = formatDateTime(appt.dateTime);
  const { bg, fg } = statusColor(appt.status);

  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <Icon name="calendar" size={18} color={C.blue} />
        <Text style={s.cardDate}>{date}</Text>
        <Text style={s.cardTime}>{time}</Text>
        <View style={{ flex: 1 }} />
        {appt.calendarEventId ? (
          <Icon name="calendar-check" size={16} color="#2E7D32" />
        ) : null}
        <View style={[s.statusBadge, { backgroundColor: bg }]}>
          <Text style={[s.statusText, { color: fg }]}>{appt.status}</Text>
        </View>
      </View>

      {appt.isOnline && (
        <View style={s.onlineBadge}>
          <Icon name="video" size={12} color="#388E3C" />
          <Text style={s.onlineBadgeText}>Online</Text>
        </View>
      )}

      {appt.description ? <Text style={s.cardDesc}>{appt.description}</Text> : null}

      {appt.prescriptions.length > 0 && (
        <Text style={[s.cardDesc, { marginTop: Spacing.xs }]}>
          Rx: {appt.prescriptions.map(p => p.medicineName).join(', ')}
        </Text>
      )}
      {appt.analyses.length > 0 && (
        <Text style={[s.cardDesc]}>
          Analyses: {appt.analyses.map(a => a.name).join(', ')}
        </Text>
      )}

      <View style={s.actions}>
        {appt.meetLink ? (
          <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(appt.meetLink!)} activeOpacity={0.7}>
            <Icon name="video" size={13} color="#388E3C" />
            <Text style={[s.actionText, { color: '#388E3C' }]}>Join</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.actionBtn} onPress={onEdit} activeOpacity={0.7}>
          <Icon name="pencil" size={13} color={C.textSecondary} />
          <Text style={s.actionText}>Edit</Text>
        </TouchableOpacity>
        {appt.status === 'upcoming' && (
          <TouchableOpacity style={s.actionBtn} onPress={() => onStatusChange('completed')} activeOpacity={0.7}>
            <Icon name="check" size={13} color="#2E7D32" />
            <Text style={[s.actionText, { color: '#2E7D32' }]}>Done</Text>
          </TouchableOpacity>
        )}
        {appt.status === 'upcoming' && (
          <TouchableOpacity style={s.actionBtn} onPress={() => onStatusChange('cancelled')} activeOpacity={0.7}>
            <Icon name="close" size={13} color={C.danger} />
            <Text style={[s.actionText, { color: C.danger }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.actionBtn, { borderColor: C.danger }]} onPress={onDelete} activeOpacity={0.7}>
          <Icon name="delete" size={13} color={C.danger} />
          <Text style={[s.actionText, { color: C.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Appointment form modal ───────────────────────────────────────────────────

function AppointmentFormModal({
  visible, onClose, doctorId, doctorName, existing,
}: {
  visible: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName: string;
  existing?: DoctorAppointment;
}) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const doctors = useAppStore(st => st.doctors);

  const addAppointment    = useAppStore(st => st.addAppointment);
  const updateAppointment = useAppStore(st => st.updateAppointment);

  const now = new Date();
  const defaultPickerDate = () => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  };

  const [pickerDate,    setPickerDate]    = useState<Date>(existing?.dateTime ? new Date(existing.dateTime) : defaultPickerDate());
  const [showPicker,    setShowPicker]    = useState(false);
  const [isOnline,      setIsOnline]      = useState(existing?.isOnline ?? false);
  const [addToCalendar, setAddToCalendar] = useState(!!existing?.calendarEventId || (!existing && !!RNCalendarEvents));
  const [saving,        setSaving]        = useState(false);
  const [meetLink,    setMeetLink]    = useState(existing?.meetLink ?? '');
  const [address,     setAddress]     = useState(existing?.address ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [questions,   setQuestions]   = useState(existing?.questionsForDoctor ?? '');
  const [notes,       setNotes]       = useState(existing?.notes ?? '');

  const [prescriptions, setPrescriptions] = useState<AppointmentPrescription[]>(
    existing?.prescriptions ?? [],
  );
  const [analyses, setAnalyses] = useState<AppointmentAnalysis[]>(
    existing?.analyses ?? [],
  );

  function addPrescription() {
    setPrescriptions(p => [...p, { id: `rx-${Date.now()}`, medicineName: '', dosage: '' }]);
  }
  function updatePrescription(id: string, field: keyof AppointmentPrescription, val: string) {
    setPrescriptions(p => p.map(rx => rx.id === id ? { ...rx, [field]: val } : rx));
  }
  function removePrescription(id: string) {
    setPrescriptions(p => p.filter(rx => rx.id !== id));
  }

  async function pickAnalysis() {
    if (!DocumentPicker) {
      Alert.alert('Document picker not available', 'Install react-native-document-picker to attach files.');
      return;
    }
    try {
      const res = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles], allowMultiSelection: true });

      const newItems: AppointmentAnalysis[] = await Promise.all(
        res.map(async (r: any) => {
          const uid = `an-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          let localUri: string = r.uri;

          // Copy the file to permanent app storage so the URI stays valid after
          // the source app clears its cache or the user reboots ("Viber logic").
          if (RNFS) {
            try {
              const analysesDir = `${RNFS.DocumentDirectoryPath}/analyses`;
              await RNFS.mkdir(analysesDir).catch(() => {});
              const ext = (r.name as string | null)?.split('.').pop() ?? 'bin';
              const dest = `${analysesDir}/${uid}.${ext}`;
              await RNFS.copyFile(r.uri, dest);
              localUri = `file://${dest}`;
            } catch { /* fallback: keep original URI */ }
          }

          return {
            id: uid,
            name: r.name ?? 'Analysis',
            fileUri: localUri,
            mimeType: r.type,
            createdAt: new Date().toISOString(),
          };
        }),
      );

      setAnalyses(prev => [...prev, ...newItems]);
    } catch (e: any) {
      if (!DocumentPicker.isCancel?.(e)) Alert.alert('Error', String(e?.message ?? e));
    }
  }
  function removeAnalysis(id: string) {
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const isoDateTime = pickerDate.toISOString();
    const nowStr = new Date().toISOString();
    try {

    if (existing) {
      const updated: DoctorAppointment = {
        ...existing,
        dateTime: isoDateTime, isOnline,
        meetLink: isOnline && meetLink.trim() ? meetLink.trim() : undefined,
        address:  !isOnline && address.trim() ? address.trim() : undefined,
        description: description.trim() || undefined,
        questionsForDoctor: questions.trim() || undefined,
        notes: notes.trim() || undefined,
        prescriptions: prescriptions.filter(p => p.medicineName.trim()),
        analyses,
      };

      // Calendar: update, create, or remove depending on toggle and existing state
      if (addToCalendar) {
        if (existing.calendarEventId) {
          const newId = await updateCalendarEvent(existing.calendarEventId, updated, doctorName);
          updated.calendarEventId = newId ?? undefined;
        } else {
          const newId = await createCalendarEvent(updated, doctorName);
          updated.calendarEventId = newId ?? undefined;
        }
      } else if (!addToCalendar && existing.calendarEventId) {
        await removeCalendarEvent(existing.calendarEventId);
        updated.calendarEventId = undefined;
      }

      updateAppointment(existing.id, updated);
      cancelAppointmentNotifications(existing.id).then(() =>
        scheduleAppointmentNotifications(updated, doctorName),
      ).catch(() => {});
    } else {
      const appt: DoctorAppointment = {
        id: `appt-${Date.now()}`,
        doctorId,
        dateTime: isoDateTime,
        isOnline,
        meetLink: isOnline && meetLink.trim() ? meetLink.trim() : undefined,
        address:  !isOnline && address.trim() ? address.trim() : undefined,
        description: description.trim() || undefined,
        questionsForDoctor: questions.trim() || undefined,
        notes: notes.trim() || undefined,
        prescriptions: prescriptions.filter(p => p.medicineName.trim()),
        analyses,
        status: 'upcoming',
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      if (addToCalendar) {
        const calId = await createCalendarEvent(appt, doctorName);
        if (calId) appt.calendarEventId = calId;
      }

      addAppointment(appt);
      scheduleAppointmentNotifications(appt, doctorName).catch(() => {});
    }
    onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save appointment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{existing ? 'Edit Appointment' : 'New Appointment'}</Text>

            <ScrollView style={s.sheetScroll} keyboardShouldPersistTaps="handled">

              {/* Date & Time */}
              <Text style={s.sec}>Date & Time</Text>
              <TouchableOpacity style={s.datePill} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
                <Icon name="calendar-clock" size={20} color={C.blueDark} />
                <Text style={s.datePillText}>
                  {pickerDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  {'  '}
                  {pickerDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>

              {/* Online / offline toggle */}
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>Online meet</Text>
                <Switch value={isOnline} onValueChange={setIsOnline} trackColor={{ true: C.blue, false: C.border }} thumbColor={C.white} />
              </View>

              {/* Add to calendar toggle — shown only when the library is available */}
              {RNCalendarEvents ? (
                <View style={s.toggleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <Icon name="calendar-check" size={18} color={addToCalendar ? C.blue : C.textTertiary} />
                    <Text style={s.toggleLabel}>Add to device calendar</Text>
                  </View>
                  <Switch
                    value={addToCalendar}
                    onValueChange={setAddToCalendar}
                    trackColor={{ true: C.blue, false: C.border }}
                    thumbColor={C.white}
                  />
                </View>
              ) : null}

              {isOnline ? (
                <>
                  <Text style={s.sec}>Meeting link (Zoom / Google Meet)</Text>
                  <TextInput style={s.input} value={meetLink} onChangeText={setMeetLink} placeholder="https://..." placeholderTextColor={C.textTertiary} autoCapitalize="none" />
                </>
              ) : (
                <>
                  <Text style={s.sec}>Address</Text>
                  <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Clinic address" placeholderTextColor={C.textTertiary} />
                </>
              )}

              {/* Description */}
              <Text style={s.sec}>Description / purpose</Text>
              <TextInput style={s.multilineInput} value={description} onChangeText={setDescription} placeholder="What is this visit for?" placeholderTextColor={C.textTertiary} multiline />

              {/* Questions for doctor */}
              <Text style={s.sec}>Questions for doctor</Text>
              <TextInput style={s.multilineInput} value={questions} onChangeText={setQuestions} placeholder="What would you like to ask?" placeholderTextColor={C.textTertiary} multiline />

              {/* Prescriptions */}
              <Text style={s.sec}>Prescribed medicines</Text>
              {prescriptions.map(rx => (
                <View key={rx.id} style={s.rxRow}>
                  <TextInput
                    style={[s.rxInput]}
                    value={rx.medicineName}
                    onChangeText={v => updatePrescription(rx.id, 'medicineName', v)}
                    placeholder="Medicine name"
                    placeholderTextColor={C.textTertiary}
                  />
                  <TextInput
                    style={[s.rxInput, { maxWidth: 90 }]}
                    value={rx.dosage}
                    onChangeText={v => updatePrescription(rx.id, 'dosage', v)}
                    placeholder="Dosage"
                    placeholderTextColor={C.textTertiary}
                  />
                  <TouchableOpacity onPress={() => removePrescription(rx.id)} hitSlop={8}>
                    <Icon name="close" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addRowBtn} onPress={addPrescription} activeOpacity={0.7}>
                <Icon name="plus" size={14} color={C.blue} />
                <Text style={s.addRowText}>Add medicine</Text>
              </TouchableOpacity>

              {/* Analyses */}
              <Text style={s.sec}>Attached analyses / documents</Text>
              {analyses.map(a => (
                <View key={a.id} style={s.analysisItem}>
                  <Icon name="file-document" size={16} color={C.blue} />
                  <Text style={s.analysisName} numberOfLines={1}>{a.name}</Text>
                  {a.date ? <Text style={s.analysisDate}>{a.date}</Text> : null}
                  <TouchableOpacity onPress={() => removeAnalysis(a.id)} hitSlop={8}>
                    <Icon name="close" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addRowBtn} onPress={pickAnalysis} activeOpacity={0.7}>
                <Icon name="paperclip" size={14} color={C.blue} />
                <Text style={s.addRowText}>Attach file / analysis</Text>
              </TouchableOpacity>

              {/* Post-visit notes */}
              <Text style={s.sec}>Post-visit notes</Text>
              <TextInput style={s.multilineInput} value={notes} onChangeText={setNotes} placeholder="Notes after the visit..." placeholderTextColor={C.textTertiary} multiline />

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      {DatePicker && (
        <DatePicker
          modal
          open={showPicker}
          date={pickerDate}
          mode="datetime"
          minimumDate={new Date()}
          onConfirm={(date: Date) => { setPickerDate(date); setShowPicker(false); }}
          onCancel={() => setShowPicker(false)}
          title="Appointment date & time"
          confirmText="Confirm"
          cancelText="Cancel"
        />
      )}
    </Modal>
  );
}

// ─── AppointmentsScreen ───────────────────────────────────────────────────────

export function AppointmentsScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);

  const { doctorId } = route.params as { doctorId: string };

  const doctors          = useAppStore(st => st.doctors);
  const appointments     = useAppStore(st => st.appointments);
  const updateAppointment = useAppStore(st => st.updateAppointment);
  const deleteAppointment = useAppStore(st => st.deleteAppointment);

  const doctor = doctors.find(d => d.id === doctorId);
  const doctorName = doctor?.name ?? 'Doctor';

  const appts = useMemo(
    () => appointments
      .filter(a => a.doctorId === doctorId)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()),
    [appointments, doctorId],
  );

  const [showForm,    setShowForm]    = useState(false);
  const [editingAppt, setEditingAppt] = useState<DoctorAppointment | undefined>();

  function handleEdit(appt: DoctorAppointment) {
    setEditingAppt(appt);
    setShowForm(true);
  }

  function handleDelete(appt: DoctorAppointment) {
    Alert.alert('Delete appointment?', formatDateTime(appt.dateTime).date, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          deleteAppointment(appt.id);
          await cancelAppointmentNotifications(appt.id).catch(() => {});
          if (appt.calendarEventId) await removeCalendarEvent(appt.calendarEventId).catch(() => {});
        },
      },
    ]);
  }

  function handleStatusChange(appt: DoctorAppointment, status: DoctorAppointment['status']) {
    updateAppointment(appt.id, { status });
    if (status !== 'upcoming') {
      cancelAppointmentNotifications(appt.id).catch(() => {});
    }
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-left" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>{doctorName}</Text>
        <Text style={{ fontSize: Typography.size.body, color: C.textTertiary }}>
          {doctor?.speciality ?? ''}
        </Text>
      </View>
      <Text style={s.subtitle}>Appointment history — {appts.length} total</Text>

      {appts.length === 0 ? (
        <View style={s.emptyWrap}>
          <Icon name="calendar-clock" size={54} color={C.textTertiary} />
          <Text style={s.emptyText}>No appointments yet</Text>
          <Text style={s.emptySub}>Tap + to schedule the first one</Text>
        </View>
      ) : (
        <FlatList
          data={appts}
          keyExtractor={a => a.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <AppointmentCard
              appt={item}
              doctorName={doctorName}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              onStatusChange={status => handleStatusChange(item, status)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => { setEditingAppt(undefined); setShowForm(true); }}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {showForm && (
        <AppointmentFormModal
          visible={showForm}
          onClose={() => { setShowForm(false); setEditingAppt(undefined); }}
          doctorId={doctorId}
          doctorName={doctorName}
          existing={editingAppt}
        />
      )}
    </SafeAreaView>
  );
}

// ─── AnalysesArchiveScreen ────────────────────────────────────────────────────

export function AnalysesArchiveScreen() {
  const navigation = useNavigation<any>();
  const C          = useColors();
  const s          = useMemo(() => makeStyles(C), [C]);

  const appointments = useAppStore(st => st.appointments);
  const doctors      = useAppStore(st => st.doctors);

  const doctorMap = useMemo(() => new Map(doctors.map(d => [d.id, d.name])), [doctors]);

  // Flatten all analyses across all appointments, annotated with doctor + date
  const allAnalyses = useMemo(() => {
    const list: Array<AppointmentAnalysis & { doctorName: string; apptDate: string }> = [];
    for (const appt of appointments) {
      for (const an of appt.analyses) {
        list.push({
          ...an,
          doctorName: doctorMap.get(appt.doctorId) ?? 'Unknown',
          apptDate: formatDateTime(appt.dateTime).date,
        });
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [appointments, doctorMap]);

  async function shareFile(analysis: AppointmentAnalysis) {
    if (!analysis.fileUri) { Alert.alert('No file attached'); return; }
    try {
      await Share.share({ url: analysis.fileUri, title: analysis.name });
    } catch {
      Alert.alert('Cannot share this file');
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-left" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Analyses Archive</Text>
      </View>
      <Text style={s.subtitle}>{allAnalyses.length} documents across all appointments</Text>

      {allAnalyses.length === 0 ? (
        <View style={s.emptyWrap}>
          <Icon name="file-document-multiple" size={54} color={C.textTertiary} />
          <Text style={s.emptyText}>No analyses yet</Text>
          <Text style={s.emptySub}>Attach files when creating appointments</Text>
        </View>
      ) : (
        <FlatList
          data={allAnalyses}
          keyExtractor={a => a.id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: Spacing.md }]}>
              <Icon name="file-document" size={28} color={C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.textPrimary }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ fontSize: Typography.size.xs, color: C.textTertiary }}>{item.doctorName} · {item.apptDate}</Text>
                {item.notes ? <Text style={{ fontSize: Typography.size.xs, color: C.textSecondary }}>{item.notes}</Text> : null}
              </View>
              {item.fileUri ? (
                <TouchableOpacity onPress={() => shareFile(item)} hitSlop={8}>
                  <Icon name="download" size={22} color={C.blue} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
