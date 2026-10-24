

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

type LoginRole = 'customer' | 'saint' | 'admin' | 'seller';

const roles: { label: string; value: LoginRole }[] = [
  { label: 'Customer', value: 'customer' },
  { label: 'Saint', value: 'saint' },
  { label: 'Admin', value: 'admin' },
  { label: 'Seller', value: 'seller' },
];

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>('customer');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanPhone) {
      Alert.alert('Error', 'Please enter your phone number.');
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (role !== 'customer' && !cleanPassword) {
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
        payload.password = cleanPassword;
      }

      const response = await apiClient.post('/auth/login', payload);

      if (!response?.token || !response?.user) {
        throw new Error(
          'Invalid response from server. Please try again.'
        );
      }

      if (response.user.role !== role) {
        throw new Error(
          'The account type does not match your selection.'
        );
      }

      await login(response.token, response.user);

      if (role === 'customer') {
        router.replace('/customer/dashboard');
      } else if (role === 'saint') {
        router.replace('/saint/dashboard');
      } else if (role === 'seller') {
        router.replace('/seller/dashboard');
      } else {
        router.replace('/admin/dashboard');
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Unable to sign in. Please try again.';

      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="flower-outline" size={42} color="#2874F0" />
            </View>

            <Text style={styles.appName}>PujariGo</Text>
            <Text style={styles.tagline}>
              Your Trusted Partner for Every Puja
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>
              Sign in to continue to your account.
            </Text>

            <Text style={styles.label}>Select Account Type</Text>

            <View style={styles.roleContainer}>
              {roles.map((item) => {
                const selected = role === item.value;

                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.roleButton,
                      selected && styles.roleButtonSelected,
                    ]}
                    onPress={() => {
                      setRole(item.value);
                      setPassword('');
                    }}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        selected && styles.roleTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="call-outline"
                size={20}
                color="#64748B"
              />
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit phone number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(value) =>
                  setPhone(value.replace(/\D/g, ''))
                }
                editable={!loading}
              />
            </View>

            {role !== 'customer' && (
              <>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#64748B"
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                  />

                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    <Ionicons
                      name={
                        showPassword ? 'eye-off-outline' : 'eye-outline'
                      }
                      size={21}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#FFFFFF"
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>
                Don't have an account?
              </Text>

              <TouchableOpacity
                onPress={() => router.push('/auth/register')}
                disabled={loading}
              >
                <Text style={styles.signupLink}> Sign Up</Text>
              </TouchableOpacity>
            </View>

            {role === 'seller' && (
              <Text style={styles.sellerNote}>
                New sellers must submit an application and wait for admin
                approval before signing in as a seller.
              </Text>
            )}
          </View>

          <Text style={styles.footer}>
            PujariGo • Your Trusted Partner for Every Puja
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2874F0',
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 5,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 9,
    marginTop: 13,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    flexGrow: 1,
    minWidth: '22%',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleButtonSelected: {
    backgroundColor: '#2874F0',
    borderColor: '#2874F0',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  roleTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 11,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  loginButton: {
    minHeight: 54,
    marginTop: 26,
    borderRadius: 12,
    backgroundColor: '#2874F0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    elevation: 2,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  signupText: {
    fontSize: 14,
    color: '#64748B',
  },
  signupLink: {
    fontSize: 14,
    color: '#2874F0',
    fontWeight: '800',
  },
  sellerNote: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  footer: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 24,
  },
});
