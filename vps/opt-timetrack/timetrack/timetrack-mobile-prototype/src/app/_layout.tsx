import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui/ToastHost';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="check/[type]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="check/success" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="offline" />
        <Stack.Screen name="kiosk/index" />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}
