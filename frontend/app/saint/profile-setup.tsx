import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
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
  const [location, setLocation] = useState('');
  const [operatingAreas, setOperatingAreas] = useState('');

  const [poojas, setPoojas] = useState<Pooja[]>([
    {
      name: '',
      description: '',
      price: '',
      duration: '',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetchProfile();
    }
  }, [isEdit]);

  const fetchProfile = async () => {
    try {
      setFetching(true);

      const data = await apiClient.get('/saints/profile/me');

      setName(data.name || '');
      setLocation(data.location || '');

      setOperatingAreas(
        Array.isArray(data.operating_areas)
          ? data.operating_areas.join(', ')
          : ''
      );

      if (Array.isArray(data.poojas) && data.poojas.length > 0) {
        setPoojas(
          data.poojas.map((p: any) => ({
            name: p?.name || '',
            description: p?.description || '',
            price:
              p?.price !== undefined && p?.price !== null
                ? String(p.price)
                : '',
            duration: p?.duration || '',
          }))
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to load your profile.'
      );
    } finally {
      setFetching(false);
    }
  };

  const addPooja = () => {
    setPoojas([
      ...poojas,
      {
        name: '',
        description: '',
        price: '',
        duration: '',
      },
    ]);
  };

  const removePooja = (index: number) => {
    if (poojas.length === 1) {
      Alert.alert(
        'Error',
        'You must have at least one pooja service.'
      );
      return;
    }

    setPoojas(poojas.filter((_, i) => i !== index));
  };

  const updatePooja = (
    index: number,
    field: keyof Pooja,
    value: string
  ) => {
    const updated = [...poojas];

    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setPoojas(updated);
  };

  const handleGoToDashboard = () => {
    setShowSuccessModal(false);
    router.replace('/saint/dashboard');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Please enter your primary location.');
      return;
    }

    if (!operatingAreas.trim()) {
      Alert.alert('Error', 'Please enter your operating areas.');
      return;
    }

    const validPoojas = poojas.filter(
      (p) => p.name.trim() && p.price.trim()
    );

    if (validPoojas.length === 0) {
      Alert.alert(
        'Error',
        'Please add at least one pooja service with a name and price.'
      );
      return;
    }

    setLoading(true);

    try {
      const profileData = {
        name: name.trim(),

        location: location.trim(),

        operating_areas: operatingAreas
          .split(',')
          .map((area) => area.trim())
          .filter(Boolean),

        poojas: validPoojas.map((p) => ({
          name: p.name.trim(),
          description: p.description.trim(),
          price: parseFloat(p.price) || 0,
          duration: p.duration.trim(),
        })),

        is_active: true,
      };

      if (isEdit) {
        // UPDATE EXISTING PROFILE
        const updatedProfile = await apiClient.put(
          '/saints/profile',
          profileData
        );

        console.log('Updated Saint Profile:', updatedProfile);
      } else {
        // CREATE NEW PROFILE
        const createdProfile = await apiClient.post(
          '/saints/profile',
          profileData
        );

        console.log('Created Saint Profile:', createdProfile);
      }

      // SHOW CUSTOM POPUP MODAL
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Profile save error:', error);

      Alert.alert(
        isEdit ? 'Update Failed' : 'Profile Creation Failed',
        error?.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color="#FF6B35"
        />

        <Text style={styles.loadingText}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Profile' : 'Setup Profile'}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* PERSONAL INFORMATION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Personal Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Full Name *
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
                placeholderTextColor="#999"
                testID="saint-name-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Primary Location *
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g., Mysuru"
                value={location}
                onChangeText={setLocation}
                placeholderTextColor="#999"
                testID="saint-location-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Operating Areas * (comma separated)
              </Text>

              <TextInput
                style={styles.input}
                placeholder="e.g., Mysuru, Bengaluru, Mandya"
                value={operatingAreas}
                onChangeText={setOperatingAreas}
                placeholderTextColor="#999"
                testID="saint-areas-input"
              />
            </View>
          </View>

          {/* POOJA SERVICES */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Pooja Services
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                onPress={addPooja}
                testID="add-pooja-button"
              >
                <Ionicons
                  name="add"
                  size={20}
                  color="#FFF"
                />

                <Text style={styles.addButtonText}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>

            {poojas.map((pooja, index) => (
              <View
                key={index}
                style={styles.poojaCard}
              >
                <View style={styles.poojaHeader}>
                  <Text style={styles.poojaTitle}>
                    Pooja #{index + 1}
                  </Text>

                  {poojas.length > 1 && (
                    <TouchableOpacity
                      onPress={() =>
                        removePooja(index)
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#F44336"
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Pooja Name *
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Ganesh Pooja"
                    value={pooja.name}
                    onChangeText={(value) =>
                      updatePooja(
                        index,
                        'name',
                        value
                      )
                    }
                    placeholderTextColor="#999"
                    testID={`pooja-name-${index}`}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Description
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Brief description"
                    value={pooja.description}
                    onChangeText={(value) =>
                      updatePooja(
                        index,
                        'description',
                        value
                      )
                    }
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.row}>
                  <View
                    style={[
                      styles.inputGroup,
                      {
                        flex: 1,
                        marginRight: 8,
                      },
                    ]}
                  >
                    <Text style={styles.label}>
                      Price (₹) *
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="2000"
                      value={pooja.price}
                      onChangeText={(value) =>
                        updatePooja(
                          index,
                          'price',
                          value
                        )
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                      testID={`pooja-price-${index}`}
                    />
                  </View>

                  <View
                    style={[
                      styles.inputGroup,
                      {
                        flex: 1,
                        marginLeft: 8,
                      },
                    ]}
                  >
                    <Text style={styles.label}>
                      Duration
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 2 hours"
                      value={pooja.duration}
                      onChangeText={(value) =>
                        updatePooja(
                          index,
                          'duration',
                          value
                        )
                      }
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            testID="submit-profile-button"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEdit
                  ? 'Update Profile'
                  : 'Create Profile'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SUCCESS MODAL POPUP */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons
                name="checkmark-circle"
                size={64}
                color="#4CAF50"
              />
            </View>

            <Text style={styles.modalTitle}>
              {isEdit ? 'Profile Updated!' : '🎉 Profile Created!'}
            </Text>

            <Text style={styles.modalDescription}>
              {isEdit
                ? 'Your changes have been saved successfully.'
                : 'Your Pujari profile is now created and live. Customers can now search and book your poojas.'}
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleGoToDashboard}
            >
              <Text style={styles.modalButtonText}>
                Go Back to Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  content: {
    flex: 1,
  },

  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },

  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  inputGroup: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },

  row: {
    flexDirection: 'row',
  },

  poojaCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  poojaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  poojaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  submitButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  successIconContainer: {
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },

  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  modalButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },

  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
