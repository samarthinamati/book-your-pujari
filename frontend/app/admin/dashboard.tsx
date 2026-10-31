// frontend/app/admin/dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
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
  const [storeOrders, setStoreOrders] = useState<any[]>([]);
  const [sellerApplications, setSellerApplications] = useState<any[]>([]);
  const [loadingSellerApplications, setLoadingSellerApplications] = useState(false);
  const [reviewingSellerId, setReviewingSellerId] = useState<string | null>(null);
  const [sellerPickupEdits, setSellerPickupEdits] = useState<Record<string, string>>({});
  const [trackingEdits, setTrackingEdits] = useState<Record<string, {
  courier: string;
  tracking_number: string;
  tracking_url: string;
}>>({});
const [loadingStoreOrders, setLoadingStoreOrders] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
 const [storeView, setStoreView] = useState<'menu' | 'addProduct' | 'orders' | 'sellerApplications' | 'manageProducts'>('menu');
const [productName, setProductName] = useState('');
const [productDescription, setProductDescription] = useState('');
const [productCategory, setProductCategory] = useState('Puja Samagri');
const [productPrice, setProductPrice] = useState('');
const [productImageUrl, setProductImageUrl] = useState('');
const [productStock, setProductStock] = useState('');
const [productWeight, setProductWeight] = useState('');
const [savingProduct, setSavingProduct] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showAdminSection, setShowAdminSection] = useState<
  'store' | 'pujaris' | null
>(null);
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

const fetchStoreOrders = async () => {
  try {
    setLoadingStoreOrders(true);

    const response = await apiClient.request('/store/admin/orders');

    setStoreOrders(Array.isArray(response) ? response : []);
  } catch (error: any) {
    Alert.alert(
      'Error',
      error?.message || 'Unable to load store orders.'
    );
  } finally {
    setLoadingStoreOrders(false);
  }
};
  const fetchSellerApplications = async () => {
  try {
    setLoadingSellerApplications(true);

    const response = await apiClient.request(
      '/store/admin/seller-applications'
    );

    setSellerApplications(Array.isArray(response) ? response : []);
  } catch (error: any) {
    Alert.alert(
      'Error',
      error?.message || 'Unable to load seller applications.'
    );
  } finally {
    setLoadingSellerApplications(false);
  }
};
  const handleReviewSeller = async (
  application: any,
  approved: boolean
) => {
  const applicationId = String(
    application.id || application._id || ''
  );

  if (!applicationId) {
    Alert.alert('Error', 'Seller application ID is missing.');
    return;
  }

  const action = approved ? 'approve' : 'reject';

  try {
    setReviewingSellerId(applicationId);

    await apiClient.put(
      `/store/admin/seller-applications/${applicationId}`,
      { approved }
    );

    Alert.alert(
      'Success',
      approved
        ? 'Seller application approved successfully.'
        : 'Seller application rejected successfully.'
    );

    await fetchSellerApplications();
  } catch (error: any) {
    Alert.alert(
      'Error',
      error?.message || `Could not ${action} seller application.`
    );
  } finally {
    setReviewingSellerId(null);
  }
};
  const updateSellerPickupLocation = async (
  application: any,
  pickupName: string
) => {
  const applicationId = String(
    application.id || application._id || ''
  );

  if (!applicationId || !pickupName.trim()) {
    Alert.alert('Error', 'Enter a valid pickup location name.');
    return;
  }

  try {
    setReviewingSellerId(applicationId);

    await apiClient.put(
      `/store/admin/seller-applications/${applicationId}/pickup-location`,
      {
        delhivery_pickup_name: pickupName.trim(),
      }
    );

    Alert.alert('Success', 'Pickup location updated.');
    await fetchSellerApplications();
  } catch (error: any) {
    Alert.alert(
      'Error',
      error?.message || 'Could not update pickup location.'
    );
  } finally {
    setReviewingSellerId(null);
  }
};
const saveStoreProduct = async () => {
  const name = productName.trim();
  const price = Number(productPrice);
  const stock = Number(productStock);
  const weight = Number(productWeight);

  if (!name || name.length < 2) {
    Alert.alert('Error', 'Enter a product name with at least 2 characters.');
    return;
  }

  if (!productPrice.trim() || !Number.isFinite(price) || price <= 0) {
    Alert.alert('Error', 'Enter a valid product price.');
    return;
  }

  if (
    !productStock.trim() ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    Alert.alert('Error', 'Enter a valid stock quantity.');
    return;
  }
  if (
  !productWeight.trim() ||
  !Number.isInteger(weight) ||
  weight <= 0 ||
  weight > 100000
) {
  Alert.alert('Error', 'Enter a valid product weight in grams.');
  return;
}

  setSavingProduct(true);

  try {
    await apiClient.request('/store/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: productDescription.trim(),
        category: productCategory.trim() || 'Puja Samagri',
        price,
        image_url: productImageUrl.trim(),
        stock,
        weight_grams: weight,
        is_available: stock > 0,
      }),
    });

    Alert.alert('Success', 'Product added successfully!');

    setProductName('');
    setProductDescription('');
    setProductCategory('Puja Samagri');
    setProductPrice('');
    setProductImageUrl('');
    setProductStock('');
    setProductWeight('');
    setShowAddProduct(false);
  } catch (error: any) {
    Alert.alert(
      'Error',
      error?.message || 'Could not add product.'
    );
  } finally {
    setSavingProduct(false);
  }
};


