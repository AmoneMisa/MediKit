import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Linking, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';
import { useT } from '../i18n';

const CONTACT_EMAIL = 'kubai.rita2@gmail.com';

// ── Data ──────────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

interface Section {
  icon: string;
  title: string;
  items: FaqItem[];
}

const SECTIONS: Section[] = [
  {
    icon: 'pill',
    title: 'help_sec_add_title',
    items: [
      {
        q: 'help_add_q1',
        a: 'help_add_a1',
      },
      {
        q: 'help_add_q2',
        a: 'help_add_a2',
      },
      {
        q: 'help_add_q3',
        a: 'help_add_a3',
      },
      {
        q: 'help_add_q4',
        a: 'help_add_a4',
      },
    ],
  },
  {
    icon: 'bell-outline',
    title: 'help_sec_reminders_title',
    items: [
      {
        q: 'help_rem_q1',
        a: 'help_rem_a1',
      },
      {
        q: 'help_rem_q2',
        a: 'help_rem_a2',
      },
      {
        q: 'help_rem_q3',
        a: 'help_rem_a3',
      },
    ],
  },
  {
    icon: 'share-variant',
    title: 'help_sec_share_title',
    items: [
      {
        q: 'help_share_q1',
        a: 'help_share_a1',
      },
      {
        q: 'help_share_q2',
        a: 'help_share_a2',
      },
      {
        q: 'help_share_q3',
        a: 'help_share_a3',
      },
    ],
  },
  {
    icon: 'book-open-outline',
    title: 'help_sec_journal_title',
    items: [
      {
        q: 'help_journal_q1',
        a: 'help_journal_a1',
      },
      {
        q: 'help_journal_q2',
        a: 'help_journal_a2',
      },
    ],
  },
  {
    icon: 'cart-outline',
    title: 'help_sec_shopping_title',
    items: [
      {
        q: 'help_shop_q1',
        a: 'help_shop_a1',
      },
      {
        q: 'help_shop_q2',
        a: 'help_shop_a2',
      },
    ],
  },
  {
    icon: 'calendar-account',
    title: 'help_sec_appts_title',
    items: [
      {
        q: 'help_appt_q1',
        a: 'help_appt_a1',
      },
      {
        q: 'help_appt_q2',
        a: 'help_appt_a2',
      },
      {
        q: 'help_appt_q3',
        a: 'help_appt_a3',
      },
    ],
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: ColorPalette) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bgPage },
    scroll: { padding: Spacing.lg, paddingBottom: 48 },

    heroCard: {
      backgroundColor: C.blueLight, borderRadius: Radius.xl,
      padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.xl,
    },
    heroTitle: {
      fontSize: Typography.size.xxl, fontWeight: Typography.weight.extrabold,
      color: C.blueDark, marginTop: Spacing.md, marginBottom: Spacing.xs, textAlign: 'center',
    },
    heroSub: {
      fontSize: Typography.size.body, color: C.blue,
      textAlign: 'center', lineHeight: Typography.size.body * 1.5,
    },

    sectionCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      marginBottom: Spacing.md, overflow: 'hidden', ...Shadow.card,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    sectionTitle: {
      flex: 1,
      fontSize: Typography.size.base, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary,
    },

    faqItem: {
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    faqQuestion: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingVertical: Spacing.md,
    },
    faqQText: {
      flex: 1, fontSize: Typography.size.md,
      fontWeight: Typography.weight.semibold, color: C.textPrimary,
    },
    faqAnswer: {
      fontSize: Typography.size.body, color: C.textSecondary,
      lineHeight: Typography.size.body * 1.6,
      paddingBottom: Spacing.md,
    },

    contactCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.xl,
      padding: Spacing.xl, alignItems: 'center',
      marginTop: Spacing.sm, ...Shadow.card,
    },
    contactTitle: {
      fontSize: Typography.size.lg, fontWeight: Typography.weight.extrabold,
      color: C.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.xs,
    },
    contactSub: {
      fontSize: Typography.size.body, color: C.textSecondary,
      textAlign: 'center', marginBottom: Spacing.lg,
    },
    emailBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: C.blue, borderRadius: Radius.xl,
      paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
      ...Shadow.card,
    },
    emailBtnText: {
      fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: C.white,
    },
    emailText: {
      fontSize: Typography.size.body, color: C.textTertiary,
      marginTop: Spacing.md,
    },
  });
}

// ── FaqRow ────────────────────────────────────────────────────────────────────

function FaqRow({ item, isLast, s, C, t }: {
  item: FaqItem;
  isLast: boolean;
  s: ReturnType<typeof makeStyles>;
  C: ColorPalette;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[s.faqItem, isLast && { borderBottomWidth: 0 }]}>
      <TouchableOpacity style={s.faqQuestion} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={s.faqQText}>{t(item.q)}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textTertiary} />
      </TouchableOpacity>
      {open && <Text style={s.faqAnswer}>{t(item.a)}</Text>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function HelpScreen() {
  const C = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(C), [C]);

  function handleEmailPress() {
    Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${t('help_email_subject')}`).catch(() => {
      Alert.alert(t('help_email_alert_title'), CONTACT_EMAIL);
    });
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.heroCard}>
          <Icon name="help-circle" size={48} color={C.blue} />
          <Text style={s.heroTitle}>{t('title_how_to_use')}</Text>
          <Text style={s.heroSub}>{t('help_hero_sub')}</Text>
        </View>

        {/* FAQ sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Icon name={section.icon} size={20} color={C.blue} />
              <Text style={s.sectionTitle}>{t(section.title)}</Text>
            </View>
            {section.items.map((item, i) => (
              <FaqRow
                key={i}
                item={item}
                isLast={i === section.items.length - 1}
                s={s}
                C={C}
                t={t}
              />
            ))}
          </View>
        ))}

        {/* Contact */}
        <View style={s.contactCard}>
          <Icon name="email-outline" size={40} color={C.blue} />
          <Text style={s.contactTitle}>{t('help_contact_title')}</Text>
          <Text style={s.contactSub}>{t('help_contact_sub')}</Text>
          <TouchableOpacity style={s.emailBtn} onPress={handleEmailPress} activeOpacity={0.85}>
            <Icon name="send" size={16} color={C.white} />
            <Text style={s.emailBtnText}>{t('help_contact_button')}</Text>
          </TouchableOpacity>
          <Text style={s.emailText}>{CONTACT_EMAIL}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
