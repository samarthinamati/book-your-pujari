// frontend/app/admin/dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/client';

type Tab = 'overview' | 'saints' | 'bookings';

const formatDate = (value: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatMoney = (value: any) => {
  const number = Number(value ?? 0);
  return `₹${Number.isFinite(number) ? number.toFixed(0) : '0'}`;
};

const getStatusColor = (status: string) => {
  if (status === 'paid' || status === 'confirmed' || status === 'accepted') {
    return '#4CAF50';
  }
  if (status === 'rejected') return '#F44336';
  return '#FF9800';
};

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [saints, setSaints] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectingSaintId, setRejectingSaintId] = useState<string | null>(null);

  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsData, saintsData, bookingsData] = await Promise.all([
        apiClient.get('/admin/analytics'),
        apiClient.get('/admin/saints/pending'),
        apiClient.get('/admin/bookings'),
      ]);

      setAnalytics(analyticsData);
      setSaints(Array.isArray(saintsData) ? saintsData : []);
      setAllBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (error: any) {
      console.error('[Admin] fetchData error:', error);
      Alert.alert('Error', error?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRejectSaint = async (saint: any) => {
    if (!saint?.id) {
      Alert.alert('Error', 'Saint ID is missing.');
      return;
    }

    const rejectSaint = async () => {
      try {
        setRejectingSaintId(saint.id);

        console.log('[Admin] Rejecting Saint:', saint.id);

        const response = await apiClient.post('/admin/saints/approve', {
          saint_id: saint.id,
          approved: false,
        });

        console.log('[Admin] Reject response:', response);

        setSaints((previousSaints) =>
          previousSaints.filter((item) => item.id !== saint.id)
        );

        await fetchData();

        if (Platform.OS === 'web') {
          window.alert('Saint rejected successfully.');
        } else {
          Alert.alert('Success', 'Saint rejected successfully.');
        }
      } catch (error: any) {
        console.error('[Admin] Reject Saint error:', error);

        if (Platform.OS === 'web') {
          window.alert(error?.message || 'Failed to reject Saint');
        } else {
          Alert.alert(
            'Error',
            error?.message || 'Failed to reject Saint'
          );
        }
      } finally {
        setRejectingSaintId(null);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to reject ${
          saint.name || 'this Saint'
        }?\n\nThis Saint will no longer appear to customers.`
      );

      if (confirmed) {
        await rejectSaint();
      }

      return;
    }

    Alert.alert(
      'Reject Saint',
      `Are you sure you want to reject ${
        saint.name || 'this Saint'
      }?\n\nThis Saint will no longer appear to customers.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: rejectSaint,
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const renderStatus = (label: string, value: string) => (
    <View style={styles.statusRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View
        style={[
          styles.statusPill,
          { backgroundColor: `${getStatusColor(value)}18` },
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            { color: getStatusColor(value) },
          ]}
        >
          {value || 'pending'}
        </Text>
      </View>
    </View>
  );

  const renderPoojas = (poojas: any[]) => {
    if (!Array.isArray(poojas) || poojas.length === 0) {
      return <Text style={styles.mutedText}>No poojas listed</Text>;
    }

    return (
      <View style={styles.poojaList}>
        {poojas.map((pooja: any, index: number) => (
          <View key={`${pooja?.name || 'pooja'}-${index}`} style={styles.poojaItem}>
            <Text style={styles.poojaName}>
              {pooja?.name || 'Unnamed Pooja'}
            </Text>
            {pooja?.description ? (
              <Text style={styles.poojaDescription}>
                {pooja.description}
              </Text>
            ) : null}
            <View style={styles.poojaMetaRow}>
              {pooja?.price !== undefined && pooja?.price !== null ? (
                <Text style={styles.poojaMeta}>
                  Price: {formatMoney(pooja.price)}
                </Text>
              ) : null}
              {pooja?.duration ? (
                <Text style={styles.poojaMeta}>
                  Duration: {pooja.duration}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderSaintCard = (saint: any) => {
    const isRejecting = rejectingSaintId === saint.id;

    return (
      <View key={saint.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color="#FF6B35" />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>{saint.name || 'Unknown Saint'}</Text>
            <Text style={styles.cardSubtitle}>
              {saint.location || 'Location not provided'}
            </Text>
          </View>

          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Saint Details</Text>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color="#777" />
            <Text style={styles.detailValue}>
              {saint.location || 'Not provided'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={18} color="#777" />
            <Text style={styles.detailValue}>
              {Array.isArray(saint.operating_areas) &&
              saint.operating_areas.length
                ? saint.operating_areas.join(', ')
                : 'No operating areas listed'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#777" />
            <Text style={styles.detailValue}>
              Automatically active — no approval required
            </Text>
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Poojas Offered</Text>
          {renderPoojas(saint.poojas)}
        </View>

        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectSaint(saint)}
          disabled={isRejecting}
        >
          {isRejecting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={20} color="#FFF" />
              <Text style={styles.rejectButtonText}>Reject Saint</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderBookingCard = (booking: any) => {
    const saintPoojas = Array.isArray(booking.saint_poojas)
      ? booking.saint_poojas
      : [];

    return (
      <View key={booking.id} style={styles.card}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingIcon}>
            <Ionicons name="calendar-outline" size={24} color="#FF6B35" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>
              {booking.pooja_name || 'Pooja Booking'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Booking ID: {booking.id || '—'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionMiniTitle}>Customer Details</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={17} color="#777" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>
                {booking.customer_name || 'Not provided'}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={17} color="#777" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>
                {booking.customer_phone || 'Not provided'}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={17} color="#777" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {booking.customer_email || 'Not provided'}
              </Text>
            </View>
          </View>

          <View style={styles.infoItemFull}>
            <Ionicons name="home-outline" size={17} color="#777" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Booking Address</Text>
              <Text style={styles.infoValue}>
                {booking.address || 'Not provided'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionMiniTitle}>Saint Customer Booked</Text>

        <View style={styles.saintBookingBox}>
          <View style={styles.saintBookingHeader}>
            <View style={styles.smallAvatar}>
              <Ionicons name="person" size={22} color="#FF6B35" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.saintBookingName}>
                {booking.saint_name || 'Saint not found'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {booking.saint_location || 'Location not provided'}
              </Text>
            </View>

            <View
              style={[
                styles.smallStatus,
                {
                  backgroundColor: booking.saint_is_active
                    ? '#E8F5E9'
                    : '#FFEBEE',
                },
              ]}
            >
              <Text
                style={{
                  color: booking.saint_is_active ? '#4CAF50' : '#F44336',
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {booking.saint_is_active ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={18} color="#777" />
            <Text style={styles.detailValue}>
              {booking.saint_phone || 'Phone not provided'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={18} color="#777" />
            <Text style={styles.detailValue}>
              {booking.saint_email || 'Email not provided'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={18} color="#777" />
            <Text style={styles.detailValue}>
              {Array.isArray(booking.saint_operating_areas) &&
              booking.saint_operating_areas.length
                ? booking.saint_operating_areas.join(', ')
                : 'No operating areas listed'}
            </Text>
          </View>

          <Text style={styles.poojaSubheading}>Saint's Poojas</Text>
          {saintPoojas.length > 0 ? (
            renderPoojas(saintPoojas)
          ) : (
            <Text style={styles.mutedText}>No poojas listed</Text>
          )}
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionMiniTitle}>Booking Details</Text>

        <View style={styles.detailRow}>
          <Ionicons name="sparkles-outline" size={18} color="#777" />
          <Text style={styles.detailValue}>
            Pooja: {booking.pooja_name || '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color="#777" />
          <Text style={styles.detailValue}>
            Date: {booking.booking_date || '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color="#777" />
          <Text style={styles.detailValue}>
            Time: {booking.booking_time || '—'}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Base Price</Text>
          <Text style={styles.priceValue}>
            {formatMoney(booking.base_price)}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Platform Commission</Text>
          <Text style={styles.priceValue}>
            {formatMoney(booking.platform_commission)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatMoney(booking.total_price)}
          </Text>
        </View>

        <View style={styles.statusGrid}>
          {renderStatus('Payment', booking.payment_status || 'pending')}
          {renderStatus('Booking', booking.booking_status || 'pending')}
          {renderStatus('Saint Action', booking.saint_action || 'pending')}
        </View>

        <Text style={styles.createdText}>
          Created: {formatDate(booking.created_at)}
        </Text>
      </View>
    );
  };

  const totalSaints = Number(
    analytics?.total_saints ?? saints.length ?? 0
  );
  const activeSaints = Number(
    analytics?.active_saints ?? saints.length ?? 0
  );
  const totalBookings = Number(analytics?.total_bookings ?? allBookings.length);
  const paidBookings = Number(analytics?.paid_bookings ?? 0);
  const revenue = Number(analytics?.revenue ?? 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading Admin Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Manage Saints and view bookings
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#F44336" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons
            name="grid-outline"
            size={18}
            color={activeTab === 'overview' ? '#FF6B35' : '#777'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'overview' && styles.activeTabText,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'saints' && styles.activeTab]}
          onPress={() => setActiveTab('saints')}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === 'saints' ? '#FF6B35' : '#777'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'saints' && styles.activeTabText,
            ]}
          >
            Saints ({activeSaints})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookings' && styles.activeTab]}
          onPress={() => setActiveTab('bookings')}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={activeTab === 'bookings' ? '#FF6B35' : '#777'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'bookings' && styles.activeTabText,
            ]}
          >
            Bookings ({totalBookings})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
      >
        {activeTab === 'overview' && (
          <>
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeIcon}>
                <Ionicons name="shield-checkmark" size={30} color="#FF6B35" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeTitle}>Welcome, Admin</Text>
                <Text style={styles.welcomeText}>
                  Saints are automatically active. You can reject a Saint if
                  needed.
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={26} color="#FF6B35" />
                <Text style={styles.statValue}>{totalSaints}</Text>
                <Text style={styles.statLabel}>Total Saints</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
                <Text style={styles.statValue}>{activeSaints}</Text>
                <Text style={styles.statLabel}>Active Saints</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="calendar" size={26} color="#2196F3" />
                <Text style={styles.statValue}>{totalBookings}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="card" size={26} color="#9C27B0" />
                <Text style={styles.statValue}>{paidBookings}</Text>
                <Text style={styles.statLabel}>Paid Bookings</Text>
              </View>
            </View>

            <View style={styles.revenueCard}>
              <View style={styles.revenueIcon}>
                <Ionicons name="cash-outline" size={28} color="#4CAF50" />
              </View>
              <View>
                <Text style={styles.revenueLabel}>Platform Revenue</Text>
                <Text style={styles.revenueValue}>{formatMoney(revenue)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => setActiveTab('saints')}
            >
              <Ionicons name="people-outline" size={26} color="#FF6B35" />
              <View style={styles.quickText}>
                <Text style={styles.quickTitle}>View Saints</Text>
                <Text style={styles.quickSubtitle}>
                  See all active Saints and reject when necessary
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => setActiveTab('bookings')}
            >
              <Ionicons name="calendar-outline" size={26} color="#2196F3" />
              <View style={styles.quickText}>
                <Text style={styles.quickTitle}>View Bookings</Text>
                <Text style={styles.quickSubtitle}>
                  See customer, Saint, pooja and payment details
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#999" />
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'saints' && (
          <>
            <View style={styles.sectionTop}>
              <View>
                <Text style={styles.pageTitle}>Saints</Text>
                <Text style={styles.pageSubtitle}>
                  {saints.length} active Saint{saints.length === 1 ? '' : 's'}
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{saints.length}</Text>
              </View>
            </View>

            {saints.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={54} color="#CCC" />
                <Text style={styles.emptyTitle}>No active Saints</Text>
                <Text style={styles.emptySubtitle}>
                  New Saints will appear here automatically after creating
                  their profile.
                </Text>
              </View>
            ) : (
              saints.map(renderSaintCard)
            )}
          </>
        )}

        {activeTab === 'bookings' && (
          <>
            <View style={styles.sectionTop}>
              <View>
                <Text style={styles.pageTitle}>All Bookings</Text>
                <Text style={styles.pageSubtitle}>
                  Customer + Saint + booking details
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {allBookings.length}
                </Text>
              </View>
            </View>

            {allBookings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={54} color="#CCC" />
                <Text style={styles.emptyTitle}>No bookings yet</Text>
                <Text style={styles.emptySubtitle}>
                  Customer bookings will appear here.
                </Text>
              </View>
            ) : (
              allBookings.map(renderBookingCard)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#777',
  },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tab: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#FF6B35',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777',
  },
  activeTabText: {
    color: '#FF6B35',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  welcomeCard: {
    backgroundColor: '#FFF5F0',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  welcomeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  welcomeText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  statValue: {
    marginTop: 8,
    fontSize: 25,
    fontWeight: '800',
    color: '#333',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },
  revenueCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 2,
  },
  revenueIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueLabel: {
    color: '#777',
    fontSize: 13,
  },
  revenueValue: {
    color: '#333',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 3,
  },
  quickCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 2,
  },
  quickText: {
    flex: 1,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  quickSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  sectionTop: {
    marginHorizontal: 16,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },
  countBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0E9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countBadgeText: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  smallAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  bookingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  activeBadgeText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '800',
  },
  detailSection: {
    marginTop: 18,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 12,
    color: '#777',
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#444',
  },
  poojaList: {
    gap: 8,
  },
  poojaItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  poojaName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  poojaDescription: {
    fontSize: 12,
    color: '#777',
    lineHeight: 17,
    marginTop: 3,
  },
  poojaMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  poojaMeta: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  rejectButton: {
    marginTop: 18,
    backgroundColor: '#F44336',
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  rejectButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 16,
  },
  sectionMiniTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333',
    marginBottom: 10,
  },
  infoGrid: {
    gap: 11,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  infoItemFull: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
  },
  infoValue: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
    lineHeight: 18,
  },
  saintBookingBox: {
    backgroundColor: '#FFF9F5',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#FFE1D2',
  },
  saintBookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  saintBookingName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
  },
  smallStatus: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
  },
  poojaSubheading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginTop: 14,
    marginBottom: 7,
  },
  mutedText: {
    color: '#999',
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceLabel: {
    color: '#777',
    fontSize: 13,
  },
  priceValue: {
    color: '#444',
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#333',
    fontSize: 15,
    fontWeight: '800',
  },
  totalValue: {
    color: '#FF6B35',
    fontSize: 18,
    fontWeight: '800',
  },
  statusGrid: {
    marginTop: 14,
    gap: 7,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  createdText: {
    color: '#999',
    fontSize: 11,
    marginTop: 14,
  },
  emptyCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#555',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#777',
    fontSize: 14,
  },
});
