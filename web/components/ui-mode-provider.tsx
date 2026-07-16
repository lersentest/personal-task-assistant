'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  APPEARANCE_STORAGE_KEY,
  Appearance,
  DEFAULT_UI_PREFERENCES,
  InterfaceMode,
  isAppearance,
  isInterfaceMode,
  LEGACY_THEME_STORAGE_KEY,
  resolveAppearance,
  UI_MODE_STORAGE_KEY,
  UiPreferences,
} from '@/lib/ui-preferences';

interface UiModeContextValue extends UiPreferences {
  resolvedAppearance: 'light' | 'dark';
  setInterfaceMode: (mode: InterfaceMode) => void;
  setAppearance: (appearance: Appearance) => void;
}

const UiModeContext = createContext<UiModeContextValue | null>(null);

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [prefersDark, setPrefersDark] = useState(false);
  const [preferences, setPreferences] = useState<UiPreferences>(
    DEFAULT_UI_PREFERENCES,
  );

  const applyPreferences = useCallback(
    (next: UiPreferences, nextPrefersDark = prefersDark) => {
      const resolved = resolveAppearance(next.appearance, nextPrefersDark);
      document.documentElement.dataset.uiMode = next.interfaceMode;
      document.documentElement.dataset.appearance = next.appearance;
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    },
    [prefersDark],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const storedAppearance = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    const legacyTheme = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    const next: UiPreferences = {
      interfaceMode: DEFAULT_UI_PREFERENCES.interfaceMode,
      appearance: isAppearance(storedAppearance)
        ? storedAppearance
        : isAppearance(legacyTheme)
          ? legacyTheme
          : DEFAULT_UI_PREFERENCES.appearance,
    };

    setPrefersDark(media.matches);
    setPreferences(next);
    applyPreferences(next, media.matches);
    setMounted(true);

    const onChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
      setPreferences((current) => {
        applyPreferences(current, event.matches);
        return current;
      });
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [applyPreferences]);

  const setInterfaceMode = useCallback(
    (interfaceMode: InterfaceMode) => {
      setPreferences((current) => {
        const next = { ...current, interfaceMode };
        localStorage.setItem(UI_MODE_STORAGE_KEY, interfaceMode);
        applyPreferences(next);
        return next;
      });
    },
    [applyPreferences],
  );

  const setAppearance = useCallback(
    (appearance: Appearance) => {
      setPreferences((current) => {
        const next = { ...current, appearance };
        localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
        localStorage.setItem(LEGACY_THEME_STORAGE_KEY, appearance);
        applyPreferences(next);
        return next;
      });
    },
    [applyPreferences],
  );

  const value = useMemo<UiModeContextValue>(
    () => ({
      ...preferences,
      resolvedAppearance: resolveAppearance(preferences.appearance, prefersDark),
      setInterfaceMode,
      setAppearance,
    }),
    [preferences, prefersDark, setInterfaceMode, setAppearance],
  );

  if (!mounted) return null;

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode() {
  const value = useContext(UiModeContext);
  if (!value) throw new Error('useUiMode must be used within UiModeProvider');
  return value;
}
