import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

/**
 * App-wide theming. `mode` is the user's preference (system / light / dark,
 * persisted); `theme` is the resolved palette. Screens read colors via
 * useTheme() and apply them inline over their static layout styles.
 */

export interface ThemeColors {
  background: string; // screen background
  card: string; // elevated surfaces: post cards, sheets, list groups
  surface: string; // subtle fills: search bars, chips, "theirs" chat bubbles
  text: string;
  textMuted: string;
  textFaint: string;
  border: string; // input/chip borders
  borderLight: string; // hairline separators
  primary: string;
  success: string;
  danger: string;
  warning: string;
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
}

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    surface: '#F3F4F6',
    text: '#111827',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    border: '#D1D5DB',
    borderLight: '#F3F4F6',
    primary: '#2563EB',
    success: '#059669',
    danger: '#DC2626',
    warning: '#F59E0B',
  },
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#0F172A',
    card: '#1E293B',
    surface: '#293548',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    border: '#3E4C63',
    borderLight: '#1E293B',
    primary: '#3B82F6',
    success: '#10B981',
    danger: '#F87171',
    warning: '#FBBF24',
  },
};

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'cardlink.themeMode';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'system',
  setMode: () => {},
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedDark = mode === 'dark' || (mode === 'system' && system === 'dark');
    return { theme: resolvedDark ? darkTheme : lightTheme, mode, setMode };
  }, [mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
