import { Stack } from 'expo-router';
import { StoreProvider } from '@/src/store/StoreContext';

export default function StoreLayout() {
  return (
    <StoreProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </StoreProvider>
  );
}
