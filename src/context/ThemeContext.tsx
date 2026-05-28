import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store';
import { Colors, DarkColors, type ColorPalette } from '../theme';

interface ThemeCtx {
  colors: ColorPalette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeCtx>({ colors: Colors, isDark: false });

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const themeSetting = useAppStore(s => s.settings.theme);
  const systemScheme = useColorScheme();

  const isDark =
    themeSetting === 'dark' ||
    (themeSetting === 'system' && systemScheme === 'dark');

  return (
    <ThemeContext.Provider value={{ colors: isDark ? DarkColors : Colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Returns the resolved color palette for the active theme. */
export function useColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}

/** Returns true when dark mode is active. */
export function useIsDark(): boolean {
  return useContext(ThemeContext).isDark;
}
