export type InterfaceMode = 'classic' | 'focus';
export type Appearance = 'light' | 'dark' | 'system';

export interface UiPreferences {
  interfaceMode: InterfaceMode;
  appearance: Appearance;
}

export const UI_MODE_STORAGE_KEY = 'personal-tasks.interfaceMode';
export const APPEARANCE_STORAGE_KEY = 'personal-tasks.appearance';
export const LEGACY_THEME_STORAGE_KEY = 'theme';

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  interfaceMode: 'classic',
  appearance: 'system',
};

export function isInterfaceMode(value: unknown): value is InterfaceMode {
  return value === 'classic' || value === 'focus';
}

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveAppearance(
  appearance: Appearance,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (appearance === 'system') return prefersDark ? 'dark' : 'light';
  return appearance;
}