const updateStoreOrderTracking = async (
  order: any,
  orderStatus: string
) => {
  const orderId = String(order.id || order._id || '');
  const tracking = trackingEdits[orderId] || {
  courier: order.courier || 'Dehlivery',
  tracking_number: order.tracking_number || '',
  tracking_url: order.tracking_url || '',
};

  if (!orderId) {
    Alert.alert('Error', 'Order ID is missing.');
    return;
  }

  try {
    await apiClient.put(
      `/store/admin/orders/${orderId}/tracking`,
      {
        order_status: orderStatus,
        courier: tracking.courier,
tracking_number: tracking.tracking_number,
tracking_url: tracking.tracking_url,
      }
    );


    await fetchStoreOrders();
    Alert.alert('Success', 'Order status updated.');
  } catch (error: any) {
    Alert.alert(
      'Error',
      error?.message || 'Could not update order status.'
    );
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
       
    {showAdminSection === null && (
      <View style={{ padding: 16, gap: 16 }}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => {
  setShowAdminSection('store');
  setStoreView('menu');
  setShowAddProduct(false);
}}
          activeOpacity={0.8}
        >
          <Ionicons name="cart-outline" size={28} color="#FF9800" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#222' }}>
              Manage Store
            </Text>
            <Text style={{ color: '#666', marginTop: 4 }}>
              Products, orders, sellers and delivery
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#888" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => setShowAdminSection('pujaris')}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={28} color="#4CAF50" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#222' }}>
              Manage Bookings
            </Text>
            <Text style={{ color: '#666', marginTop: 4 }}>
              Pujaris, customer bookings and payments
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#888" />
        </TouchableOpacity>
      </View>
    )}
      
{showAdminSection === 'store' && (
  <>
    <TouchableOpacity
      onPress={() => setShowAdminSection(null)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#FFF',
      }}
    >
      <Ionicons name="arrow-back" size={22} color="#FF6B35" />
      <Text style={{ marginLeft: 8, fontWeight: 'bold', color: '#333' }}>
        Back to Admin Menu
      </Text>
    </TouchableOpacity>

    <ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={{
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  }}
  keyboardShouldPersistTaps="handled"
>
      {storeView === 'menu' && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 2, color: '#222' }}>
            Manage Store
          </Text>
          <Text style={{ color: '#666', marginBottom: 8 }}>
            Products, orders, sellers and delivery
          </Text>

          <TouchableOpacity
            onPress={() => { setStoreView('addProduct'); setShowAddProduct(true); }}
            style={{ backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="add-circle-outline" size={25} color="#FFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Add New Product</Text>
              <Text style={{ color: '#E8F5E9', marginTop: 3 }}>Add product photos, prices and stock</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStoreView('manageProducts')}
            style={{ backgroundColor: '#5E35B1', padding: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="pricetags-outline" size={25} color="#FFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Manage Products</Text>
              <Text style={{ color: '#EDE7F6', marginTop: 3 }}>Edit products, stock and availability</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setStoreView('orders'); fetchStoreOrders(); }}
            style={{ backgroundColor: '#2874F0', padding: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="receipt-outline" size={25} color="#FFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Store Orders</Text>
              <Text style={{ color: '#EAF1FF', marginTop: 3 }}>View orders, customers and payment status</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setStoreView('orders'); fetchStoreOrders(); }}
            style={{ backgroundColor: '#00838F', padding: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="navigate-outline" size={25} color="#FFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Delivery & Tracking</Text>
              <Text style={{ color: '#E0F7FA', marginTop: 3 }}>Seller pickup, customer address and Delhivery tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
           onPress={() => {
  setStoreView('sellerApplications');
  fetchSellerApplications();
}}
            style={{ backgroundColor: '#EF6C00', padding: 16, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="people-outline" size={25} color="#FFF" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Seller Applications</Text>
              <Text style={{ color: '#FFF3E0', marginTop: 3 }}>Approve sellers and manage pickup locations</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {storeView === 'addProduct' && (
        <>
          <TouchableOpacity onPress={() => { setStoreView('menu'); setShowAddProduct(false); }} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Ionicons name="arrow-back" size={22} color="#FF6B35" />
            <Text style={{ marginLeft: 8, color: '#333', fontWeight: 'bold' }}>Back to Store Menu</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#222' }}>Add New Product</Text>
        </>
      )}
      {storeView === 'orders' && (
        <>
          <TouchableOpacity onPress={() => setStoreView('menu')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Ionicons name="arrow-back" size={22} color="#FF6B35" />
            <Text style={{ marginLeft: 8, color: '#333', fontWeight: 'bold' }}>Back to Store Menu</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#222' }}>Store Orders</Text>
        </>
      )}

   {storeView === 'sellerApplications' && (
  <View style={{ gap: 14, marginBottom: 20 }}>
    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#222' }}>
      Seller Applications
    </Text>

    <TouchableOpacity
      onPress={fetchSellerApplications}
      style={{
        backgroundColor: '#2874F0',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
        Refresh Applications
      </Text>
    </TouchableOpacity>

    {loadingSellerApplications ? (
      <ActivityIndicator size="large" color="#2874F0" />
    ) : sellerApplications.length === 0 ? (
      <Text style={{ color: '#666', textAlign: 'center', marginTop: 15 }}>
        No seller applications found.
      </Text>
    ) : (
      sellerApplications.map((application: any, index: number) => {
        const applicationId = String(
          application.id || application._id || index
        );
        const isReviewing = reviewingSellerId === applicationId;

        return (
          <View
            key={applicationId}
            style={{
              backgroundColor: '#FFF',
              padding: 15,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#DDD',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: 'bold' }}>
              {application.shop_name || 'Unnamed Shop'}
            </Text>

            <Text>Owner: {application.owner_name || '-'}</Text>
            <Text>Phone: {application.phone || '-'}</Text>
            <Text>Email: {application.email || '-'}</Text>
            <Text>Address: {application.shop_address || '-'}</Text>
            <Text>
              City: {application.city || '-'} - {application.pincode || '-'}
            </Text>

            <Text style={{ fontWeight: 'bold' }}>
              Status: {application.status || 'pending'}
            </Text>

            {String(application.status || '').toLowerCase() === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  disabled={isReviewing}
                  onPress={() => handleReviewSeller(application, true)}
                  style={{
                    flex: 1,
                    backgroundColor: '#2E7D32',
                    padding: 12,
                    borderRadius: 7,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                    Approve
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isReviewing}
                  onPress={() => handleReviewSeller(application, false)}
                  style={{
                    flex: 1,
                    backgroundColor: '#C62828',
                    padding: 12,
                    borderRadius: 7,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                    Reject
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={{ fontWeight: 'bold', marginTop: 8 }}>
              Delhivery Pickup Location
            </Text>

            <Text>
              Current pickup name: {application.delhivery_pickup_name || 'Not set'}
            </Text>

            <TextInput
              placeholder="Enter pickup location name"
              value={
                sellerPickupEdits[applicationId] ??
                application.delhivery_pickup_name ??
                ''
              }
              onChangeText={(value) =>
                setSellerPickupEdits((previous) => ({
                  ...previous,
                  [applicationId]: value,
                }))
              }
              style={productInputStyle}
            />

            <TouchableOpacity
              disabled={isReviewing}
              onPress={() =>
                updateSellerPickupLocation(
                  application,
                  sellerPickupEdits[applicationId] ??
                    application.delhivery_pickup_name ??
                    ''
                )
              }
              style={{
                backgroundColor: '#2874F0',
                padding: 12,
                borderRadius: 7,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                Save Pickup Location
              </Text>
            </TouchableOpacity>

            <Text style={{ color: '#666', fontSize: 12 }}>
              Pickup registration status: {application.delhivery_pickup_status || 'Not registered'}
            </Text>
          </View>
        );
      })
    )}
  </View>
)}
{storeView === 'addProduct' && showAddProduct && (
  <View
    style={{
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#DDDDDD',
      marginBottom: 20,
      gap: 12,
    }}
  >
    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#222' }}>
      Add New Puja Product
    </Text>

    <TextInput
      placeholder="Product name *"
      value={productName}
      onChangeText={setProductName}
      style={productInputStyle}
    />

    <TextInput
  placeholder="Description"
  value={productDescription}
  onChangeText={setProductDescription}
  multiline
  scrollEnabled={false}
  style={[
    productInputStyle,
    {
      minHeight: 45,
      maxHeight: 120,
      height: Math.min(
        45 + productDescription.split('\n').length * 20,
        120
      ),
      textAlignVertical: 'top',
    },
  ]}
/>
    <TextInput
      placeholder="Category (e.g. Puja Samagri)"
      value={productCategory}
      onChangeText={setProductCategory}
      style={productInputStyle}
    />

    <TextInput
      placeholder="Price in ₹ *"
      value={productPrice}
      onChangeText={setProductPrice}
      keyboardType="decimal-pad"
      style={productInputStyle}
    />

    <TouchableOpacity
  onPress={async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow gallery access to choose a product photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setProductImageUrl(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open your photo gallery.');
    }
  }}
  style={{
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#E0A040',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  }}
>
  <Text style={{ color: '#8A4B08', fontWeight: 'bold' }}>
    📷 Choose Product Photo from Gallery
  </Text>
</TouchableOpacity>

{productImageUrl ? (
  <View style={{ alignItems: 'center', gap: 8 }}>
    <Image
      source={{ uri: productImageUrl }}
      style={{
        width: 160,
        height: 160,
        borderRadius: 10,
        backgroundColor: '#EEEEEE',
      }}
      resizeMode="cover"
    />

    <TouchableOpacity
      onPress={() => setProductImageUrl('')}
    >
      <Text style={{ color: '#C62828', fontWeight: 'bold' }}>
        Remove Photo
      </Text>
    </TouchableOpacity>
  </View>
) : null}
    <TextInput
placeholder="Enter weight in grams"
  value={productWeight}
  onChangeText={setProductWeight}
  keyboardType="number-pad"
  style={productInputStyle}
/>

<TextInput
  placeholder="Enter Stock quantity"
  value={productStock}
  onChangeText={setProductStock}
  keyboardType="number-pad"
  style={productInputStyle}
/>

    <TouchableOpacity
      disabled={savingProduct}
      onPress={saveStoreProduct}
      style={{
        backgroundColor: savingProduct ? '#999999' : '#2E7D32',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
        {savingProduct ? 'Saving Product...' : 'Save Product'}
      </Text>
    </TouchableOpacity>
  </View>
)}

      {storeView === 'orders' && (
        <>
      {loadingStoreOrders ? (
        <ActivityIndicator size="large" color="#FF6B35" />
      ) : storeOrders.length === 0 ? (
        <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>
          No store orders found.
        </Text>
      ) : (
        storeOrders.map((order: any, index: number) => (
          <View
            key={String(order.id || order._id || index)}
            style={{
              backgroundColor: '#FFF',
              padding: 14,
              marginBottom: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#EEE',
            }}
          >
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
              Order #{String(order.id || order._id || index + 1)}
            </Text>

<Text style={{ marginTop: 6 }}>
  Customer: {order.customer_name || 'Not provided'}
</Text>

<Text>
  Phone: {order.customer_phone || 'Not provided'}
</Text>

<Text>
  Address: {order.delivery_address || 'Not provided'}
</Text>

<Text>
  City: {order.city || '-'} - {order.pincode || '-'}
</Text>

<Text>
  Payment: {order.payment_status || 'Pending'}
</Text>

<Text style={{ fontWeight: 'bold', marginTop: 6 }}>
  Items:
</Text>

{Array.isArray(order.items) &&
  order.items.map((item: any, itemIndex: number) => (
    <Text key={String(item.product_id || itemIndex)}>
      • {item.name || item.product_name || 'Puja item'} × {item.quantity || 1}
    </Text>
  ))}

            <Text style={{ marginTop: 6 }}>
              Status: {order.order_status || 'Order Placed'}
            </Text>

            <Text>
              Amount: ₹{Number(order.total_amount ?? order.amount ?? 0).toFixed(2)}
            </Text>

            
<Text style={{ marginTop: 8, fontWeight: 'bold' }}>
  Courier Name
</Text>
<TextInput
  placeholder="Enter courier name (e.g. DTDC)"
  value={
    trackingEdits[String(order.id || order._id || '')]?.courier
    ?? order.courier
    ?? 'DTDC'
  }
  onChangeText={(value) => {
    const orderId = String(order.id || order._id || '');

    setTrackingEdits((previous) => ({
      ...previous,
      [orderId]: {
        courier: value,
        tracking_number:
          previous[orderId]?.tracking_number ?? order.tracking_number ?? '',
        tracking_url:
          previous[orderId]?.tracking_url ?? order.tracking_url ?? '',
      },
    }));
  }}
  style={productInputStyle}
/>

<Text style={{ marginTop: 8, fontWeight: 'bold' }}>
  Tracking ID / AWB Number
</Text>
<TextInput
  placeholder="Enter tracking ID"
  value={
    trackingEdits[String(order.id || order._id || '')]?.tracking_number
    ?? order.tracking_number
    ?? ''
  }
  onChangeText={(value) => {
    const orderId = String(order.id || order._id || '');

    setTrackingEdits((previous) => ({
      ...previous,
      [orderId]: {
        courier:
          previous[orderId]?.courier ?? order.courier ?? 'DTDC',
        tracking_number: value,
        tracking_url:
          previous[orderId]?.tracking_url ?? order.tracking_url ?? '',
      },
    }));
  }}
  style={productInputStyle}
/>

<Text style={{ marginTop: 8, fontWeight: 'bold' }}>
  Tracking URL
</Text>
<TextInput
  placeholder="Paste courier tracking link"
  value={
    trackingEdits[String(order.id || order._id || '')]?.tracking_url
    ?? order.tracking_url
    ?? ''
  }
  onChangeText={(value) => {
    const orderId = String(order.id || order._id || '');

    setTrackingEdits((previous) => ({
      ...previous,
      [orderId]: {
        courier:
          previous[orderId]?.courier ?? order.courier ?? 'DTDC',
        tracking_number:
          previous[orderId]?.tracking_number ?? order.tracking_number ?? '',
        tracking_url: value,
      },
    }));
  }}
  autoCapitalize="none"
  keyboardType="url"
  style={productInputStyle}
/>

            
{order.tracking_url ? (
  <TouchableOpacity
    onPress={() => {
      if (Platform.OS === 'web') {
        window.open(order.tracking_url, '_blank');
      } else {
        Alert.alert(
          'Tracking URL',
          order.tracking_url
        );
      }
    }}
    style={{
      backgroundColor: '#E8F5E9',
      padding: 10,
      borderRadius: 6,
      marginTop: 8,
    }}
  >
    <Text style={{ color: '#2E7D32', fontWeight: 'bold' }}>
      View Tracking Link
    </Text>
  </TouchableOpacity>
) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
  {[
    'Preparing',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
  ].map((status) => (
    <TouchableOpacity
      key={status}
      onPress={() => updateStoreOrderTracking(order, status)}
      style={{
        backgroundColor:
          order.order_status === status ? '#2E7D32' : '#FF6B35',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
      }}
    >
      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>
        {status}
      </Text>
    </TouchableOpacity>
  ))}
</View>
    <TouchableOpacity
  onPress={() =>
    updateStoreOrderTracking(order, order.order_status || 'Shipped')
  }
  style={{
    backgroundColor: '#2874F0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  }}
>
  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
    Save Tracking Details
  </Text>
</TouchableOpacity>

          </View>
        ))
      )}
      
      
      <TouchableOpacity
        onPress={fetchStoreOrders}
        style={{
          backgroundColor: '#FF6B35',
          padding: 14,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
          Refresh Orders
        </Text>
      </TouchableOpacity>
        </>
      )}
    </ScrollView>
  </>
)}

    {showAdminSection === 'pujaris' && (
      <>
      <TouchableOpacity
        onPress={() => setShowAdminSection(null)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          backgroundColor: '#FFF',
        }}
      >
        <Ionicons name="arrow-back" size={22} color="#FF6B35" />
        <Text style={{ marginLeft: 8, fontWeight: 'bold', color: '#333' }}>
          Back to Admin Menu
        </Text>
      </TouchableOpacity>

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
              </>
    )}
    </SafeAreaView>
  );
}
const productInputStyle = {
  borderWidth: 1,
  borderColor: '#CCCCCC',
  borderRadius: 8,
  padding: 12,
  fontSize: 15,
  color: '#222222',
  backgroundColor: '#FFFFFF',
};
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
  paddingBottom: 100,
  flexGrow: 1,
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
