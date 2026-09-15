// frontend/app/customer/similar-saints.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

export default function SimilarSaintsScreen() {
  const { bookingId } = useLocalSearchParams();
  const [saints, setSaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { fetchSaints(); }, []);

  const fetchSaints = async () => {
    try {
      const data = await apiClient.get(`/saints/similar/${bookingId}`);
      setSaints(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load saints');
    } finally { setLoading(false); }
  };

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Other Saints Available</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#FF6B35" />
        <Text style={styles.infoText}>
          Here are other saints in your region who perform the same pooja
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {saints.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sad-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No Other Saints Available</Text>
            <Text style={styles.emptySubtitle}>
              We couldn't find other saints in your region for this pooja.
              Your refund will be processed within 5-7 days.
            </Text>
            <TouchableOpacity style={styles.browseButton}
              onPress={() => router.replace('/customer/dashboard')}>
              <Text style={styles.browseButtonText}>Browse All Saints</Text>
            </TouchableOpacity>
          </View>
        ) : (
          saints.map((saint) => (
            <TouchableOpacity key={saint.id} style={styles.saintCard}
              onPress={() => router.push(`/customer/saint-details?id=${saint.id}`)}
              testID={`similar-saint-${saint.id}`}>
              <View style={styles.saintHeader}>
                <View style={styles.saintAvatar}>
                  <Ionicons name="person" size={32} color="#FF6B35" />
                </View>
                <View style={styles.saintInfo}>
                  <Text style={styles.saintName}>{saint.name}</Text>
                  <View style={styles.saintMeta}>
                    <Ionicons name="location" size={14} color="#666" />
                    <Text style={styles.saintLocation}>{saint.location}</Text>
                  </View>
                  <View style={styles.saintStats}>
                    <View style={styles.stat}>
                      <Ionicons name="star" size={14} color="#FFB800" />
                      <Text style={styles.statText}>{saint.rating.toFixed(1)}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="briefcase" size={14} color="#666" />
                      <Text style={styles.statText}>{saint.experience_years}y exp</Text>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                      <Text style={styles.statText}>{saint.total_bookings} bookings</Text>
                    </View>
                  </View>
                </View>
              </View>
              {saint.bio ? <Text style={styles.saintBio}>{saint.bio}</Text> : null}
              <View style={styles.cardFooter}>
                <Text style={styles.viewDetails}>View Details & Book</Text>
                <Ionicons name="arrow-forward" size={20} color="#FF6B35" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF5F0', padding: 14, marginHorizontal: 16, marginTop: 16, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 13, color: '#333', lineHeight: 18 },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  browseButton: { backgroundColor: '#FF6B35', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 24 },
  browseButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  saintCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  saintHeader: { flexDirection: 'row', marginBottom: 12 },
  saintAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saintInfo: { flex: 1 },
  saintName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  saintMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  saintLocation: { fontSize: 14, color: '#666', marginLeft: 4 },
  saintStats: { flexDirection: 'row', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#666' },
  saintBio: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  viewDetails: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
});
