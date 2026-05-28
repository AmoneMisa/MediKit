import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Colors } from './src/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPage} translucent={false} />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
