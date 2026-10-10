
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type LoginRole = 'customer' | 'saint' | 'admin';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>('customer');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      Alert.alert('Error', 'Please enter your phone number.');
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (role !== 'customer' && !password.trim()) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const payload: {
        phone: string;
        role: LoginRole;
        password?: string;
      } = {
        phone: cleanPhone,
        role,
      };

      if (role !== 'customer') {
        payload.password = password;
      }

      const response = await apiClient.post('/auth/login', payload);

      if (!response?.token || !response?.user) {
        throw new Error('Invalid response from server. Please try again.');
      }

      if (response.user.role !== role) {
        throw new Error('The account type does not match your selection.');
      }

      await login(response.token, response.user);

      if (role === 'customer') {
        router.replace('/customer/dashboard');
      } else if (role === 'saint') {
        router.replace('/saint/dashboard');
      } else {
        router.replace('/admin/dashboard');
      }
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error?.message || 'Unable to sign in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Ionicons name="flower" size={80} color="#FF6B35" />
            <Text style={styles.title}>Book Your Pujari</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <Text style={styles.roleLabel}>Select account type</Text>

          <View style={styles.roleContainer}>
            {([
              { label: 'Customer', value: 'customer' },
              { label: 'Saint', value: 'saint' },
              { label: 'Admin', value: 'admin' },
            ] as const).map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.roleButton,
                  role === item.value && styles.roleButtonActive,
                ]}
                onPress={() => {
                  setRole(item.value);
                  setPassword('');
                }}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === item.value && styles.roleButtonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="call-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="10-digit Phone Number"
                value={phone}
                onChangeText={(value) =>
                  setPhone(value.replace(/\D/g, '').slice(0, 10))
                }
                keyboardType="number-pad"
                maxLength={10}
                placeholderTextColor="#999"
                editable={!loading}
                testID="login-phone-input"
              />
            </View>

            {role !== 'customer' && (
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#666"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                  editable={!loading}
                  testID="login-password-input"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              testID="login-submit-button"
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {role !== 'admin' && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Don't have an account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/auth/register')}
                  disabled={loading}
                  testID="go-to-register-button"
                >
                  <Text style={styles.linkText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  roleButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  roleButtonText: {
    color: '#555',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#FFF',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  linkText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
});
