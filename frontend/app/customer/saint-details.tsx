// frontend/app/customer/saint-details.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

interface Saint {
  id: string;
  name: string;
  photo: string;
  bio: string;
  experience_years: number;
  location: string;
  operating_areas: string[];
  poojas: Array<{ name: string; description: string; price: number; duration: string }>;
  rating: number;
  total_bookings: number;
}

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export default function SaintDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [saint, setSaint] = useState<Saint | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { fetchSaintDetails(); fetchReviews(); }, [id]);

  const fetchSaintDetails = async () => {
    try {
      const data = await apiClient.get(`/saints/${id}`);
      setSaint(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load saint details');
      router.back();
    } finally { setLoading(false); }
  };

  const fetchReviews = async () => {
    try {
      const data = await apiClient.get(`/reviews/saint/${id}`);
      setReviews(data);
    } catch (error) {}
  };

  if (loading || !saint) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saint Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color="#FF6B35" />
            </View>
          </View>
          <Text style={styles.saintName}>{saint.name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={24} color="#FFB800" />
              <Text style={styles.statValue}>{saint.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="briefcase" size={24} color="#FF6B35" />
              <Text style={styles.statValue}>{saint.experience_years}</Text>
              <Text style={styles.statLabel}>Years Exp</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.statValue}>{saint.total_bookings}</Text>
              <Text style={styles.statLabel}>Bookings</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color="#FF6B35" />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          <Text style={styles.locationText}>{saint.location}</Text>
          {saint.operating_areas.length > 0 && (
            <View style={styles.areasContainer}>
              {saint.operating_areas.map((area, index) => (
                <View key={index} style={styles.areaChip}>
                  <Text style={styles.areaText}>{area}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {saint.bio ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            <Text style={styles.bioText}>{saint.bio}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={20} color="#FF6B35" />
            <Text style={styles.sectionTitle}>Services Offered</Text>
          </View>
          {saint.poojas.map((pooja, index) => (
            <View key={index} style={styles.poojaCard}>
              <View style={styles.poojaHeader}>
                <Text style={styles.poojaName}>{pooja.name}</Text>
                <Text style={styles.poojaPrice}>₹{Math.round(pooja.price * 1.10)}</Text>
              </View>
              {pooja.description ? <Text style={styles.poojaDescription}>{pooja.description}</Text> : null}
              {pooja.duration ? (
                <View style={styles.poojaFooter}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.poojaDuration}>{pooja.duration}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.bookButton}
                onPress={() => router.push(`/customer/booking?saintId=${saint.id}&poojaName=${encodeURIComponent(pooja.name)}`)}>
                <Text style={styles.bookButtonText}>Book Now</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {reviews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
            </View>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewName}>{review.customer_name}</Text>
                  <View style={styles.reviewRating}>
                    <Ionicons name="star" size={16} color="#FFB800" />
                    <Text style={styles.reviewRatingText}>{review.rating}</Text>
                  </View>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
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
  content: { flex: 1 },
  profileSection: { backgroundColor: '#FFF', paddingVertical: 32, alignItems: 'center', marginBottom: 8 },
  avatarContainer: { marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FF6B35' },
  saintName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 24 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  section: { backgroundColor: '#FFF', padding: 20, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  locationText: { fontSize: 16, color: '#333', marginBottom: 12 },
  areasContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip: { backgroundColor: '#FFF5F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  areaText: { fontSize: 14, color: '#FF6B35' },
  bioText: { fontSize: 15, color: '#666', lineHeight: 22 },
  poojaCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 12 },
  poojaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  poojaName: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
  poojaPrice: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },
  poojaDescription: { fontSize: 14, color: '#666', marginBottom: 8 },
  poojaFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  poojaDuration: { fontSize: 13, color: '#666' },
  bookButton: { flexDirection: 'row', backgroundColor: '#FF6B35', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  reviewCard: { borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingVertical: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewName: { fontSize: 15, fontWeight: '600', color: '#333' },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewRatingText: { fontSize: 14, fontWeight: '600', color: '#333' },
  reviewComment: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 8 },
  reviewDate: { fontSize: 12, color: '#999' },
});
