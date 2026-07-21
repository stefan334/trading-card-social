import {
  DarkTheme as NavDark,
  DefaultTheme as NavLight,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { showToast, toastMessage, ToastHost } from '../src/components/Toast';
import { AuthProvider } from '../src/context/AuthContext';
import { BatchProvider } from '../src/context/BatchContext';
import { useProtectedRoute } from '../src/hooks/useProtectedRoute';
import { AppThemeProvider, useTheme } from '../src/theme';

// Cache aggressively: the Pokémon TCG API is slow, so keep fetched data "fresh"
// for a while and serve it instantly from cache on revisit (pull-to-refresh and
// mutations still update it). Big perceived-speed win across the app.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — don't refetch on every screen focus
      gcTime: 1000 * 60 * 60, // keep unused data an hour
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  // Any failed mutation (add card, send message, propose trade, …) surfaces as a
  // toast, so errors are never silently swallowed. Screens with their own inline
  // error UI still work; the toast is the global safety net.
  mutationCache: new MutationCache({
    onError: (error) => showToast(toastMessage(error)),
  }),
});

function RootNavigator() {
  useProtectedRoute();
  const theme = useTheme();

  // Screens not yet converted to theme tokens stay light even in dark mode, so
  // nothing renders unreadable (dark-mode coverage grows screen by screen).
  const pinLight = theme.dark
    ? {
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#111827',
        contentStyle: { backgroundColor: '#FFFFFF' },
      }
    : {};

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" options={{ ...pinLight }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
      <Stack.Screen name="search" options={{ headerShown: true, title: 'Search', ...pinLight }} />
      <Stack.Screen name="marketplace" options={{ headerShown: true, title: 'Marketplace' }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit Profile', presentation: 'modal' }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'Profile' }} />
      <Stack.Screen name="card/[id]" options={{ headerShown: true, title: 'Card' }} />
      <Stack.Screen name="set/[id]" options={{ headerShown: true, title: 'Set' }} />
      <Stack.Screen name="binder/[id]" options={{ headerShown: true, title: 'Binder' }} />
      <Stack.Screen name="binder/edit/[id]" options={{ headerShown: true, title: 'Edit Binder', ...pinLight }} />
      <Stack.Screen name="trade/[id]" options={{ headerShown: true, title: 'Trade' }} />
      <Stack.Screen name="trade/new" options={{ headerShown: true, title: 'New Trade' }} />
      <Stack.Screen name="scan" options={{ headerShown: true, title: 'Scan Card', presentation: 'modal', ...pinLight }} />
      <Stack.Screen name="feedback" options={{ headerShown: true, title: 'Feedback' }} />
      <Stack.Screen name="contact" options={{ headerShown: true, title: 'Contact us' }} />
      <Stack.Screen name="terms" options={{ headerShown: true, title: 'Terms & Conditions' }} />
      <Stack.Screen name="report" options={{ headerShown: true, title: 'Report', presentation: 'modal', ...pinLight }} />
      <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin', ...pinLight }} />
      <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
      <Stack.Screen name="connections" options={{ headerShown: true, title: 'People' }} />
    </Stack>
  );
}

function ThemedApp() {
  const theme = useTheme();
  const navTheme = theme.dark
    ? {
        ...NavDark,
        colors: {
          ...NavDark.colors,
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          border: theme.colors.borderLight,
        },
      }
    : {
        ...NavLight,
        colors: {
          ...NavLight.colors,
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          border: '#E5E7EB',
        },
      };

  return (
    <NavThemeProvider value={navTheme}>
      <RootNavigator />
      <ToastHost />
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BatchProvider>
            <AppThemeProvider>
              <ThemedApp />
            </AppThemeProvider>
          </BatchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
