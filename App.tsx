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
    // Guarantee the app never stays stuck on the splash screen.
    const fallback = setTimeout(() => setReady(true), 8000);

    const finish = () => { clearTimeout(fallback); setReady(true); };

    bootstrapSecurity()
      .then(async () => { await useAppStore.persist.rehydrate(); })
      .then(finish)
      .catch(async () => {
        // Keychain unavailable (first boot before device PIN, or release vs
        // debug key mismatch) — rehydrate unencrypted and continue.
        try { await useAppStore.persist.rehydrate(); } catch {}
        finish();
      });

    return () => clearTimeout(fallback);
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
