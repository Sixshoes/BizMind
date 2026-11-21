export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'bizmind_theme_v1';

export function getSavedTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // ignore storage error
  }
  return 'light';
}

export function resolveEffectiveDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function applyTheme(pref: ThemePreference): void {
  const isDark = resolveEffectiveDark(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.theme = pref;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore
  }
}
