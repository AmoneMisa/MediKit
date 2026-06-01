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

const FORM_LABELS: Record<string, string> = {
  tablets: 'Таблетки', capsules: 'Капсулы', syrup: 'Сироп',
  spray: 'Спрей', drops: 'Капли', ointment: 'Мазь',
  injection: 'Инъекция', powder: 'Порошок', patch: 'Пластырь', other: 'Другое',
};

const TAG_LABELS: Record<string, string> = {
  pain: 'Боль', fever: 'Температура', sleep: 'Сон', allergy: 'Аллергия',
  cold: 'Простуда', stomach: 'ЖКТ', heart: 'Сердце', nerves: 'Нервы',
  muscles: 'Мышцы', antiseptic: 'Антисептик', antibiotic: 'Антибиотик',
  vitamins: 'Витамины', pressure: 'Давление', skin: 'Кожа', eyes: 'Глаза',
  diabetes: 'Диабет',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildShareText(medicine: NonNullable<ReturnType<ReturnType<typeof useAppStore>['getMedicine']>>, expiryLabel: string): string {
  const lines: string[] = [];
  lines.push(`💊 ${medicine.name}${medicine.dosage ? ` ${medicine.dosage}` : ''}`);
  lines.push(`📋 Форма: ${FORM_LABELS[medicine.form] ?? medicine.form}`);
  if (medicine.manufacturer) lines.push(`🏭 Производитель: ${medicine.manufacturer}`);
  if (medicine.activeIngredient) lines.push(`🔬 Д.в.: ${medicine.activeIngredient}`);
  lines.push(`📦 Остаток: ${medicine.remainingQuantity} из ${medicine.totalQuantity}`);
  lines.push(`📅 Срок годности: ${expiryLabel}`);
  if (medicine.tags && medicine.tags.length > 0) {
    const tagStr = medicine.tags.map(t => TAG_LABELS[t] ?? t).join(', ');
    lines.push(`🏷 Применяется при: ${tagStr}`);
  }
  if (medicine.description) lines.push(`\nℹ️ ${medicine.description}`);
  if (medicine.usageNotes)   lines.push(`\n💡 ${medicine.usageNotes}`);
  if (medicine.warnings && medicine.warnings.length > 0) {
    lines.push(`\n⚠️ Противопоказания: ${medicine.warnings.join(', ')}`);
  }
  if (medicine.storageNotes) lines.push(`🌡 Хранение: ${medicine.storageNotes}`);
  lines.push('\n📲 Добавьте этот препарат в MediKit: https://medikit.app');
  return lines.join('\n');
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 40 },

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
    warnTag: { backgroundColor: C.warningLight, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
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

  if (!medicine) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={{ padding: 20, color: C.textPrimary }}>Препарат не найден</Text>
      </SafeAreaView>
    );
  }

  const shareText = buildShareText(medicine, expiryInfo.label);
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
                {FORM_LABELS[medicine.form] ?? medicine.form}
              </Text>
              <StatusBadge status={status} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
            </View>
          </View>

          <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
            <Icon name="package-variant" size={16} color={C.textTertiary} />
            <Text style={s.infoLabel}>Остаток</Text>
            <Text style={s.infoVal}>{medicine.remainingQuantity} из {medicine.totalQuantity}</Text>
          </View>
          <View style={s.infoRow}>
            <Icon name="calendar" size={16} color={expiryInfo.isExpired ? C.danger : C.textTertiary} />
            <Text style={s.infoLabel}>Срок годности</Text>
            <Text style={[s.infoVal, expiryInfo.isExpired && { color: C.dangerDark }]}>{expiryInfo.label}</Text>
          </View>
          {kit ? (
            <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
              <Icon name="medical-bag" size={16} color={C.textTertiary} />
              <Text style={s.infoLabel}>Аптечка</Text>
              <Text style={s.infoVal}>{kit.icon} {kit.name}</Text>
            </View>
          ) : null}

          {medicine.tags && medicine.tags.length > 0 && (
            <View style={s.tagRow}>
              {medicine.tags.map(t => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>{TAG_LABELS[t] ?? t}</Text>
                </View>
              ))}
            </View>
          )}
          {medicine.warnings && medicine.warnings.length > 0 && (
            <View style={s.warnRow}>
              {medicine.warnings.map((w, i) => (
                <View key={i} style={s.warnTag}>
                  <Text style={s.warnText}>⚠️ {w}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Share buttons ── */}
        <Text style={s.sectionLabel}>{t('share_via')}</Text>

        <TouchableOpacity style={[s.shareBtn, s.tgBtn]} onPress={handleTelegram} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>✈️</Text>
          <Text style={s.shareBtnText}>Telegram</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.shareBtn, s.waBtn]} onPress={handleWhatsApp} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>💬</Text>
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
