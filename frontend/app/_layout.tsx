import { Stack } from 'expo-router';
import { AuthProvider } from '@/src/context/AuthContext';
import { useEffect } from 'react';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        await Asset.loadAsync([
          require('../assets/images/icon.png'),
          require('../assets/images/adaptive-icon.png'),
        ]);
      } catch (e) {
        console.warn('Asset preload error:', e);
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
