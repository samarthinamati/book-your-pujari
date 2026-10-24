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

type RegisterRole = 'customer' | 'saint' | 'seller';

const REQUEST_TIMEOUT_MS = 20000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'The server took too long to respond. Please try again.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('customer');

  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanPhone) {
      Alert.alert('Error', 'Please enter your name and phone number.');
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (
      (role === 'saint' || role === 'seller') &&
      cleanPassword.length < 4
    ) {
      Alert.alert(
        'Error',
        `${role === 'seller' ? 'Seller' : 'Saint'} password must be at least 4 characters.`
      );
      return;
    }

    if (role === 'seller') {
      if (
        !shopName.trim() ||
        !email.trim() ||
        !shopAddress.trim() ||
        !city.trim() ||
        !pincode.trim()
      ) {
        Alert.alert(
          'Missing Details',
          'Please fill in all shop details.'
        );
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        Alert.alert(
          'Invalid Email',
          'Please enter a valid email address.'
        );
        return;
      }

      if (!/^\d{6}$/.test(pincode.trim())) {
        Alert.alert(
          'Invalid PIN Code',
          'Please enter a valid 6-digit PIN code.'
        );
        return;
      }
    }

    setLoading(true);

    try {
      // SELLER REGISTRATION
      // The backend route accepts applications without prior login.
      if (role === 'seller') {
        const backendUrl =
          process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, '');

        if (!backendUrl) {
          throw new Error(
            'Server configuration is missing. Please check the frontend environment variables.'
          );
        }

        const sellerResponse = await fetchWithTimeout(
          `${backendUrl}/api/store/seller/apply`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shop_name: shopName.trim(),
              owner_name: cleanName,
              phone: cleanPhone,
              password: cleanPassword,
              email: email.trim(),
              shop_address: shopAddress.trim(),
              city: city.trim(),
              pincode: pincode.trim(),
            }),
          }
        );

        const sellerData = await sellerResponse
          .json()
          .catch(() => ({}));

        if (!sellerResponse.ok) {
          throw new Error(
            sellerData?.detail ||
              `Seller application failed (${sellerResponse.status}).`
          );
        }

        Alert.alert(
          'Registration Successful!',
          sellerData?.message ||
            'Your seller application has been submitted for admin approval.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/auth/login'),
            },
          ],
          { cancelable: false }
        );

        return;
      }

      // CUSTOMER AND SAINT REGISTRATION
      const payload: {
        name: string;
        phone: string;
        role: 'customer' | 'saint';
        password?: string;
      } = {
        name: cleanName,
        phone: cleanPhone,
        role,
      };

      if (role === 'saint') {
        payload.password = cleanPassword;
      }

      const response = await apiClient.post(
        '/auth/register',
        payload
      );

      if (!response?.token || !response?.user) {
        throw new Error(
          'Invalid response from server. Please try again.'
        );
      }

      await login(response.token, response.user);

      if (response.user.role === 'customer') {
        router.replace('/customer/dashboard');
      } else if (response.user.role === 'saint') {
        router.replace('/saint/dashboard');
      }
    
} catch (error: any) {
  const message =
    error?.response?.data?.detail ||
    error?.message ||
    'Unable to create your account. Please try again.';

  console.error('Registration error:', error);

  if (Platform.OS === 'web') {
    window.alert('Registration Failed\n\n' + message);
  } else {
    Alert.alert('Registration Failed', message);
  }
} finally {
  setLoading(false);
}


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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#333"
            />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join our community
            </Text>
          </View>

          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'customer' && styles.roleButtonActive,
              ]}
              onPress={() => {
                setRole('customer');
                setPassword('');
              }}
              disabled={loading}
              testID="role-customer-button"
            >
              <Ionicons
                name="person"
                size={24}
                color={role === 'customer' ? '#FFF' : '#666'}
              />
              <Text
                style={[
                  styles.roleText,
                  role === 'customer' && styles.roleTextActive,
                ]}
              >
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'saint' && styles.roleButtonActive,
              ]}
              onPress={() => {
                setRole('saint');
                setPassword('');
              }}
              disabled={loading}
              testID="role-saint-button"
            >
              <Ionicons
                name="flower"
                size={24}
                color={role === 'saint' ? '#FFF' : '#666'}
              />
              <Text
                style={[
                  styles.roleText,
                  role === 'saint' && styles.roleTextActive,
                ]}
              >
                Saint/Pujari
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'seller' && styles.roleButtonActive,
              ]}
              onPress={() => {
                setRole('seller');
                setPassword('');
              }}
              disabled={loading}
              testID="role-seller-button"
            >
              <Ionicons
                name="storefront"
                size={24}
                color={role === 'seller' ? '#FFF' : '#666'}
              />
              <Text
                style={[
                  styles.roleText,
                  role === 'seller' && styles.roleTextActive,
                ]}
              >
                Seller
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                placeholderTextColor="#999"
                editable={!loading}
                autoCapitalize="words"
                testID="register-name-input"
              />
            </View>

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
                testID="register-phone-input"
              />
            </View>

            {(role === 'saint' || role === 'seller') && (
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#666"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password (minimum 4 characters)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                  editable={!loading}
                  testID="register-password-input"
                />
              </View>
            )}

            {role === 'seller' && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="storefront-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Shop Name"
                    value={shopName}
                    onChangeText={setShopName}
                    placeholderTextColor="#999"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#999"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Shop Address"
                    value={shopAddress}
                    onChangeText={setShopAddress}
                    placeholderTextColor="#999"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="business-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    value={city}
                    onChangeText={setCity}
                    placeholderTextColor="#999"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="map-outline"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="6-digit PIN Code"
                    value={pincode}
                    onChangeText={(value) =>
                      setPincode(value.replace(/\D/g, '').slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor="#999"
                    editable={!loading}
                  />
                </View>

                <Text style={styles.approvalNote}>
                  Your seller application will be reviewed by the admin.
                  You can sign in as a seller after approval.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
              testID="register-submit-button"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {role === 'seller'
                    ? 'Apply as Seller'
                    : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/auth/login')}
                disabled={loading}
                testID="go-to-login-button"
              >
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  roleButtonActive: {
    backgroundColor: '#FF6B35',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  roleTextActive: {
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
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  approvalNote: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
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
    alignItems: 'center',
    flexWrap: 'wrap',
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



      
