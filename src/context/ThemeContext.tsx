import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store';
import {
  Colors, DarkColors,
  PastelColors, GreenColors, RedColors, MintColors,
  DarkPastelColors, DarkGreenColors, DarkRedColors, DarkMintColors,
  type ColorPalette,
} from '../theme';

interface ThemeCtx {
  colors:      ColorPalette;
  isDark:      boolean;
  useGradient: boolean;
  gradientColors: [string, string];
}

const ThemeContext = createContext<ThemeCtx>({
  colors:         Colors,
  isDark:         false,
  useGradient:    false,
  gradientColors: ['#78A9FF', '#56CE53'],
});

function buildGradient(c: ColorPalette): [string, string] {
  return [c.blue, c.success];
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const settings     = useAppStore(s => s.settings);
  const systemScheme = useColorScheme();

  const { theme, accentColor, useGradient = false } = settings;

  const systemDark = theme === 'system' && systemScheme === 'dark';
  const isDark =
    theme === 'dark' || systemDark ||
    theme === 'dark-pastel' || theme === 'dark-green' ||
    theme === 'dark-red'    || theme === 'dark-mint';

  function resolveBase(): ColorPalette {
    switch (theme) {
      case 'dark':        return DarkColors;
      case 'pastel':      return PastelColors;
      case 'green':       return GreenColors;
      case 'red':         return RedColors;
      case 'mint':        return MintColors;
      case 'dark-pastel': return DarkPastelColors;
      case 'dark-green':  return DarkGreenColors;
      case 'dark-red':    return DarkRedColors;
      case 'dark-mint':   return DarkMintColors;
      case 'system':      return systemDark ? DarkColors : Colors;
      default:            return Colors;  // 'light' | 'custom'
    }
  }

  const base = resolveBase();

  const { customBg, customCard, customText } = settings;

  // For custom theme, override accent + optionally bg, card, text colors
  const colors: ColorPalette =
    theme === 'custom'
      ? {
          ...base,
          ...(accentColor ? {
            blue:      accentColor,
            blueLight: accentColor + '28',
            blueDark:  accentColor,
          } : {}),
          ...(customBg   ? { bgPage: customBg } : {}),
          ...(customCard ? { bgCard: customCard, bgCardAlt: customCard + 'CC' } : {}),
          ...(customText ? { textPrimary: customText, textSecondary: customText + 'AA', textTertiary: customText + '66' } : {}),
        }
      : base;

  return (
    <ThemeContext.Provider value={{
      colors,
      isDark,
      useGradient,
      gradientColors: buildGradient(colors),
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}

export function useIsDark(): boolean {
  return useContext(ThemeContext).isDark;
}

export function useGradient(): { enabled: boolean; colors: [string, string] } {
  const ctx = useContext(ThemeContext);
  return { enabled: ctx.useGradient, colors: ctx.gradientColors };
}
