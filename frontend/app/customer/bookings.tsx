// frontend/app/customer/bookings.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

interface Booking {
  id: string;
  saint_id: string;
  pooja_name: string;
  booking_date: string;
  booking_time: string;
  address: string;
  customer_name: string;
  customer_phone: string;
  base_price: number;
  platform_commission: number;
  total_price: number;
  payment_status: string;
  booking_status: string;
  created_at: string;
  saint_action?: string;
  refund_status?: string;
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    try {
      const data = await apiClient.get('/bookings/my-bookings');
      setBookings(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchBookings(); };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'accepted': return '#4CAF50';
      case 'pending':
      case 'awaiting_saint_confirmation': return '#FFA726';
      case 'completed': return '#2196F3';
      case 'cancelled':
      case 'rejected': return '#F44336';
      default: return '#999';
    }
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
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No bookings yet</Text>
            <Text style={styles.emptySubtext}>Book your first pooja to get started</Text>
            <TouchableOpacity style={styles.browseButton}
              onPress={() => router.replace('/customer/dashboard')}>
              <Text style={styles.browseButtonText}>Browse Pujaris</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bookings.map((booking) => {
            const saintAction = booking.saint_action || 'pending';
            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.poojaName}>{booking.pooja_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.booking_status) }]}>
                    <Text style={styles.statusText}>{booking.booking_status.replace(/_/g, ' ')}</Text>
                  </View>
                </View>

                {booking.payment_status === 'paid' && saintAction === 'pending' && (
                  <View style={styles.saintActionInfo}>
                    <Ionicons name="hourglass-outline" size={16} color="#FFA726" />
                    <Text style={styles.saintActionText}>Waiting for saint to confirm...</Text>
                  </View>
                )}

                {saintAction === 'accepted' && (
                  <View style={[styles.saintActionInfo, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.saintActionText, { color: '#4CAF50' }]}>
                      Saint has accepted your booking!
                    </Text>
                  </View>
                )}

                {saintAction === 'rejected' && (
                  <View style={[styles.saintActionInfo, { backgroundColor: '#FFEBEE' }]}>
                    <Ionicons name="close-circle" size={16} color="#F44336" />
                    <Text style={[styles.saintActionText, { color: '#F44336' }]}>
                      Saint rejected. {booking.refund_status === 'failed'
                        ? 'Refund failed - contact support.'
                        : 'Refund initiated (5-7 days).'}
                    </Text>
                  </View>
                )}

                {saintAction === 'rejected' && (
                  <TouchableOpacity style={styles.findAnotherButton}
                    onPress={() => router.push(`/customer/similar-saints?bookingId=${booking.id}`)}>
                    <Ionicons name="search" size={18} color="#FFF" />
                    <Text style={styles.findAnotherText}>Find Another Saint in Same Region</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.bookingInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar" size={16} color="#666" />
                    <Text style={styles.infoText}>{booking.booking_date}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.infoText}>{booking.booking_time}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location" size={16} color="#666" />
                  <Text style={styles.addressText} numberOfLines={2}>{booking.address}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.priceSection}>
                  <View style={styles.priceRow}>
                    <Text style={styles.totalLabel}>Total Amount Paid</Text>
                    <Text style={styles.totalValue}>₹{Math.round(booking.total_price)}</Text>
                  </View>
                </View>

                {booking.payment_status === 'paid' && saintAction === 'accepted' && (
                  <TouchableOpacity style={styles.reviewButton}
                    onPress={() => router.push(`/customer/review?bookingId=${booking.id}&saintId=${booking.saint_id}`)}>
                    <Ionicons name="star-outline" size={18} color="#FF6B35" />
                    <Text style={styles.reviewButtonText}>Write Review</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
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
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#666', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8 },
  browseButton: { backgroundColor: '#FF6B35', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 24 },
  browseButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  bookingCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16 },
  poojaName: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  bookingInfo: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 14, color: '#666' },
  addressText: { fontSize: 14, color: '#666', flex: 1 },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 12 },
  priceSection: { marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#FF6B35' },
  reviewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF5F0', borderRadius: 8, paddingVertical: 10, gap: 6 },
  reviewButtonText: { color: '#FF6B35', fontSize: 14, fontWeight: '600' },
  saintActionInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0',
    padding: 10, borderRadius: 8, marginBottom: 12, gap: 8 },
  saintActionText: { fontSize: 13, color: '#FFA726', fontWeight: '600', flex: 1 },
  findAnotherButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B35', padding: 12, borderRadius: 10, marginBottom: 12, gap: 8 },
  findAnotherText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
