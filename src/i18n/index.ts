import { useCallback } from 'react';
import { useAppStore } from '../store';
import { translations, type Lang, type TranslationKey } from './translations';

/** Returns a t(key) function bound to the current app language. */
export function useT() {
  const lang = useAppStore(s => s.settings.language) as Lang;
  const map = (translations[lang] ?? translations.en) as Record<string, string>;
  const fallback = translations.en as Record<string, string>;
  return useCallback(
    (key: TranslationKey): string => map[key] ?? fallback[key] ?? key,
    [map],
  );
}

export type { Lang, TranslationKey };
