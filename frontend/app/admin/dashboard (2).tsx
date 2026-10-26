// frontend/app/admin/dashboard.tsx
// Clean PujariGo admin dashboard: overview, pujaris/bookings, store products and orders.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/client';

type Tab = 'overview' | 'saints' | 'bookings';
type AdminSection = 'store' | 'pujaris' | null;
type StoreView = 'menu' | 'addProduct' | 'orders';

const ORANGE = '#FF6B35';
const BLUE = '#2874F0';
const GREEN = '#2E7D32';

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

const formatMoney = (value: unknown) => {
  const number = Number(value ?? 0);
  return `₹${Number.isFinite(number) ? number.toFixed(0) : '0'}`;
};

const getStatusColor = (status = '') => {
  const normalized = status.toLowerCase();
  if (['paid', 'confirmed', 'accepted', 'delivered'].includes(normalized)) {
    return '#2E7D32';
  }
  if (['rejected', 'cancelled', 'failed'].includes(normalized)) {
    return '#C62828';
  }
  return '#EF6C00';
};

const showMessage = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();

  const [analytics, setAnalytics] = useState<any>(null);
  const [saints, setSaints] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [storeOrders, setStoreOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [rejectingSaintId, setRejectingSaintId] = useState<string | null>(null);

  const [section, setSection] = useState<AdminSection>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [storeView, setStoreView] = useState<StoreView>('menu');

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productCategory, setProductCategory] = useState('Puja Samagri');
  const [productPrice, setProductPrice] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [productStock, setProductStock] = useState('10');

  const fetchData = useCallback(async () => {
    try {
      const [analyticsData, saintsData, bookingsData] = await Promise.all([
        apiClient.get('/admin/analytics'),
        apiClient.get('/admin/saints/pending'),
        apiClient.get('/admin/bookings'),
      ]);
      setAnalytics(analyticsData);
      setSaints(Array.isArray(saintsData) ? saintsData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (error: any) {
      console.error('[Admin] fetchData error:', error);
      showMessage('Unable to load dashboard', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchStoreOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await apiClient.request('/store/admin/orders');
      setStoreOrders(Array.isArray(response) ? response : []);
    } catch (error: any) {
      showMessage('Store orders', error?.message || 'Unable to load store orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const chooseProductPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showMessage('Gallery permission needed', 'Please allow photo-library access to select a product photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setProductImageUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[Admin] photo picker error:', error);
      showMessage('Photo picker', 'Could not open your photo gallery.');
    }
  };

  const saveStoreProduct = async () => {
    const name = productName.trim();
    const price = Number(productPrice);
    const stock = Number(productStock);

    if (name.length < 2) {
      showMessage('Check product name', 'Enter a product name with at least 2 characters.');
      return;
    }
    if (!productPrice.trim() || !Number.isFinite(price) || price <= 0) {
      showMessage('Check price', 'Enter a valid price greater than zero.');
      return;
    }
    if (!productStock.trim() || !Number.isInteger(stock) || stock < 0) {
      showMessage('Check stock', 'Enter a whole-number stock quantity of zero or more.');
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
          is_available: stock > 0,
        }),
      });

      showMessage(
        'Product saved',
        productImageUrl.startsWith('file:') || productImageUrl.startsWith('content:')
          ? 'The product was sent to the server. Note: a gallery URI may not be viewable by customers until the image is uploaded to a public URL.'
          : 'Product added successfully.',
      );
      setProductName('');
      setProductDescription('');
      setProductCategory('Puja Samagri');
      setProductPrice('');
      setProductImageUrl('');
      setProductStock('10');
      setStoreView('menu');
    } catch (error: any) {
      showMessage('Could not add product', error?.message || 'Please try again.');
    } finally {
      setSavingProduct(false);
    }
  };

  const updateStoreOrderTracking = async (order: any, orderStatus: string) => {
    const orderId = String(order.id || order._id || '');
    if (!orderId) {
      showMessage('Missing order ID', 'This order has no ID, so its status cannot be updated.');
      return;
    }
    try {
      await apiClient.put(`/store/admin/orders/${orderId}/tracking`, {
        order_status: orderStatus,
        courier: order.courier || 'DTDC',
        tracking_number: order.tracking_number || '',
        tracking_url: order.tracking_url || '',
      });
      await fetchStoreOrders();
      showMessage('Order updated', `Order status changed to ${orderStatus}.`);
    } catch (error: any) {
      showMessage('Update failed', error?.message || 'Could not update order status.');
    }
  };

  const handleRejectSaint = async (saint: any) => {
    const saintId = String(saint?.id || saint?._id || '');
    if (!saintId) {
      showMessage('Missing Saint ID', 'This profile does not contain a Saint ID.');
      return;
    }

    const reject = async () => {
      setRejectingSaintId(saintId);
      try {
        await apiClient.post('/admin/saints/approve', {
          saint_id: saintId,
          approved: false,
        });
        setSaints((current) =>
          current.filter((item) => String(item.id || item._id) !== saintId),
        );
        await fetchData();
        showMessage('Saint rejected', 'The Saint was rejected successfully.');
      } catch (error: any) {
        showMessage('Rejection failed', error?.message || 'Failed to reject this Saint.');
      } finally {
        setRejectingSaintId(null);
      }
    };

    const message = `Reject ${saint.name || 'this Saint'}? This profile may no longer appear to customers.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) await reject();
    } else {
      Alert.alert('Reject Saint', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: reject },
      ]);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to log out?')) return;
      await logout();
      router.replace('/auth/login');
      return;
    }

    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const totalSaints = Number(analytics?.total_saints ?? saints.length);
  const activeSaints = Number(analytics?.active_saints ?? saints.length);
  const totalBookings = Number(analytics?.total_bookings ?? bookings.length);
  const paidBookings = Number(analytics?.paid_bookings ?? 0);
  const revenue = Number(analytics?.revenue ?? 0);

  const renderStatus = (label: string, value?: string) => {
    const status = value || 'pending';
    const color = getStatusColor(status);
    return (
      <View style={styles.statusRow} key={label}>
        <Text style={styles.mutedLabel}>{label}</Text>
        <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.statusText, { color }]}>{status}</Text>
        </View>
      </View>
    );
  };

  const renderPoojas = (poojas: any[]) => {
    if (!Array.isArray(poojas) || poojas.length === 0) {
      return <Text style={styles.mutedText}>No poojas listed.</Text>;
    }
    return (
      <View style={styles.poojaList}>
        {poojas.map((pooja, index) => (
          <View key={`${pooja?.name || 'pooja'}-${index}`} style={styles.poojaItem}>
            <Text style={styles.poojaName}>{pooja?.name || 'Unnamed Pooja'}</Text>
            {!!pooja?.description && <Text style={styles.mutedText}>{pooja.description}</Text>}
            <View style={styles.inlineWrap}>
              {pooja?.price != null && <Text style={styles.smallAccent}>Price: {formatMoney(pooja.price)}</Text>}
              {!!pooja?.duration && <Text style={styles.smallAccent}>Duration: {pooja.duration}</Text>}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderSaintCard = (saint: any) => {
    const id = String(saint.id || saint._id || saint.name || Math.random());
    const rejecting = rejectingSaintId === String(saint.id || saint._id || '');
    return (
      <View key={id} style={styles.card}>
        <View style={styles.personHeader}>
          <View style={styles.avatar}><Ionicons name="person" size={25} color={ORANGE} /></View>
          <View style={styles.flexOne}>
            <Text style={styles.cardTitle}>{saint.name || 'Unknown Pujari'}</Text>
            <Text style={styles.mutedText}>{saint.location || 'Location not provided'}</Text>
          </View>
        </View>
        <Text style={styles.sectionLabel}>Profile details</Text>
        <Detail icon="location-outline" text={saint.location || 'Location not provided'} />
        <Detail
          icon="navigate-outline"
          text={Array.isArray(saint.operating_areas) && saint.operating_areas.length
            ? saint.operating_areas.join(', ')
            : 'No operating areas listed'}
        />
        <Text style={styles.sectionLabel}>Poojas offered</Text>
        {renderPoojas(saint.poojas)}
        <TouchableOpacity
          style={[styles.dangerButton, rejecting && styles.disabledButton]}
          disabled={rejecting}
          onPress={() => handleRejectSaint(saint)}
        >
          {rejecting ? <ActivityIndicator color="#FFF" /> : <Ionicons name="close-circle-outline" size={19} color="#FFF" />}
          <Text style={styles.buttonText}>{rejecting ? 'Rejecting…' : 'Reject Pujari'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderBookingCard = (booking: any, index: number) => {
    const id = String(booking.id || booking._id || index);
    const saintPoojas = Array.isArray(booking.saint_poojas) ? booking.saint_poojas : [];
    return (
      <View key={id} style={styles.card}>
        <View style={styles.personHeader}>
          <View style={styles.iconTile}><Ionicons name="calendar-outline" size={23} color={ORANGE} /></View>
          <View style={styles.flexOne}>
            <Text style={styles.cardTitle}>{booking.pooja_name || 'Pooja Booking'}</Text>
            <Text style={styles.mutedText}>Booking ID: {booking.id || booking._id || '—'}</Text>
          </View>
        </View>
        <Text style={styles.sectionLabel}>Customer</Text>
        <Detail icon="person-outline" text={booking.customer_name || 'Name not provided'} />
        <Detail icon="call-outline" text={booking.customer_phone || 'Phone not provided'} />
        <Detail icon="mail-outline" text={booking.customer_email || 'Email not provided'} />
        <Detail icon="home-outline" text={booking.address || 'Address not provided'} />
        <View style={styles.separator} />
        <Text style={styles.sectionLabel}>Pujari</Text>
        <Detail icon="person-circle-outline" text={booking.saint_name || 'Pujari not found'} />
        <Detail icon="location-outline" text={booking.saint_location || 'Location not provided'} />
        <Detail icon="call-outline" text={booking.saint_phone || 'Phone not provided'} />
        <Detail icon="mail-outline" text={booking.saint_email || 'Email not provided'} />
        {!!booking.saint_operating_areas?.length && (
          <Detail icon="navigate-outline" text={booking.saint_operating_areas.join(', ')} />
        )}
        {saintPoojas.length > 0 && renderPoojas(saintPoojas)}
        <View style={styles.separator} />
        <Text style={styles.sectionLabel}>Booking details</Text>
        <Detail icon="sparkles-outline" text={`Pooja: ${booking.pooja_name || '—'}`} />
        <Detail icon="calendar-outline" text={`Date: ${booking.booking_date || '—'}`} />
        <Detail icon="time-outline" text={`Time: ${booking.booking_time || '—'}`} />
        <PriceRow label="Base price" value={formatMoney(booking.base_price)} />
        <PriceRow label="Platform commission" value={formatMoney(booking.platform_commission)} />
        <PriceRow label="Total" value={formatMoney(booking.total_price)} bold />
        <View style={styles.statusGroup}>
          {renderStatus('Payment', booking.payment_status)}
          {renderStatus('Booking', booking.booking_status)}
          {renderStatus('Pujari action', booking.saint_action)}
        </View>
        <Text style={styles.footnote}>Created: {formatDate(booking.created_at)}</Text>
      </View>
    );
  };

  const renderStoreMenuItem = (
    title: string,
    subtitle: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    onPress: () => void,
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={25} color={color} />
      </View>
      <View style={styles.flexOne}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={21} color="#9AA0A6" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loadingText}>Loading PujariGo Admin…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.flexOne}>
          <Text style={styles.brand}>PujariGo</Text>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Manage your services and store</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={22} color="#C62828" />
        </TouchableOpacity>
      </View>

      {section === null && (
        <ScrollView
          contentContainerStyle={styles.menuContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        >
          <Text style={styles.welcomeHeading}>Welcome, Admin</Text>
          <Text style={styles.welcomeSubheading}>Choose what you want to manage.</Text>
          {renderStoreMenuItem('Manage Store', 'Products, orders and delivery tracking', 'cart-outline', BLUE, () => {
            setSection('store');
            setStoreView('menu');
          })}
          {renderStoreMenuItem('Manage Pujaris & Bookings', 'Profiles, bookings and payment details', 'people-outline', GREEN, () => {
            setSection('pujaris');
            setTab('overview');
          })}
          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={20} color={BLUE} />
            <Text style={styles.tipText}>Pull down to refresh dashboard data.</Text>
          </View>
        </ScrollView>
      )}

      {section === 'store' && (
        <ScrollView contentContainerStyle={styles.pageContent}>
          <BackButton label="Back to Admin Menu" onPress={() => setSection(null)} />
          {storeView === 'menu' && (
            <>
              <Text style={styles.pageTitle}>Manage Store</Text>
              <Text style={styles.pageSubtitle}>Puja Samagri products and customer orders</Text>
              {renderStoreMenuItem('Add New Product', 'Add product details, photo, price and stock', 'add-circle-outline', GREEN, () => setStoreView('addProduct'))}
              {renderStoreMenuItem('Store Orders', 'View customer details and update order status', 'receipt-outline', BLUE, () => {
                setStoreView('orders');
                fetchStoreOrders();
              })}
              {renderStoreMenuItem('Delivery & Tracking', 'View orders and update courier tracking details', 'navigate-outline', '#00838F', () => {
                setStoreView('orders');
                fetchStoreOrders();
              })}
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={20} color="#8A4B08" />
                <Text style={styles.noticeText}>Product editing, hide/show controls and seller applications need dedicated API endpoints/screens; they are not included in this file.</Text>
              </View>
            </>
          )}

          {storeView === 'addProduct' && (
            <>
              <BackButton label="Back to Store Menu" onPress={() => setStoreView('menu')} />
              <Text style={styles.pageTitle}>Add New Product</Text>
              <Text style={styles.pageSubtitle}>Fields marked * are required.</Text>
              <View style={styles.formCard}>
                <TextInput
                  placeholder="Product name *"
                  value={productName}
                  onChangeText={setProductName}
                  style={styles.input}
                  maxLength={100}
                />
                <TextInput
                  placeholder="Description"
                  value={productDescription}
                  onChangeText={setProductDescription}
                  style={[styles.input, styles.multilineInput]}
                  multiline
                />
                <TextInput
                  placeholder="Category (e.g. Puja Samagri)"
                  value={productCategory}
                  onChangeText={setProductCategory}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Price in ₹ *"
                  value={productPrice}
                  onChangeText={setProductPrice}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.photoButton} onPress={chooseProductPhoto}>
                  <Ionicons name="images-outline" size={21} color="#8A4B08" />
                  <Text style={styles.photoButtonText}>Choose Product Photo</Text>
                </TouchableOpacity>
                {productImageUrl ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: productImageUrl }} style={styles.imagePreview} resizeMode="cover" />
                    <TouchableOpacity onPress={() => setProductImageUrl('')} style={styles.removePhoto}>
                      <Ionicons name="trash-outline" size={16} color="#C62828" />
                      <Text style={styles.removePhotoText}>Remove photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.helperText}>Choose a square product photo from your gallery.</Text>
                )}
                <TextInput
                  placeholder="Stock quantity *"
                  value={productStock}
                  onChangeText={setProductStock}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={[styles.primaryButton, savingProduct && styles.disabledButton]}
                  disabled={savingProduct}
                  onPress={saveStoreProduct}
                >
                  {savingProduct ? <ActivityIndicator color="#FFF" /> : <Ionicons name="save-outline" size={20} color="#FFF" />}
                  <Text style={styles.buttonText}>{savingProduct ? 'Saving…' : 'Save Product'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {storeView === 'orders' && (
            <>
              <View style={styles.titleRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.pageTitle}>Store Orders</Text>
                  <Text style={styles.pageSubtitle}>{storeOrders.length} order(s)</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={fetchStoreOrders}>
                  <Ionicons name="refresh-outline" size={18} color={BLUE} />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
              {loadingOrders ? (
                <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 28 }} />
              ) : storeOrders.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="receipt-outline" size={45} color="#C5C9CE" />
                  <Text style={styles.emptyTitle}>No store orders found</Text>
                  <Text style={styles.mutedText}>Orders will appear here after customers place them.</Text>
                </View>
              ) : storeOrders.map((order, index) => (
                <View key={String(order.id || order._id || index)} style={styles.card}>
                  <Text style={styles.cardTitle}>Order #{String(order.id || order._id || index + 1)}</Text>
                  <Text style={styles.orderAmount}>{formatMoney(order.total_amount ?? order.amount)}</Text>
                  <View style={styles.separator} />
                  <Text style={styles.sectionLabel}>Customer details</Text>
                  <Detail icon="person-outline" text={order.customer_name || 'Name not provided'} />
                  <Detail icon="call-outline" text={order.customer_phone || 'Phone not provided'} />
                  <Detail icon="home-outline" text={order.delivery_address || order.address || 'Address not provided'} />
                  <Detail icon="location-outline" text={`${order.city || 'City not provided'} · ${order.pincode || 'PIN not provided'}`} />
                  <View style={styles.statusGroup}>
                    {renderStatus('Payment', order.payment_status || 'pending')}
                    {renderStatus('Order', order.order_status || 'Order Placed')}
                  </View>
                  <Text style={styles.sectionLabel}>Items</Text>
                  {Array.isArray(order.items) && order.items.length ? order.items.map((item: any, itemIndex: number) => (
                    <Text key={String(item.product_id || itemIndex)} style={styles.orderItem}>
                      • {item.name || item.product_name || 'Puja item'} × {item.quantity || 1}
                    </Text>
                  )) : <Text style={styles.mutedText}>No item details supplied.</Text>}
                  <Text style={styles.sectionLabel}>Delivery tracking</Text>
                  <Detail icon="cube-outline" text={`Courier: ${order.courier || 'Not assigned'}`} />
                  <Detail icon="barcode-outline" text={`Tracking number: ${order.tracking_number || 'Not added'}`} />
                  {!!order.tracking_url && (
                    <TouchableOpacity
                      style={styles.trackButton}
                      onPress={() => {
                        if (Platform.OS === 'web') window.open(order.tracking_url, '_blank', 'noopener,noreferrer');
                        else showMessage('Tracking link', order.tracking_url);
                      }}
                    >
                      <Ionicons name="open-outline" size={17} color={GREEN} />
                      <Text style={styles.trackButtonText}>Open tracking link</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.sectionLabel}>Update status</Text>
                  <View style={styles.statusButtons}>
                    {['Preparing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[styles.statusButton, order.order_status === status && styles.statusButtonActive]}
                        onPress={() => updateStoreOrderTracking(order, status)}
                      >
                        <Text style={[styles.statusButtonText, order.order_status === status && styles.statusButtonTextActive]}>{status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {section === 'pujaris' && (
        <>
          <View style={styles.sectionHeader}>
            <BackButton label="Back to Admin Menu" onPress={() => setSection(null)} />
          </View>
          <View style={styles.tabs}>
            {([
              ['overview', 'grid-outline', 'Overview'],
              ['saints', 'people-outline', `Pujaris (${activeSaints})`],
              ['bookings', 'calendar-outline', `Bookings (${totalBookings})`],
            ] as [Tab, keyof typeof Ionicons.glyphMap, string][]).map(([key, icon, label]) => (
              <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.activeTab]} onPress={() => setTab(key)}>
                <Ionicons name={icon} size={17} color={tab === key ? ORANGE : '#777'} />
                <Text style={[styles.tabText, tab === key && styles.activeTabText]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView
            style={styles.flexOne}
            contentContainerStyle={styles.pageContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          >
            {tab === 'overview' && (
              <>
                <Text style={styles.pageTitle}>Overview</Text>
                <Text style={styles.pageSubtitle}>A quick view of PujariGo activity</Text>
                <View style={styles.statsGrid}>
                  <StatCard icon="people-outline" color={ORANGE} value={totalSaints} label="Total Pujaris" />
                  <StatCard icon="checkmark-circle-outline" color={GREEN} value={activeSaints} label="Active Pujaris" />
                  <StatCard icon="calendar-outline" color={BLUE} value={totalBookings} label="Bookings" />
                  <StatCard icon="card-outline" color="#7E57C2" value={paidBookings} label="Paid bookings" />
                </View>
                <View style={styles.revenueCard}>
                  <View style={styles.menuIcon}><Ionicons name="cash-outline" size={25} color={GREEN} /></View>
                  <View>
                    <Text style={styles.mutedText}>Platform revenue</Text>
                    <Text style={styles.revenueValue}>{formatMoney(revenue)}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.menuItem} onPress={() => setTab('saints')}>
                  <View style={styles.menuIcon}><Ionicons name="people-outline" size={24} color={ORANGE} /></View>
                  <View style={styles.flexOne}><Text style={styles.menuTitle}>Manage Pujaris</Text><Text style={styles.menuSubtitle}>View profiles and reject a profile if necessary</Text></View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setTab('bookings')}>
                  <View style={styles.menuIcon}><Ionicons name="calendar-outline" size={24} color={BLUE} /></View>
                  <View style={styles.flexOne}><Text style={styles.menuTitle}>View Bookings</Text><Text style={styles.menuSubtitle}>Customer, Pujari, payment and booking details</Text></View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              </>
            )}
            {tab === 'saints' && (
              <>
                <Text style={styles.pageTitle}>Pujaris</Text>
                <Text style={styles.pageSubtitle}>{saints.length} profile(s) returned by the pending endpoint</Text>
                {saints.length === 0 ? (
                  <EmptyState icon="people-outline" title="No Pujaris found" subtitle="No profiles were returned by the admin pending endpoint." />
                ) : saints.map(renderSaintCard)}
              </>
            )}
            {tab === 'bookings' && (
              <>
                <Text style={styles.pageTitle}>All Bookings</Text>
                <Text style={styles.pageSubtitle}>{bookings.length} booking(s)</Text>
                {bookings.length === 0 ? (
                  <EmptyState icon="calendar-outline" title="No bookings yet" subtitle="Customer bookings will appear here." />
                ) : bookings.map(renderBookingCard)}
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function Detail({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={17} color="#7A818A" />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

function PriceRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, bold && styles.priceLabelBold]}>{label}</Text>
      <Text style={[styles.priceValue, bold && styles.priceValueBold]}>{value}</Text>
    </View>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress}>
      <Ionicons name="arrow-back" size={20} color={ORANGE} />
      <Text style={styles.backButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  icon, color, value, label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({
  icon, title, subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={46} color="#C5C9CE" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  flexOne: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E9EDF2',
  },
  brand: { color: ORANGE, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { color: '#20242A', fontSize: 23, fontWeight: '800', marginTop: 2 },
  headerSubtitle: { color: '#777F89', fontSize: 12, marginTop: 3 },
  logoutButton: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF0EE',
    alignItems: 'center', justifyContent: 'center',
  },
  menuContent: { padding: 18, paddingBottom: 36 },
  welcomeHeading: { color: '#20242A', fontSize: 25, fontWeight: '800', marginTop: 8 },
  welcomeSubheading: { color: '#777F89', fontSize: 14, marginTop: 5, marginBottom: 20 },
  pageContent: { padding: 16, paddingBottom: 44 },
  pageTitle: { color: '#20242A', fontSize: 23, fontWeight: '800', marginTop: 4 },
  pageSubtitle: { color: '#777F89', fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 17 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12, marginBottom: 10 },
  backButtonText: { color: '#343A40', fontSize: 13, fontWeight: '700', marginLeft: 7 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 15, padding: 15, marginBottom: 12, borderWidth: 1,
    borderColor: '#E9EDF2', gap: 12,
  },
  menuIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F8' },
  menuTitle: { color: '#242930', fontSize: 15, fontWeight: '800' },
  menuSubtitle: { color: '#777F89', fontSize: 12, lineHeight: 17, marginTop: 4 },
  tipBox: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, backgroundColor: '#EAF2FF', borderRadius: 12, marginTop: 8 },
  tipText: { color: '#355782', fontSize: 12, flex: 1 },
  noticeBox: { flexDirection: 'row', gap: 9, padding: 13, backgroundColor: '#FFF5E5', borderRadius: 12, marginTop: 8 },
  noticeText: { flex: 1, color: '#79501A', fontSize: 12, lineHeight: 18 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E9EDF2', gap: 12 },
  input: { width: '100%', minHeight: 46, borderWidth: 1, borderColor: '#D9DEE5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: '#222831', backgroundColor: '#FFFFFF', fontSize: 14 },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  photoButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#E5B56A', backgroundColor: '#FFF6E8', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  photoButtonText: { color: '#8A4B08', fontWeight: '800', fontSize: 13 },
  imagePreviewWrap: { alignItems: 'center', gap: 8, paddingVertical: 5 },
  imagePreview: { width: 170, height: 170, borderRadius: 12, backgroundColor: '#F0F2F4' },
  removePhoto: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
  removePhotoText: { color: '#C62828', fontWeight: '700', fontSize: 12 },
  helperText: { color: '#858C95', fontSize: 12 },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  disabledButton: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#D7E5FF', backgroundColor: '#FFFFFF', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  refreshText: { color: BLUE, fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 15, marginBottom: 13, borderWidth: 1, borderColor: '#E9EDF2' },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF1EB', alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF1EB', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#252A31', fontSize: 16, fontWeight: '800' },
  sectionLabel: { color: '#333A43', fontSize: 13, fontWeight: '800', marginTop: 13, marginBottom: 7 },
  mutedText: { color: '#7B838D', fontSize: 12, lineHeight: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 7 },
  detailText: { color: '#505862', fontSize: 13, lineHeight: 19, flex: 1 },
  separator: { height: 1, backgroundColor: '#EDF0F3', marginVertical: 13 },
  poojaList: { gap: 8, marginTop: 4 },
  poojaItem: { backgroundColor: '#F8F9FB', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#EEF0F3', gap: 4 },
  poojaName: { color: '#303640', fontSize: 13, fontWeight: '800' },
  inlineWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 3 },
  smallAccent: { color: ORANGE, fontSize: 11, fontWeight: '700' },
  dangerButton: { backgroundColor: '#C62828', minHeight: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E9EDF2' },
  tab: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: ORANGE },
  tabText: { color: '#777F89', fontSize: 11, fontWeight: '700' },
  activeTabText: { color: ORANGE },
  sectionHeader: { paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { flexGrow: 1, flexBasis: '44%', minWidth: 130, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E9EDF2' },
  statValue: { color: '#252A31', fontSize: 25, fontWeight: '800', marginTop: 7 },
  statLabel: { color: '#777F89', fontSize: 11, marginTop: 4, textAlign: 'center' },
  revenueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#E9EDF2', marginBottom: 14 },
  revenueValue: { color: '#252A31', fontSize: 24, fontWeight: '800', marginTop: 3 },
  statusGroup: { gap: 8, marginTop: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  mutedLabel: { color: '#777F89', fontSize: 12 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '65%' },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  priceLabel: { color: '#777F89', fontSize: 12 },
  priceValue: { color: '#444B54', fontSize: 12, fontWeight: '600' },
  priceLabelBold: { color: '#252A31', fontWeight: '800' },
  priceValueBold: { color: ORANGE, fontSize: 15, fontWeight: '800' },
  footnote: { color: '#959CA5', fontSize: 11, marginTop: 13 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, padding: 28, marginTop: 8, borderWidth: 1, borderColor: '#E9EDF2', gap: 8 },
  emptyTitle: { color: '#454C55', fontSize: 15, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  emptySubtitle: { color: '#858C95', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  orderAmount: { color: GREEN, fontSize: 18, fontWeight: '800', marginTop: 5 },
  orderItem: { color: '#505862', fontSize: 13, lineHeight: 20, marginTop: 3 },
  trackButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: '#EAF5EC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, marginTop: 9 },
  trackButtonText: { color: GREEN, fontSize: 12, fontWeight: '800' },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  statusButton: { borderWidth: 1, borderColor: '#D9DEE5', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8 },
  statusButtonActive: { borderColor: GREEN, backgroundColor: GREEN },
  statusButtonText: { color: '#555D67', fontSize: 11, fontWeight: '700' },
  statusButtonTextActive: { color: '#FFFFFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#777F89', fontSize: 13, marginTop: 12 },
});
