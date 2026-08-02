import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { startSync } from './src/api';
import {
  setupChannels,
  requestNotificationPermission,
  rescheduleAll,
} from './src/utils/notificationScheduler';
import { bootstrapSecurity } from './src/utils/securityInit';
import { useAppStore } from './src/store';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Derive the MMKV encryption key from the OS keychain and migrate
    //    plaintext stores (one-time, on first launch after this version).
    // 2. Only THEN rehydrate Zustand from the now-encrypted MMKV — the store
    //    was created with skipHydration:true to prevent it from opening MMKV
    //    before the key is available.
    bootstrapSecurity()
      .then(() => useAppStore.persist.rehydrate())
      .then(() => setReady(true))
      .catch(() => {
        // If keychain is unavailable (e.g. first boot before device PIN),
        // rehydrate anyway so the app doesn't stay stuck on the splash.
        useAppStore.persist.rehydrate().finally(() => setReady(true));
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Kick off backend sync; stays local-first if server is unreachable.
    startSync().catch(() => {});
    // Set up notification channels, request permission, and rebuild all schedules.
    setupChannels()
      .then(() => requestNotificationPermission())
      .then(() => rescheduleAll())
      .catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* translucent lets the tab bar respect the bottom inset itself */}
        <StatusBar translucent backgroundColor="transparent" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
