import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Share, Alert, Clipboard, Image,
} from 'react-native';
import { useT } from '../i18n';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { KitsStackParamList } from '../types';
import { useAppStore, getMedicineStatus } from '../store';
import { useExpiryLabel } from '../hooks';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { MedicineIcon, StatusBadge } from '../components';

type Route = RouteProp<KitsStackParamList, 'ShareMedicine'>;

function makeFormLabels(t: (k: any) => string): Record<string, string> {
  return {
    tablets: t('shm_form_tablets'), capsules: t('shm_form_capsules'), syrup: t('shm_form_syrup'),
    spray: t('shm_form_spray'), drops: t('shm_form_drops'), ointment: t('shm_form_ointment'),
    injection: t('shm_form_injection'), powder: t('shm_form_powder'), patch: t('shm_form_patch'), other: t('shm_form_other'),
  };
}

function makeTagLabels(t: (k: any) => string): Record<string, string> {
  return {
    pain: t('shm_tag_pain'), fever: t('shm_tag_fever'), sleep: t('shm_tag_sleep'), allergy: t('shm_tag_allergy'),
    cold: t('shm_tag_cold'), stomach: t('shm_tag_stomach'), heart: t('shm_tag_heart'), nerves: t('shm_tag_nerves'),
    muscles: t('shm_tag_muscles'), antiseptic: t('shm_tag_antiseptic'), antibiotic: t('shm_tag_antibiotic'),
    vitamins: t('shm_tag_vitamins'), pressure: t('shm_tag_pressure'), skin: t('shm_tag_skin'), eyes: t('shm_tag_eyes'),
    diabetes: t('shm_tag_diabetes'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildShareText(
  medicine: NonNullable<ReturnType<ReturnType<typeof useAppStore>['getMedicine']>>,
  expiryLabel: string,
  t: (k: any) => string,
  formLabels: Record<string, string>,
  tagLabels: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push(`💊 ${medicine.name}${medicine.dosage ? ` ${medicine.dosage}` : ''}`);
  lines.push(`📋 ${t('shm_share_form')} ${formLabels[medicine.form] ?? medicine.form}`);
  if (medicine.manufacturer) lines.push(`🏭 ${t('shm_share_manufacturer')} ${medicine.manufacturer}`);
  if (medicine.activeIngredient) lines.push(`🔬 ${t('shm_share_active_ingredient')} ${medicine.activeIngredient}`);
  lines.push(`📦 ${t('shm_share_remaining')} ${medicine.remainingQuantity} ${t('shm_share_of')} ${medicine.totalQuantity}`);
  lines.push(`📅 ${t('shm_share_expiry')} ${expiryLabel}`);
  if (medicine.tags && medicine.tags.length > 0) {
    const tagStr = medicine.tags.map(tag => tagLabels[tag] ?? tag).join(', ');
    lines.push(`🏷 ${t('shm_share_used_for')} ${tagStr}`);
  }
  if (medicine.description) lines.push(`\nℹ️ ${medicine.description}`);
  if (medicine.usageNotes)   lines.push(`\n💡 ${medicine.usageNotes}`);
  if (medicine.warnings && medicine.warnings.length > 0) {
    lines.push(`\n⚠️ ${t('shm_share_contraindications')} ${medicine.warnings.join(', ')}`);
  }
  if (medicine.storageNotes) lines.push(`🌡 ${t('shm_share_storage')} ${medicine.storageNotes}`);
  lines.push(`\n📲 ${t('shm_share_footer')}`);
  return lines.join('\n');
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 100 },

    previewCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.lg, marginBottom: Spacing.lg,
      borderLeftWidth: 4, borderLeftColor: C.blue,
      ...Shadow.card,
    },
    previewHero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    previewPhoto: { width: 56, height: 56, borderRadius: Radius.md },
    previewName:  { fontSize: Typography.size.xl, fontWeight: Typography.weight.extrabold, color: C.textPrimary },
    previewForm:  { fontSize: Typography.size.body, color: C.textSecondary, marginTop: 2 },

    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    infoLabel: { flex: 1, fontSize: Typography.size.body, color: C.textSecondary },
    infoVal:   { fontSize: Typography.size.body, fontWeight: Typography.weight.bold, color: C.textPrimary },

    tagRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
    tag:     { backgroundColor: C.blueLight, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
    tagText: { fontSize: Typography.size.xs, color: C.blue, fontWeight: Typography.weight.semibold },

    warnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    warnTag: { backgroundColor: C.warningLight, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
    warnText: { fontSize: Typography.size.xs, color: C.warningDark, fontWeight: Typography.weight.semibold },

    sectionLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },

    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg,
      marginBottom: Spacing.sm, ...Shadow.sm,
    },
    tgBtn:      { backgroundColor: '#29B6F6' },
    waBtn:      { backgroundColor: '#25D366' },
    nativeBtn:  { backgroundColor: C.blue },
    copyBtn:    { backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border },
    shareBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white },

    textPreviewCard: {
      backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
      padding: Spacing.md, marginTop: Spacing.md,
    },
    textPreviewLabel: {
      fontSize: Typography.size.xs, fontWeight: Typography.weight.bold,
      color: C.textTertiary, marginBottom: Spacing.xs, textTransform: 'uppercase',
    },
    textPreviewBody: {
      fontSize: Typography.size.body, color: C.textSecondary, lineHeight: 20,
    },
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ShareMedicineScreen() {
  const route  = useRoute<Route>();
  const { medicineId, kitId } = route.params;
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const t = useT();

  const medicine = useAppStore(st => st.getMedicine(medicineId));
  const kit      = useAppStore(st => st.getKit(kitId));
  const expiryInfo = useExpiryLabel(medicine?.expirationDate ?? new Date().toISOString());

  const [copied, setCopied] = useState(false);

  const formLabels = makeFormLabels(t);
  const tagLabels  = makeTagLabels(t);

  if (!medicine) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={{ padding: 20, color: C.textPrimary }}>{t('medicine_not_found')}</Text>
      </SafeAreaView>
    );
  }

  const shareText = buildShareText(medicine, expiryInfo.label, t, formLabels, tagLabels);
  const status    = getMedicineStatus(medicine);

  async function handleNativeShare() {
    try {
      await Share.share({ message: shareText, title: medicine!.name });
    } catch {}
  }

  async function handleTelegram() {
    try {
      await Share.share({ message: shareText });
    } catch {}
  }

  async function handleWhatsApp() {
    try {
      await Share.share({ message: shareText });
    } catch {}
  }

  function handleCopy() {
    try { (Clipboard as any).setString(shareText); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Preview card ── */}
        <View style={s.previewCard}>
          <View style={s.previewHero}>
            {medicine.photoUri ? (
              <Image source={{ uri: medicine.photoUri }} style={s.previewPhoto} resizeMode="cover" />
            ) : (
              <MedicineIcon form={medicine.form} size={56} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.previewName}>{medicine.name}</Text>
              <Text style={s.previewForm}>
                {medicine.dosage ? `${medicine.dosage} · ` : ''}
                {formLabels[medicine.form] ?? medicine.form}
              </Text>
              <StatusBadge status={status} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
            </View>
          </View>

          <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
            <Icon name="package-variant" size={16} color={C.textTertiary} />
            <Text style={s.infoLabel}>{t('remaining')}</Text>
            <Text style={s.infoVal}>{medicine.remainingQuantity} {t('shm_share_of')} {medicine.totalQuantity}</Text>
          </View>
          <View style={s.infoRow}>
            <Icon name="calendar" size={16} color={expiryInfo.isExpired ? C.danger : C.textTertiary} />
            <Text style={s.infoLabel}>{t('expiry_date')}</Text>
            <Text style={[s.infoVal, expiryInfo.isExpired && { color: C.dangerDark }]}>{expiryInfo.label}</Text>
          </View>
          {kit ? (
            <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
              <Icon name="medical-bag" size={16} color={C.textTertiary} />
              <Text style={s.infoLabel}>{t('kit_label')}</Text>
              <Text style={s.infoVal}>{kit.icon} {kit.name}</Text>
            </View>
          ) : null}

          {medicine.tags && medicine.tags.length > 0 && (
            <View style={s.tagRow}>
              {medicine.tags.map(tag => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>{tagLabels[tag] ?? tag}</Text>
                </View>
              ))}
            </View>
          )}
          {medicine.warnings && medicine.warnings.length > 0 && (
            <View style={s.warnRow}>
              {medicine.warnings.map((w, i) => (
                <View key={i} style={s.warnTag}>
                  <Icon name="alert" size={13} color={C.warningDark} />{' '}<Text style={s.warnText}>{w}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Share buttons ── */}
        <Text style={s.sectionLabel}>{t('share_via')}</Text>

        <TouchableOpacity style={[s.shareBtn, s.tgBtn]} onPress={handleTelegram} activeOpacity={0.85}>
          <Icon name="send" size={20} color={C.white} />
          <Text style={s.shareBtnText}>Telegram</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.shareBtn, s.waBtn]} onPress={handleWhatsApp} activeOpacity={0.85}>
          <Icon name="whatsapp" size={20} color={C.white} />
          <Text style={s.shareBtnText}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.shareBtn, s.nativeBtn]} onPress={handleNativeShare} activeOpacity={0.85}>
          <Icon name="share-variant" size={20} color={C.white} />
          <Text style={s.shareBtnText}>{t('other_app')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.shareBtn, s.copyBtn]} onPress={handleCopy} activeOpacity={0.85}>
          <Icon name={copied ? 'check' : 'content-copy'} size={20} color={C.blue} />
          <Text style={[s.shareBtnText, { color: C.blue }]}>
            {copied ? t('copied') : t('copy_text')}
          </Text>
        </TouchableOpacity>

        {/* ── Text preview ── */}
        <View style={s.textPreviewCard}>
          <Text style={s.textPreviewLabel}>{t('text_preview')}</Text>
          <Text style={s.textPreviewBody}>{shareText}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
