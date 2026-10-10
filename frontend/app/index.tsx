
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

export default function Index() {
  const { user, isLoading, userToken, userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!userToken || !user) {
      router.replace('/auth/login');
      return;
    }

    if (userRole === 'customer') {
      router.replace('/customer/dashboard');
    } else if (userRole === 'saint') {
      router.replace('/saint/dashboard');
    } else if (userRole === 'admin') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/auth/login');
    }
  }, [user, userToken, userRole, isLoading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B35" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
