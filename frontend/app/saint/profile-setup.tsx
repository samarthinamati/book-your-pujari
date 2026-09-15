// frontend/app/saint/profile-setup.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

interface Pooja {
  name: string;
  description: string;
  price: string;
  duration: string;
}

export default function SaintProfileSetup() {
  const { edit } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const isEdit = edit === 'true';

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('');
  const [operatingAreas, setOperatingAreas] = useState('');
  const [poojas, setPoojas] = useState<Pooja[]>([{ name: '', description: '', price: '', duration: '' }]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => { if (isEdit) fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const data = await apiClient.get('/saints/profile/me');
      setName(data.name);
      setBio(data.bio || '');
      setExperience(String(data.experience_years));
      setLocation(data.location);
      setOperatingAreas(data.operating_areas.join(', '));
      setPoojas(
        data.poojas.map((p: any) => ({
          name: p.name,
          description: p.description || '',
          price: String(p.price),
          duration: p.duration || '',
        }))
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setFetching(false);
    }
  };

  const addPooja = () => {
    setPoojas([...poojas, { name: '', description: '', price: '', duration: '' }]);
  };

  const removePooja = (index: number) => {
    if (poojas.length === 1) {
      Alert.alert('Error', 'You must have at least one pooja service');
      return;
    }
    setPoojas(poojas.filter((_, i) => i !== index));
  };

  const updatePooja = (index: number, field: keyof Pooja, value: string) => {
    const updated = [...poojas];
    updated[index][field] = value;
    setPoojas(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !location.trim() || !experience.trim() || !operatingAreas.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const validPoojas = poojas.filter(p => p.name.trim() && p.price.trim());
    if (validPoojas.length === 0) {
      Alert.alert('Error', 'Please add at least one pooja service');
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        user_id: user?.id,
        name: name.trim(),
        photo: '',
        bio: bio.trim(),
        experience_years: parseInt(experience) || 0,
        location: location.trim(),
        operating_areas: operatingAreas.split(',').map(a => a.trim()).filter(Boolean),
        poojas: validPoojas.map(p => ({
          name: p.name.trim(),
          description: p.description.trim(),
          price: parseFloat(p.price) || 0,
          duration: p.duration.trim(),
        })),
        is_approved: false,
        is_active: true,
        rating: 0,
        total_bookings: 0,
      };

      if (isEdit) {
        await apiClient.put('/saints/profile', profileData);
        Alert.alert('Success', 'Profile updated successfully',
          [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await apiClient.post('/saints/profile', profileData);
        Alert.alert('Success', 'Profile created successfully! You are now live.',
          [{ text: 'OK', onPress: () => router.replace('/saint/dashboard') }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Profile' : 'Setup Profile'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="Enter your full name"
                value={name} onChangeText={setName} placeholderTextColor="#999"
                testID="saint-name-input" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput style={[styles.input, styles.textArea]}
                placeholder="Tell customers about yourself"
                value={bio} onChangeText={setBio} multiline numberOfLines={4}
                placeholderTextColor="#999" testID="saint-bio-input" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Years of Experience *</Text>
              <TextInput style={styles.input} placeholder="e.g., 10"
                value={experience} onChangeText={setExperience}
                keyboardType="numeric" placeholderTextColor="#999"
                testID="saint-experience-input" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Location *</Text>
              <TextInput style={styles.input} placeholder="e.g., Mumbai"
                value={location} onChangeText={setLocation}
                placeholderTextColor="#999" testID="saint-location-input" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Operating Areas * (comma separated)</Text>
              <TextInput style={styles.input}
                placeholder="e.g., Mumbai, Navi Mumbai, Thane"
                value={operatingAreas} onChangeText={setOperatingAreas}
                placeholderTextColor="#999" testID="saint-areas-input" />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pooja Services</Text>
              <TouchableOpacity style={styles.addButton} onPress={addPooja} testID="add-pooja-button">
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {poojas.map((pooja, index) => (
              <View key={index} style={styles.poojaCard}>
                <View style={styles.poojaHeader}>
                  <Text style={styles.poojaTitle}>Pooja #{index + 1}</Text>
                  {poojas.length > 1 && (
                    <TouchableOpacity onPress={() => removePooja(index)}>
                      <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pooja Name *</Text>
                  <TextInput style={styles.input} placeholder="e.g., Ganesh Pooja"
                    value={pooja.name} onChangeText={(v) => updatePooja(index, 'name', v)}
                    placeholderTextColor="#999" testID={`pooja-name-${index}`} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput style={styles.input} placeholder="Brief description"
                    value={pooja.description} onChangeText={(v) => updatePooja(index, 'description', v)}
                    placeholderTextColor="#999" />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Price (₹) *</Text>
                    <TextInput style={styles.input} placeholder="2000"
                      value={pooja.price} onChangeText={(v) => updatePooja(index, 'price', v)}
                      keyboardType="numeric" placeholderTextColor="#999"
                      testID={`pooja-price-${index}`} />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>Duration</Text>
                    <TextInput style={styles.input} placeholder="e.g., 2 hours"
                      value={pooja.duration} onChangeText={(v) => updatePooja(index, 'duration', v)}
                      placeholderTextColor="#999" />
                  </View>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit} disabled={loading} testID="submit-profile-button">
            {loading ? <ActivityIndicator color="#FFF" /> :
              <Text style={styles.submitButtonText}>{isEdit ? 'Update Profile' : 'Create Profile'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flex: 1 },
  section: { backgroundColor: '#FFF', padding: 20, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B35',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  addButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 14, fontSize: 15, color: '#333' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  poojaCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E0E0E0' },
  poojaHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12 },
  poojaTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  submitButton: { backgroundColor: '#FF6B35', borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center', margin: 20 },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
