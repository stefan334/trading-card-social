import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { useProtectedRoute } from '../src/hooks/useProtectedRoute';

const queryClient = new QueryClient();

function RootNavigator() {
  useProtectedRoute();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
      <Stack.Screen name="search" options={{ headerShown: true, title: 'Search' }} />
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
