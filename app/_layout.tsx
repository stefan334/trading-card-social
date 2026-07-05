import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { BatchProvider } from '../src/context/BatchContext';
import { useProtectedRoute } from '../src/hooks/useProtectedRoute';

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
});

function RootNavigator() {
  useProtectedRoute();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
      <Stack.Screen name="search" options={{ headerShown: true, title: 'Search' }} />
      <Stack.Screen name="marketplace" options={{ headerShown: true, title: 'Marketplace' }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit Profile', presentation: 'modal' }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'Profile' }} />
      <Stack.Screen name="card/[id]" options={{ headerShown: true, title: 'Card' }} />
      <Stack.Screen name="set/[id]" options={{ headerShown: true, title: 'Set' }} />
      <Stack.Screen name="binder/[id]" options={{ headerShown: true, title: 'Binder' }} />
      <Stack.Screen name="binder/edit/[id]" options={{ headerShown: true, title: 'Edit Binder' }} />
      <Stack.Screen name="trade/[id]" options={{ headerShown: true, title: 'Trade' }} />
      <Stack.Screen name="trade/new" options={{ headerShown: true, title: 'New Trade' }} />
      <Stack.Screen name="scan" options={{ headerShown: true, title: 'Scan Card', presentation: 'modal' }} />
      <Stack.Screen name="batch-add" options={{ headerShown: true, title: 'Add Cards' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BatchProvider>
            <RootNavigator />
            <StatusBar style="auto" />
          </BatchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
