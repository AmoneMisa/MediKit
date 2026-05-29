import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Linking, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Spacing, Typography, Radius, Shadow } from '../theme';
import type { ColorPalette } from '../theme';
import { useColors } from '../context/ThemeContext';

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
    title: 'Добавление препаратов',
    items: [
      {
        q: 'Как добавить препарат быстрее всего?',
        a: 'Нажмите «+» в аптечке → «Сканировать упаковку». Наведите камеру на штрих-код или QR-код — приложение само заполнит название, дозировку и форму.',
      },
      {
        q: 'Что делать, если штрих-код не распознан?',
        a: 'Выберите «Найти в базе» и введите название препарата — поиск работает по локальной базе и международным реестрам. Если препарата нет нигде, используйте «Ввести вручную».',
      },
      {
        q: 'Можно ли добавить несколько аптечек?',
        a: 'Да. На главном экране нажмите «Добавить аптечку». Удобно иметь отдельные аптечки: домашнюю, дорожную, детскую.',
      },
      {
        q: 'Как работают авто-теги?',
        a: 'При добавлении препарата приложение анализирует название и активное вещество и предлагает подходящие теги (например «боль», «антибиотик»). Вы можете принять их одним нажатием или отклонить.',
      },
    ],
  },
  {
    icon: 'bell-outline',
    title: 'Напоминания и уведомления',
    items: [
      {
        q: 'Как получать напоминания о приёме?',
        a: 'Откройте карточку препарата → нажмите «Напомни». Укажите время, дни недели и количество таблеток. Напоминание будет приходить по расписанию.',
      },
      {
        q: 'Когда приходят предупреждения об истечении срока?',
        a: 'Приложение предупреждает за 90, 30 и 7 дней до истечения. Просроченные препараты выделяются красным значком на всех экранах.',
      },
      {
        q: 'Что делать с уведомлением о несовместимости?',
        a: 'Если в одной аптечке есть препараты, которые нельзя принимать вместе, приложение покажет предупреждение. Нажмите на него, чтобы узнать подробности.',
      },
    ],
  },
  {
    icon: 'share-variant',
    title: 'Шаринг и совместный доступ',
    items: [
      {
        q: 'Как поделиться аптечкой?',
        a: 'Откройте аптечку → ⋯ → «Поделиться аптечкой». Скопируйте ссылку или отправьте QR-код через Telegram или WhatsApp.',
      },
      {
        q: 'Какие роли доступа существуют?',
        a: '«Просмотр» — видит препараты, но не может ничего менять. «Редактор» — может добавлять и редактировать. «Полный синк» — полный доступ, изменения отражаются в реальном времени.',
      },
      {
        q: 'Как добавить человека в контакты?',
        a: 'Перейдите в Профиль → Контакты → нажмите «+». Укажите имя и никнейм — потом этого человека можно быстро пригласить в аптечку.',
      },
    ],
  },
  {
    icon: 'book-open-outline',
    title: 'Журнал приёма',
    items: [
      {
        q: 'Зачем вести журнал приёма?',
        a: 'Журнал помогает отслеживать, когда и какие препараты вы принимали, какие симптомы были. Полезно при визите к врачу или если нужно вспомнить курс лечения.',
      },
      {
        q: 'Как добавить запись?',
        a: 'Перейдите во вкладку «Журнал» → нажмите «+». Выберите дату, время, препараты из вашей аптечки, укажите симптомы и заметки.',
      },
    ],
  },
  {
    icon: 'cart-outline',
    title: 'Список покупок',
    items: [
      {
        q: 'Как добавить препарат в список покупок?',
        a: 'Перейдите во вкладку «Купить» → «+». Можно добавить вручную, найти в базе или выбрать препарат из уже существующей аптечки.',
      },
      {
        q: 'Что происходит, когда я отмечаю препарат купленным?',
        a: 'Приложение предложит выбрать количество и аптечку — препарат сразу добавится туда. Позиция исчезнет из списка покупок.',
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

function FaqRow({ item, isLast, s, C }: {
  item: FaqItem;
  isLast: boolean;
  s: ReturnType<typeof makeStyles>;
  C: ColorPalette;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[s.faqItem, isLast && { borderBottomWidth: 0 }]}>
      <TouchableOpacity style={s.faqQuestion} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={s.faqQText}>{item.q}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textTertiary} />
      </TouchableOpacity>
      {open && <Text style={s.faqAnswer}>{item.a}</Text>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function HelpScreen() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  function handleEmailPress() {
    Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=MediKit — Вопрос`).catch(() => {
      Alert.alert('Почта', CONTACT_EMAIL);
    });
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.heroCard}>
          <Icon name="help-circle" size={48} color={C.blue} />
          <Text style={s.heroTitle}>Как пользоваться</Text>
          <Text style={s.heroSub}>Ответы на частые вопросы{'\n'}о работе приложения</Text>
        </View>

        {/* FAQ sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Icon name={section.icon} size={20} color={C.blue} />
              <Text style={s.sectionTitle}>{section.title}</Text>
            </View>
            {section.items.map((item, i) => (
              <FaqRow
                key={i}
                item={item}
                isLast={i === section.items.length - 1}
                s={s}
                C={C}
              />
            ))}
          </View>
        ))}

        {/* Contact */}
        <View style={s.contactCard}>
          <Icon name="email-outline" size={40} color={C.blue} />
          <Text style={s.contactTitle}>Нужна помощь?</Text>
          <Text style={s.contactSub}>
            Не нашли ответ на свой вопрос?{'\n'}Напишите нам — ответим в течение дня.
          </Text>
          <TouchableOpacity style={s.emailBtn} onPress={handleEmailPress} activeOpacity={0.85}>
            <Icon name="send" size={16} color={C.white} />
            <Text style={s.emailBtnText}>Написать</Text>
          </TouchableOpacity>
          <Text style={s.emailText}>{CONTACT_EMAIL}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
