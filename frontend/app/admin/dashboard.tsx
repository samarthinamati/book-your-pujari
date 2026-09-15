// frontend/app/admin/dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiClient } from '@/src/api/client';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [pendingSaints, setPendingSaints] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'bookings'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [analyticsData, pendingData, bookingsData] = await Promise.all([
        apiClient.get('/admin/analytics'),
        apiClient.get('/admin/saints/pending'),
        apiClient.get('/admin/bookings'),
      ]);
      setAnalytics(analyticsData);
      setPendingSaints(pendingData);
      setAllBookings(bookingsData);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/auth/login'); } },
    ]);
  };

  const handleApproval = async (saintId: string, approved: boolean) => {
    try {
      await apiClient.post('/admin/saints/approve', { saint_id: saintId, approved });
      Alert.alert('Success', approved ? 'Saint approved' : 'Saint rejected');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Admin Panel</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={handleLogout} testID="admin-logout-button">
          <Ionicons name="log-out-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')} testID="tab-overview">
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')} testID="tab-pending">
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending ({pendingSaints.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'bookings' && styles.tabActive]}
          onPress={() => setActiveTab('bookings')} testID="tab-bookings">
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>Bookings</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {activeTab === 'overview' && analytics && (
          <View style={styles.overviewSection}>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="calendar" size={32} color="#2196F3" />
                <Text style={styles.statValue}>{analytics.total_bookings}</Text>
                <Text style={styles.statLabel}>Total Bookings</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                <Text style={styles.statValue}>{analytics.paid_bookings}</Text>
                <Text style={styles.statLabel}>Paid Bookings</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="people" size={32} color="#FFA726" />
                <Text style={styles.statValue}>{analytics.total_saints}</Text>
                <Text style={styles.statLabel}>Active Saints</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FCE4EC' }]}>
                <Ionicons name="time" size={32} color="#E91E63" />
                <Text style={styles.statValue}>{analytics.pending_saints}</Text>
                <Text style={styles.statLabel}>Pending Approvals</Text>
              </View>
            </View>

            <View style={styles.revenueCard}>
              <View style={styles.revenueHeader}>
                <Ionicons name="cash" size={32} color="#FF6B35" />
                <Text style={styles.revenueTitle}>Platform Revenue</Text>
              </View>
              <Text style={styles.revenueAmount}>₹{Math.round(analytics.total_revenue)}</Text>
              <Text style={styles.revenueSubtitle}>Total earnings from 10% commission</Text>
            </View>
          </View>
        )}

        {activeTab === 'pending' && (
          <View style={styles.listSection}>
            {pendingSaints.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done" size={64} color="#4CAF50" />
                <Text style={styles.emptyText}>No pending approvals</Text>
              </View>
            ) : (
              pendingSaints.map((saint) => (
                <View key={saint.id} style={styles.saintCard}>
                  <View style={styles.saintCardHeader}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={32} color="#FF6B35" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saintName}>{saint.name}</Text>
                      <Text style={styles.saintDetails}>
                        {saint.location} · {saint.experience_years} years exp
                      </Text>
                    </View>
                  </View>
                  {saint.bio ? <Text style={styles.saintBio}>{saint.bio}</Text> : null}
                  <View style={styles.areasList}>
                    {saint.operating_areas.map((area: string, i: number) => (
                      <View key={i} style={styles.areaChip}>
                        <Text style={styles.areaText}>{area}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.poojasList}>
                    <Text style={styles.poojaLabel}>Services ({saint.poojas.length}):</Text>
                    {saint.poojas.slice(0, 3).map((p: any, i: number) => (
                      <Text key={i} style={styles.poojaItem}>• {p.name} - ₹{p.price}</Text>
                    ))}
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleApproval(saint.id, false)} testID={`reject-${saint.id}`}>
                      <Ionicons name="close" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleApproval(saint.id, true)} testID={`approve-${saint.id}`}>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'bookings' && (
          <View style={styles.listSection}>
            {allBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              allBookings.map((booking) => (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingPooja}>{booking.pooja_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: booking.payment_status === 'paid' ? '#E8F5E9' : '#FFF3E0' }]}>
                      <Text style={[styles.statusText, { color: booking.payment_status === 'paid' ? '#4CAF50' : '#FFA726' }]}>
                        {booking.payment_status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.partySection}>
                    <View style={styles.partyBlock}>
                      <View style={styles.partyHeader}>
                        <Ionicons name="flower" size={14} color="#FF6B35" />
                        <Text style={styles.partyLabel}>SAINT</Text>
                      </View>
                      <Text style={styles.partyName}>{booking.saint_name || 'Unknown'}</Text>
                      {booking.saint_phone ? (
                        <Text style={styles.partyPhone}>📞 {booking.saint_phone}</Text>
                      ) : null}
                      {booking.saint_location ? (
                        <Text style={styles.partyPhone}>📍 {booking.saint_location}</Text>
                      ) : null}
                    </View>

                    <View style={styles.partyBlock}>
                      <View style={styles.partyHeader}>
                        <Ionicons name="person" size={14} color="#2196F3" />
                        <Text style={styles.partyLabel}>CUSTOMER</Text>
                      </View>
                      <Text style={styles.partyName}>{booking.customer_name}</Text>
                      <Text style={styles.partyPhone}>📞 {booking.customer_phone}</Text>
                    </View>
                  </View>

                  <Text style={styles.bookingInfo}>📅 {booking.booking_date} at {booking.booking_time}</Text>
                  <Text style={styles.bookingInfo} numberOfLines={2}>📍 {booking.address}</Text>

                  <View style={styles.bookingFooter}>
                    <Text style={styles.bookingAmount}>Total: ₹{Math.round(booking.total_price)}</Text>
                    <Text style={styles.bookingCommission}>Commission: ₹{Math.round(booking.platform_commission)}</Text>
                  </View>
                </View>
              ))
            )}
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
    padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  greeting: { fontSize: 14, color: '#666' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF6B35' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#FF6B35' },
  content: { flex: 1 },
  overviewSection: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },
  revenueCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  revenueHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  revenueTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  revenueAmount: { fontSize: 36, fontWeight: 'bold', color: '#FF6B35' },
  revenueSubtitle: { fontSize: 13, color: '#666', marginTop: 8 },
  listSection: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 12 },
  saintCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  saintCardHeader: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saintName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  saintDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  saintBio: { fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 20 },
  areasList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  areaChip: { backgroundColor: '#FFF5F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  areaText: { fontSize: 12, color: '#FF6B35' },
  poojasList: { marginBottom: 12 },
  poojaLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  poojaItem: { fontSize: 13, color: '#666', marginTop: 4 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 8, gap: 6 },
  approveBtn: { backgroundColor: '#4CAF50' },
  rejectBtn: { backgroundColor: '#F44336' },
  actionBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  bookingCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  bookingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bookingPooja: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  bookingInfo: { fontSize: 13, color: '#666', marginTop: 4 },
  partySection: { flexDirection: 'row', gap: 8, marginVertical: 10,
    paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  partyBlock: { flex: 1, backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8 },
  partyHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  partyLabel: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 0.5 },
  partyName: { fontSize: 14, fontWeight: '600', color: '#333' },
  partyPhone: { fontSize: 12, color: '#666', marginTop: 2 },
  bookingFooter: { flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  bookingAmount: { fontSize: 14, fontWeight: '600', color: '#333' },
  bookingCommission: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
});
