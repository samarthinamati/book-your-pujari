import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        // No local assets to preload
      } catch (e) {
        console.warn('Splash screen error:', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="customer/dashboard" />
          <Stack.Screen name="customer/payment" />
          <Stack.Screen name="saint/dashboard" />
          <Stack.Screen name="admin/dashboard" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
