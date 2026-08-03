import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  RootStackParamList, MainTabParamList, KitsStackParamList,
  ProfileStackParamList, NotificationsStackParamList,
  ShoppingStackParamList, JournalStackParamList,
} from '../types';
import { Typography, Spacing } from '../theme';
import type { ColorPalette } from '../theme';
import { useUnreadCount } from '../hooks';
import { ThemeProvider, useIsDark, useColors } from '../context/ThemeContext';
import { useT } from '../i18n';

// ── Screen imports ─────────────────────────────────────────────────────────────
import { KitListScreen }          from '../screens/KitListScreen';
import { AllMedicinesScreen }     from '../screens/AllMedicinesScreen';
import { ShareMedicineScreen }    from '../screens/ShareMedicineScreen';
import { KitDetailScreen }        from '../screens/KitDetailScreen';
import { MedicineDetailScreen }   from '../screens/MedicineDetailScreen';
import { NotificationsScreen }    from '../screens/NotificationsScreen';
import { CreateReminderScreen }   from '../screens/CreateReminderScreen';
import { ExpiryScreen }           from '../screens/ExpiryScreen';
import { AddMedicineScreen }      from '../screens/AddMedicineScreen';
import { ManualEntryScreen }      from '../screens/ManualEntryScreen';
import { ScanMedicineScreen }     from '../screens/ScanMedicineScreen';
import { SearchMedicineScreen }   from '../screens/SearchMedicineScreen';
import { InteractionScreen }      from '../screens/InteractionScreen';
import { SyncMembersScreen }      from '../screens/SyncMembersScreen';
import { ActivityHistoryScreen }  from '../screens/ActivityHistoryScreen';
import { CreateEditKitScreen }    from '../screens/CreateEditKitScreen';
import { PersonsScreen }          from '../screens/PersonsScreen';
import { DoctorsListScreen, DoctorFormScreen, DoctorCatalogScreen } from '../screens/DoctorsScreen';
import { AppointmentsScreen, AnalysesArchiveScreen } from '../screens/AppointmentsScreen';
import { ShoppingListScreen }     from '../screens/ShoppingListScreen';
import { MedicineJournalScreen }  from '../screens/MedicineJournalScreen';
import { AddIntakeLogScreen }     from '../screens/AddIntakeLogScreen';
import {
  ShareKitScreen, ProfileScreen, SettingsScreen,
} from '../screens/screens';
import { HelpScreen } from '../screens/HelpScreen';

const RootStack    = createNativeStackNavigator<RootStackParamList>();
const Tab          = createBottomTabNavigator<MainTabParamList>();
const KitsStack    = createNativeStackNavigator<KitsStackParamList>();
const NotifStack   = createNativeStackNavigator<NotificationsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const ShoppingStack = createNativeStackNavigator<ShoppingStackParamList>();
const JournalStack  = createNativeStackNavigator<JournalStackParamList>();

// ── Screen options factory ─────────────────────────────────────────────────────

function makeScreenOpts(C: ColorPalette) {
  return {
    headerStyle:      { backgroundColor: C.bgPage },
    headerTintColor:  C.textPrimary,
    headerTitleStyle: {
      fontSize: Typography.size.lg,
      fontWeight: '700' as const,
      color: C.textPrimary,
    },
    headerShadowVisible: false,
    headerBackTitle:  '',
    contentStyle:     { backgroundColor: C.bgPage },
  };
}

// ── Tab icon ──────────────────────────────────────────────────────────────────

