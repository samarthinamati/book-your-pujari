
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { apiClient } from '@/src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'saint' | 'seller'>('customer');
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
  password.trim().length < 4
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
        Alert.alert('Missing Details', 'Please fill in all shop details.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }

      if (!/^\d{6}$/.test(pincode.trim())) {
        Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit PIN code.');
        return;
      }
    }    
    setLoading(true);

    try {
      const payload: {
  name: string;
  phone: string;
  role: 'customer' | 'saint';
  password?: string;
} = {
  name: cleanName,
  phone: cleanPhone,
  role: role === 'seller' ? 'customer' : role,
};

      if (role === 'saint') {
        payload.password = password;
      }

      const response = await apiClient.post('/auth/register', payload);

      if (!response?.token || !response?.user) {
        throw new Error('Invalid response from server. Please try again.');
      }

      await login(response.token, response.user);
            if (role === 'seller') {
        await apiClient.post('/store/seller/apply', {
          shop_name: shopName.trim(),
          owner_name: cleanName,
          phone: cleanPhone,
          password: password.trim(),
          email: email.trim(),
          shop_address: shopAddress.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
        });

        Alert.alert(
          'Application Submitted',
          'Your seller application has been sent to the admin for approval. Please sign in after your application is approved.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/auth/login'),
            },
          ]
        );
        return;
      }

      if (response.user.role === 'customer') {
        router.replace('/customer/dashboard');
      } else if (response.user.role === 'saint') {
        router.replace('/saint/dashboard');
      }
    } catch (error: any) {
      Alert.alert(
        'Registration Failed',
        error?.message || 'Unable to create your account. Please try again.'
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community</Text>
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
              onPress={() => setRole('saint')}
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
              onPress={() => setRole('seller')}
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
                  <Ionicons name="storefront-outline" size={20} color="#666" style={styles.inputIcon} />
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
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color="#666" style={styles.inputIcon} />
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
                  <Ionicons name="business-outline" size={20} color="#666" style={styles.inputIcon} />
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
                  <Ionicons name="map-outline" size={20} color="#666" style={styles.inputIcon} />
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
              </>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              testID="register-submit-button"
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
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
  container: { flex: 1, backgroundColor: '#FFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  roleSelector: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, padding: 16, gap: 8,
  },
  roleButtonActive: { backgroundColor: '#FF6B35' },
  roleText: { fontSize: 14, fontWeight: '600', color: '#666' },
  roleTextActive: { color: '#FFF' },
  form: { width: '100%' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  button: {
    backgroundColor: '#FF6B35', borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: '#666' },
  linkText: { fontSize: 14, color: '#FF6B35', fontWeight: '600' },
});
