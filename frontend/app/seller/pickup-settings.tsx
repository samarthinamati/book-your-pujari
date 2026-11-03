
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function SellerPickupSettings() {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.get(
        '/store/seller/pickup-settings'
      );
      setSelectedDays(response?.pickup_days ?? []);
    } catch (error: any) {
      Alert.alert(
        'Unable to load settings',
        error?.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  };

  const saveSettings = async () => {
    if (selectedDays.length === 0) {
      Alert.alert(
        'Select a pickup day',
        'Please select at least one available pickup day.'
      );
      return;
    }

    try {
      setSaving(true);

      const response = await apiClient.put(
        '/store/seller/pickup-settings',
        { pickup_days: DAYS.filter((day) => selectedDays.includes(day)) }
      );

      setSelectedDays(response?.pickup_days ?? selectedDays);

      Alert.alert(
        'Settings saved',
        'Your weekly pickup days have been saved successfully.'
      );
    } catch (error: any) {
      Alert.alert(
        'Unable to save settings',
        error?.message || 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#2874F0"
          style={{ marginTop: 50 }}
        />
        <Text style={styles.loadingText}>Loading pickup settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#172B4D" />
          <Text style={styles.backText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar-outline" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Pickup Settings</Text>
          <Text style={styles.subtitle}>
            Select the days when your shop is available for Delhivery parcel
            collection.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Weekly Available Days</Text>
          <Text style={styles.description}>
            Select at least one day. You can change these days whenever needed.
          </Text>

          {DAYS.map((day) => {
            const selected = selectedDays.includes(day);

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayRow,
                  selected && styles.selectedDayRow,
                ]}
                onPress={() => toggleDay(day)}
                activeOpacity={0.75}
              >
                <View style={styles.dayLeft}>
                  <Ionicons
                    name={
                      selected
                        ? 'checkbox'
                        : 'square-outline'
                    }
                    size={25}
                    color={selected ? '#2874F0' : '#98A2B3'}
                  />
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.selectedDayText,
                    ]}
                  >
                    {day}
                  </Text>
                </View>

                {selected && (
                  <Text style={styles.selectedLabel}>Available</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <Text style={styles.selectionCount}>
            {selectedDays.length} day(s) selected
          </Text>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.saveButtonText}>Save Pickup Days</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#8A5A00"
          />
          <Text style={styles.noticeText}>
            These are your preferred weekly collection days. Saving them does
            not itself book a Delhivery pickup. PujariGo will use them when
            connecting the shipment scheduling process.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    padding: 18,
    paddingBottom: 35,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  backText: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#2874F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  description: {
    color: '#667085',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 14,
  },
  dayRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#EAECF0',
    marginBottom: 9,
  },
  selectedDayRow: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2874F0',
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 15,
    color: '#344054',
    marginLeft: 12,
  },
  selectedDayText: {
    color: '#174EA6',
    fontWeight: '600',
  },
  selectedLabel: {
    color: '#2874F0',
    fontSize: 12,
    fontWeight: '600',
  },
  selectionCount: {
    color: '#667085',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 16,
  },
  saveButton: {
    minHeight: 50,
    backgroundColor: '#2874F0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF4D6',
    padding: 14,
    borderRadius: 12,
    marginTop: 17,
  },
  noticeText: {
    flex: 1,
    marginLeft: 10,
    color: '#6B4E16',
    fontSize: 12,
    lineHeight: 18,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#667085',
  },
});
