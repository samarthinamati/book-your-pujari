// frontend/app/saint/dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiClient } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDateWithDay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const day = DAYS[date.getDay()];
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    return `${formatted} · ${day}`;
  } catch {
    return dateStr;
  }
};

export default function SaintDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [popupBooking, setPopupBooking] = useState<any>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const savedLastSeen = await storage.getItem('saint_last_seen_bookings', '');
      setLastSeenAt(savedLastSeen);

      try {
        const profileData = await apiClient.get('/saints/profile/me');
        setProfile(profileData);
      } catch { setProfile(null); }

      try {
        const bookingsData = await apiClient.get('/bookings/my-bookings');
        bookingsData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setBookings(bookingsData);

        const pendingBookings = bookingsData.filter((b: any) => (b.saint_action || 'pending') === 'pending');

        if (savedLastSeen) {
          const unread = pendingBookings.filter(
            (b: any) => new Date(b.created_at) > new Date(savedLastSeen)
          );
          setNewBookingsCount(unread.length);
          if (unread.length > 0) setPopupBooking(unread[0]);
        } else {
          setNewBookingsCount(pendingBookings.length);
          if (pendingBookings.length > 0) setPopupBooking(pendingBookings[0]);
        }
      } catch { setBookings([]); }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAllAsSeen = async () => {
    const now = new Date().toISOString();
    await storage.setItem('saint_last_seen_bookings', now);
    setLastSeenAt(now);
    setNewBookingsCount(0);
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/auth/login'); } },
    ]);
  };

  const handleToggleActive = async () => {
    if (!profile) return;
    try {
      const updated = await apiClient.put('/saints/profile', { is_active: !profile.is_active });
      setProfile(updated);
    } catch (error: any) { Alert.alert('Error', error.message); }
  };

  const handleDeleteProfile = () => {
    Alert.alert('Delete Profile', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete('/saints/profile');
          setProfile(null);
        } catch (error: any) { Alert.alert('Error', error.message); }
      }},
    ]);
  };

  const handleBookingAction = async (bookingId: string, action: 'accept' | 'reject') => {
    const title = action === 'accept' ? 'Accept Booking' : 'Reject Booking';
    const message = action === 'accept'
      ? 'Confirm that you will perform this pooja?'
      : 'Are you sure you want to reject this booking? Customer will be refunded.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'accept' ? 'Accept' : 'Reject',
        style: action === 'reject' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await apiClient.put(`/bookings/${bookingId}/saint-action`, { action, reason: '' });
            Alert.alert('Success', `Booking ${action}ed successfully`);
            setPopupBooking(null);
            fetchData();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handlePopupAction = async (action: 'accept' | 'reject') => {
    if (!popupBooking || actionProcessing) return;
    setActionProcessing(true);
    try {
      await apiClient.put(`/bookings/${popupBooking.id}/saint-action`, { action, reason: '' });
      Alert.alert(
        'Success',
        action === 'accept'
          ? 'Booking accepted! Customer will be notified.'
          : 'Booking rejected. Refund will be processed if payment was made.'
      );
      setPopupBooking(null);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setActionProcessing(false);
    }
  };

  const isNewBooking = (booking: any): boolean => {
    if (booking.saint_action && booking.saint_action !== 'pending') return false;
    if (!lastSeenAt) return true;
    return new Date(booking.created_at) > new Date(lastSeenAt);
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  const totalEarnings = bookings.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + b.base_price, 0);
  const paidBookings = bookings.filter(b => b.payment_status === 'paid');

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={!!popupBooking} transparent animationType="fade"
        onRequestClose={() => setPopupBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.bellIcon}>
                <Ionicons name="notifications" size={32} color="#FF6B35" />
              </View>
              <Text style={styles.modalTitle}>New Booking Request!</Text>
              <Text style={styles.modalSubtitle}>Would you like to accept this booking?</Text>
            </View>

            {popupBooking && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.modalPoojaCard}>
                  <Text style={styles.modalPoojaName}>{popupBooking.pooja_name}</Text>
                  <Text style={styles.modalPoojaEarn}>You earn: ₹{popupBooking.base_price}</Text>
                </View>

                <View style={styles.modalDetail}>
                  <Ionicons name="person" size={18} color="#FF6B35" />
                  <View style={styles.modalDetailContent}>
                    <Text style={styles.modalDetailLabel}>Customer</Text>
                    <Text style={styles.modalDetailValue}>{popupBooking.customer_name}</Text>
                  </View>
                </View>

                <View style={styles.modalDetail}>
                  <Ionicons name="call" size={18} color="#FF6B35" />
                  <View style={styles.modalDetailContent}>
                    <Text style={styles.modalDetailLabel}>Mobile</Text>
                    <Text style={styles.modalDetailValue}>{popupBooking.customer_phone}</Text>
                  </View>
                </View>

                <View style={styles.modalDetail}>
                  <Ionicons name="calendar" size={18} color="#FF6B35" />
                  <View style={styles.modalDetailContent}>
                    <Text style={styles.modalDetailLabel}>Date & Day</Text>
                    <Text style={styles.modalDetailValue}>{formatDateWithDay(popupBooking.booking_date)}</Text>
                  </View>
                </View>

                <View style={styles.modalDetail}>
                  <Ionicons name="time" size={18} color="#FF6B35" />
                  <View style={styles.modalDetailContent}>
                    <Text style={styles.modalDetailLabel}>Time</Text>
                    <Text style={styles.modalDetailValue}>{popupBooking.booking_time}</Text>
                  </View>
                </View>

                <View style={styles.modalDetail}>
                  <Ionicons name="location" size={18} color="#FF6B35" />
                  <View style={styles.modalDetailContent}>
                    <Text style={styles.modalDetailLabel}>Address</Text>
                    <Text style={styles.modalDetailValue}>{popupBooking.address}</Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalRejectBtn, actionProcessing && styles.btnDisabled]}
                onPress={() => handlePopupAction('reject')}
                disabled={actionProcessing} testID="popup-reject-button">
                <Ionicons name="close-circle" size={22} color="#FFF" />
                <Text style={styles.modalBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalAcceptBtn, actionProcessing && styles.btnDisabled]}
                onPress={() => handlePopupAction('accept')}
                disabled={actionProcessing} testID="popup-accept-button">
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                <Text style={styles.modalBtnText}>Accept</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalLater}
              onPress={() => setPopupBooking(null)} disabled={actionProcessing}>
              <Text style={styles.modalLaterText}>Decide Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <View style={styles.headerActions}>
          {newBookingsCount > 0 && (
            <View style={styles.notificationWrapper}>
              <Ionicons name="notifications" size={24} color="#FF6B35" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{newBookingsCount}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.iconButton} onPress={handleLogout} testID="logout-button">
            <Ionicons name="log-out-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {!profile ? (
          <View style={styles.emptyProfile}>
            <Ionicons name="person-add" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>Complete Your Profile</Text>
            <Text style={styles.emptySubtitle}>Set up your profile to start receiving bookings</Text>
            <TouchableOpacity style={styles.createButton}
              onPress={() => router.push('/saint/profile-setup')} testID="create-profile-button">
              <Text style={styles.createButtonText}>Create Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {newBookingsCount > 0 && (
              <TouchableOpacity style={styles.notificationBanner} onPress={markAllAsSeen}>
                <Ionicons name="notifications" size={20} color="#FFF" />
                <Text style={styles.notificationBannerText}>
                  You have {newBookingsCount} new booking{newBookingsCount > 1 ? 's' : ''}!
                </Text>
                <Text style={styles.markReadText}>Tap to mark as read</Text>
              </TouchableOpacity>
            )}

            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View style={styles.avatar}><Ionicons name="person" size={40} color="#FF6B35" /></View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.profileLocation}>{profile.location}</Text>
                  <View style={styles.approvalStatus}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.approvedText}>Live & Verified</Text>
                  </View>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statBox}><Text style={styles.statValue}>{profile.rating.toFixed(1)}</Text><Text style={styles.statLabel}>Rating</Text></View>
                <View style={styles.statBox}><Text style={styles.statValue}>{paidBookings.length}</Text><Text style={styles.statLabel}>Bookings</Text></View>
                <View style={styles.statBox}><Text style={styles.statValue}>₹{totalEarnings}</Text><Text style={styles.statLabel}>Earnings</Text></View>
              </View>
            </View>

            <View style={styles.actionsCard}>
              <TouchableOpacity style={styles.actionItem}
                onPress={() => router.push('/saint/profile-setup?edit=true')} testID="edit-profile-button">
                <Ionicons name="create-outline" size={24} color="#FF6B35" />
                <Text style={styles.actionText}>Edit Profile</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Ionicons name={profile.is_active ? 'checkmark-circle' : 'close-circle'}
                    size={24} color={profile.is_active ? '#4CAF50' : '#F44336'} />
                  <View>
                    <Text style={styles.actionText}>Profile Status</Text>
                    <Text style={styles.toggleSubtext}>{profile.is_active ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.toggleButton, profile.is_active && styles.toggleButtonActive]}
                  onPress={handleToggleActive} testID="toggle-active-button">
                  <View style={[styles.toggleCircle, profile.is_active && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.actionItem} onPress={handleDeleteProfile} testID="delete-profile-button">
                <Ionicons name="trash-outline" size={24} color="#F44336" />
                <Text style={[styles.actionText, { color: '#F44336' }]}>Delete Profile</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Bookings ({bookings.length})</Text>
                {newBookingsCount > 0 && (
                  <TouchableOpacity onPress={markAllAsSeen}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {bookings.length === 0 ? (
                <View style={styles.emptyBookings}>
                  <Ionicons name="calendar-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyBookingsText}>No bookings yet</Text>
                  <Text style={styles.emptyBookingsSubtext}>New bookings will appear here</Text>
                </View>
              ) : (
                bookings.map((booking) => {
                  const isNew = isNewBooking(booking);
                  const saintAction = booking.saint_action || 'pending';
                  const canAction = saintAction === 'pending';
                  return (
                    <View key={booking.id} style={[styles.bookingCard, isNew && styles.bookingCardNew]}>
                      {isNew && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}

                      <View style={styles.bookingCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bookingPoojaName}>{booking.pooja_name}</Text>
                          <View style={[styles.paymentPill, { backgroundColor: booking.payment_status === 'paid' ? '#E8F5E9' : '#FFF3E0' }]}>
                            <Ionicons
                              name={booking.payment_status === 'paid' ? 'checkmark-circle' : 'time'}
                              size={12}
                              color={booking.payment_status === 'paid' ? '#4CAF50' : '#FFA726'} />
                            <Text style={[styles.paymentPillText, { color: booking.payment_status === 'paid' ? '#4CAF50' : '#FFA726' }]}>
                              {booking.payment_status === 'paid' ? 'Payment Confirmed' : 'Payment Pending'}
                            </Text>
                          </View>
                          {saintAction === 'accepted' && (
                            <View style={[styles.paymentPill, { backgroundColor: '#E3F2FD', marginTop: 6 }]}>
                              <Ionicons name="checkmark-done" size={12} color="#2196F3" />
                              <Text style={[styles.paymentPillText, { color: '#2196F3' }]}>You Accepted</Text>
                            </View>
                          )}
                          {saintAction === 'rejected' && (
                            <View style={[styles.paymentPill, { backgroundColor: '#FFEBEE', marginTop: 6 }]}>
                              <Ionicons name="close-circle" size={12} color="#F44336" />
                              <Text style={[styles.paymentPillText, { color: '#F44336' }]}>You Rejected</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.priceTag}>
                          <Text style={styles.priceTagLabel}>You earn</Text>
                          <Text style={styles.priceTagValue}>₹{booking.base_price}</Text>
                        </View>
                      </View>

                      <View style={styles.detailsGrid}>
                        <View style={styles.detailRow}>
                          <View style={styles.detailIcon}><Ionicons name="person" size={16} color="#FF6B35" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Customer Name</Text>
                            <Text style={styles.detailValue}>{booking.customer_name}</Text>
                          </View>
                        </View>
                        <View style={styles.detailRow}>
                          <View style={styles.detailIcon}><Ionicons name="call" size={16} color="#FF6B35" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Mobile Number</Text>
                            <Text style={styles.detailValue}>{booking.customer_phone}</Text>
                          </View>
                        </View>
                        <View style={styles.detailRow}>
                          <View style={styles.detailIcon}><Ionicons name="calendar" size={16} color="#FF6B35" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Date & Day</Text>
                            <Text style={styles.detailValue}>{formatDateWithDay(booking.booking_date)}</Text>
                          </View>
                        </View>
                        <View style={styles.detailRow}>
                          <View style={styles.detailIcon}><Ionicons name="time" size={16} color="#FF6B35" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Time</Text>
                            <Text style={styles.detailValue}>{booking.booking_time}</Text>
                          </View>
                        </View>
                        <View style={styles.detailRow}>
                          <View style={styles.detailIcon}><Ionicons name="location" size={16} color="#FF6B35" /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>Address</Text>
                            <Text style={styles.detailValue}>{booking.address}</Text>
                          </View>
                        </View>
                      </View>

                      {canAction && (
                        <View style={styles.actionButtonsRow}>
                          <TouchableOpacity style={[styles.actionBtn, styles.rejectActionBtn]}
                            onPress={() => handleBookingAction(booking.id, 'reject')}
                            testID={`reject-booking-${booking.id}`}>
                            <Ionicons name="close-circle" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtn, styles.acceptActionBtn]}
                            onPress={() => handleBookingAction(booking.id, 'accept')}
                            testID={`accept-booking-${booking.id}`}>
                            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Accept</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  greeting: { fontSize: 14, color: '#666' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notificationWrapper: { position: 'relative', padding: 4 },
  notificationBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#F44336',
    minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: '#FFF' },
  notificationBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  notificationBanner: { backgroundColor: '#FF6B35', margin: 16, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  notificationBannerText: { color: '#FFF', fontSize: 15, fontWeight: '600', flex: 1 },
  markReadText: { color: '#FFF', fontSize: 11, opacity: 0.9 },
  emptyProfile: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8 },
  createButton: { backgroundColor: '#FF6B35', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 24 },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  profileCard: { backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  profileHeader: { flexDirection: 'row', marginBottom: 20 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF5F0', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  profileInfo: { flex: 1, justifyContent: 'center' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  profileLocation: { fontSize: 14, color: '#666', marginTop: 4 },
  approvalStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  approvedText: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 16 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#FF6B35' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  actionsCard: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 4, marginBottom: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  actionText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleSubtext: { fontSize: 12, color: '#666', marginTop: 2 },
  toggleButton: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#CCC', padding: 3, justifyContent: 'center' },
  toggleButtonActive: { backgroundColor: '#4CAF50' },
  toggleCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' },
  toggleCircleActive: { alignSelf: 'flex-end' },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginHorizontal: 16 },
  section: { backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  markAllText: { fontSize: 13, color: '#FF6B35', fontWeight: '600' },
  emptyBookings: { padding: 32, alignItems: 'center' },
  emptyBookingsText: { color: '#666', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBookingsSubtext: { color: '#999', fontSize: 13, marginTop: 4 },
  bookingCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E0E0E0', position: 'relative' },
  bookingCardNew: { borderColor: '#FF6B35', borderWidth: 2, backgroundColor: '#FFF5F0' },
  newBadge: { position: 'absolute', top: -8, right: 12, backgroundColor: '#FF6B35',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  newBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  bookingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  bookingPoojaName: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  paymentPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  paymentPillText: { fontSize: 11, fontWeight: '600' },
  priceTag: { alignItems: 'flex-end' },
  priceTagLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceTagValue: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50', marginTop: 2 },
  detailsGrid: { gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF5F0', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  detailLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  detailValue: { fontSize: 15, color: '#333', fontWeight: '500', lineHeight: 20 },
  actionButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, gap: 6 },
  acceptActionBtn: { backgroundColor: '#4CAF50' },
  rejectActionBtn: { backgroundColor: '#F44336' },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '100%', maxHeight: '90%' },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  bellIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  modalSubtitle: { fontSize: 14, color: '#666', marginTop: 4, textAlign: 'center' },
  modalScroll: { maxHeight: 400, marginBottom: 16 },
  modalPoojaCard: { backgroundColor: '#FFF5F0', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#FF6B35', alignItems: 'center' },
  modalPoojaName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  modalPoojaEarn: { fontSize: 16, fontWeight: '600', color: '#4CAF50' },
  modalDetail: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12,
    padding: 10, backgroundColor: '#F8F9FA', borderRadius: 8 },
  modalDetailContent: { flex: 1 },
  modalDetailLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.3 },
  modalDetailValue: { fontSize: 15, color: '#333', fontWeight: '500', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  modalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 6 },
  modalAcceptBtn: { backgroundColor: '#4CAF50' },
  modalRejectBtn: { backgroundColor: '#F44336' },
  modalBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  modalLater: { alignItems: 'center', padding: 10 },
  modalLaterText: { color: '#999', fontSize: 14 },
});
