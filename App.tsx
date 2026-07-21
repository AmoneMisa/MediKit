import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { startSync } from './src/api';

export default function App() {
  // Kick off backend sync once on launch; stays local-first if the server is unreachable.
  useEffect(() => { startSync().catch(() => {}); }, []);

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