function TabIcon({ name, focused, badge }: { name: string; focused: boolean; badge?: number }) {
  const C = useColors();
  return (
    <View style={t.wrap}>
      <Icon name={name} size={24} color={focused ? C.blue : C.textSecondary} />
      {!!badge && badge > 0 && (
        <View style={t.badge}>
          <Text style={t.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

const t = StyleSheet.create({
  wrap:      { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  badge:     {
    position: 'absolute', top: -4, right: -10,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF7575', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});

// ── Kits Stack ────────────────────────────────────────────────────────────────

function KitsStackNavigator() {
  const C = useColors();
  const t = useT();
  const so = makeScreenOpts(C);
  return (
    <KitsStack.Navigator screenOptions={so}>
      <KitsStack.Screen name="KitList"             component={KitListScreen}         options={{ title: t('my_kits') }} />
      <KitsStack.Screen name="AllMedicines"        component={AllMedicinesScreen}    options={{ title: t('all_medicines') }} />
      <KitsStack.Screen name="KitDetail"           component={KitDetailScreen}       options={{ title: '' }} />
      <KitsStack.Screen name="MedicineDetail"      component={MedicineDetailScreen}  options={{ title: '' }} />
      <KitsStack.Screen name="AddMedicine"         component={AddMedicineScreen}     options={{ title: t('add_medicine') }} />
      <KitsStack.Screen name="ManualEntry"         component={ManualEntryScreen}     options={{ title: t('enter_manually') }} />
      <KitsStack.Screen name="ScanMedicine"        component={ScanMedicineScreen}    options={{ title: t('title_scan') }} />
      <KitsStack.Screen name="SearchMedicine"      component={SearchMedicineScreen}  options={{ title: t('find_in_db') }} />
      <KitsStack.Screen name="ShareKit"            component={ShareKitScreen}        options={{ title: t('title_share') }} />
      <KitsStack.Screen name="MedicineInteraction" component={InteractionScreen}     options={{ title: t('title_interaction') }} />
      <KitsStack.Screen name="SyncMembers"         component={SyncMembersScreen}     options={{ title: t('members') }} />
      <KitsStack.Screen name="ActivityHistory"     component={ActivityHistoryScreen} options={{ title: t('title_history') }} />
      <KitsStack.Screen name="CreateEditKit"       component={CreateEditKitScreen}   options={{ title: t('title_kit') }} />
      <KitsStack.Screen name="ShareMedicine"       component={ShareMedicineScreen}   options={{ title: t('title_share') }} />
    </KitsStack.Navigator>
  );
}

// ── Shopping Stack ────────────────────────────────────────────────────────────

function ShoppingStackNavigator() {
  const C = useColors();
  const so = makeScreenOpts(C);
  return (
    <ShoppingStack.Navigator screenOptions={so}>
      <ShoppingStack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ headerShown: false }}
      />
    </ShoppingStack.Navigator>
  );
}

// ── Journal Stack ─────────────────────────────────────────────────────────────

function JournalStackNavigator() {
  const C = useColors();
  const t = useT();
  const so = makeScreenOpts(C);
  return (
    <JournalStack.Navigator screenOptions={so}>
      <JournalStack.Screen
        name="JournalHome"
        component={MedicineJournalScreen}
        options={{ headerShown: false }}
      />
      <JournalStack.Screen
        name="AddIntakeLog"
        component={AddIntakeLogScreen}
        options={{ title: t('title_intake_log') }}
      />
    </JournalStack.Navigator>
  );
}

// ── Notifications Stack ───────────────────────────────────────────────────────

function NotificationsStackNavigator() {
  const C = useColors();
  const t = useT();
  const so = makeScreenOpts(C);
  return (
    <NotifStack.Navigator screenOptions={so}>
      <NotifStack.Screen
        name="NotificationsHome"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
      <NotifStack.Screen
        name="CreateReminder"
        component={CreateReminderScreen}
        options={{ title: t('title_reminder') }}
      />
    </NotifStack.Navigator>
  );
}

// ── Profile Stack (includes Persons, Settings, Expiry) ───────────────────────

function ProfileStackNavigator() {
  const C = useColors();
  const t = useT();
  const so = makeScreenOpts(C);
  return (
    <ProfileStack.Navigator screenOptions={so}>
      <ProfileStack.Screen name="ProfileHome"    component={ProfileScreen}        options={{ title: t('profile') }} />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen}       options={{ title: t('settings') }} />
      <ProfileStack.Screen name="Support"        component={HelpScreen}           options={{ title: t('title_how_to_use') }} />
      <ProfileStack.Screen name="Persons"        component={PersonsScreen}        options={{ title: t('contacts') }} />
      <ProfileStack.Screen name="Doctors"          component={DoctorsListScreen}      options={{ headerShown: false }} />
      <ProfileStack.Screen name="DoctorForm"       component={DoctorFormScreen}       options={{ title: t('doc_form_title') }} />
      <ProfileStack.Screen name="DoctorCatalog"    component={DoctorCatalogScreen}    options={{ title: t('doc_catalog_title') }} />
      <ProfileStack.Screen name="Appointments"     component={AppointmentsScreen}     options={{ headerShown: false }} />
      <ProfileStack.Screen name="AnalysesArchive"  component={AnalysesArchiveScreen}  options={{ headerShown: false }} />
      <ProfileStack.Screen name="Expiry"           component={ExpiryScreen}           options={{ title: t('expiry_title') }} />
      <ProfileStack.Screen name="MedicineDetail"   component={MedicineDetailScreen}   options={{ title: '' }} />
    </ProfileStack.Navigator>
  );
}

// ── Bottom Tabs ───────────────────────────────────────────────────────────────

function MainTabs() {
  const unread = useUnreadCount();
  const C      = useColors();
  const t      = useT();
  const insets = useSafeAreaInsets();

  // Tab bar height = 52px content + bottom safe area
  const tabBarHeight = 52 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor:  C.border,
          borderTopWidth:  1,
          height:          tabBarHeight,
          paddingBottom:   insets.bottom + 4,
          paddingTop:      6,
        },
        tabBarActiveTintColor:   C.blue,
        tabBarInactiveTintColor: C.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="KitsTab"
        component={KitsStackNavigator}
        options={{
          tabBarLabel: t('kits'),
          tabBarIcon: ({ focused }) => <TabIcon name="medical-bag" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ShoppingTab"
        component={ShoppingStackNavigator}
        options={{
          tabBarLabel: t('shopping_title'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'cart' : 'cart-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="JournalTab"
        component={JournalStackNavigator}
        options={{
          tabBarLabel: t('journal'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'calendar-check' : 'calendar-check-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsStackNavigator}
        options={{
          tabBarLabel: t('notifications'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'bell' : 'bell-outline'} focused={focused} badge={unread} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: t('profile'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'account-circle' : 'account-circle-outline'} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function ThemedNavigationContainer({ children }: React.PropsWithChildren) {
  const isDark = useIsDark();
  const C      = useColors();

  const themeColors = {
    background:   C.bgPage      as string,
    card:         C.bgCard      as string,
    text:         C.textPrimary as string,
    border:       C.border      as string,
    primary:      C.blue        as string,
    notification: C.danger      as string,
  };
  const navTheme = isDark
    ? { ...DarkTheme,    colors: { ...DarkTheme.colors,    ...themeColors } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, ...themeColors } };

  // @ts-ignore — React 19 children prop
  return (
    <NavigationContainer theme={navTheme as any}>
      {children}
    </NavigationContainer>
  );
}

export function AppNavigator() {
  return (
    <ThemeProvider>
      <ThemedNavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Main" component={MainTabs} />
        </RootStack.Navigator>
      </ThemedNavigationContainer>
    </ThemeProvider>
  );
}
