import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// React Native Web's Alert.alert is a no-op; show browser dialogs so web users see messages.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (buttons && buttons.length > 1) {
      const cancel = buttons.find((b) => b.style === 'cancel');
      const actions = buttons.filter((b) => b !== cancel);
      const chosen = window.confirm(text) ? actions[actions.length - 1] : cancel;
      chosen?.onPress?.();
      return;
    }
    window.alert(text);
    buttons?.[0]?.onPress?.();
  };
}

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
          <Stack.Screen name="seller/dashboard" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
