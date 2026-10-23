
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

type SellerProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_available: boolean;
};

type SellerOrder = {
  id: string;
  order_status?: string;
  items?: { name: string; quantity: number; line_total: number }[];
  seller_total?: number;
};

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [productResponse, orderResponse] = await Promise.all([
        apiClient.get('/store/seller/products'),
        apiClient.get('/store/seller/orders'),
      ]);

      const productList = Array.isArray(productResponse)
        ? productResponse
        : productResponse?.products ?? [];

      const orderList = Array.isArray(orderResponse)
        ? orderResponse
        : orderResponse?.orders ?? [];

      setProducts(productList);
      setOrders(orderList);
    } catch (error: any) {
      Alert.alert(
        'Unable to load dashboard',
        error?.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const availableProducts = products.filter(
    (product) => product.is_available && product.stock > 0
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#2874F0"
          style={{ marginTop: 50 }}
        />
        <Text style={styles.loadingText}>Loading seller dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="storefront" size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>PujariGo</Text>
            <Text style={styles.subtitle}>Seller Dashboard</Text>
          </View>
        </View>

        <Text style={styles.welcome}>
          Welcome{user?.name ? `, ${user.name}` : ''}!
        </Text>
        <Text style={styles.description}>
          Manage your shop, products and customer orders.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cube-outline" size={26} color="#2874F0" />
            <Text style={styles.statNumber}>{products.length}</Text>
            <Text style={styles.statLabel}>My Products</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={26} color="#16803D" />
            <Text style={styles.statNumber}>{availableProducts.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={26} color="#E67E22" />
            <Text style={styles.statNumber}>{orders.length}</Text>
            <Text style={styles.statLabel}>My Orders</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Manage Your Shop</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/seller/products')}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="pricetags-outline" size={26} color="#2874F0" />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>My Products</Text>
            <Text style={styles.actionDescription}>
              Add products, edit prices, update stock and hide items.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#777" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/seller/orders')}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="receipt-outline" size={26} color="#2874F0" />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>My Orders</Text>
            <Text style={styles.actionDescription}>
              View orders containing your products.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#777" />
        </TouchableOpacity>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={22} color="#8A5A00" />
          <Text style={styles.noticeText}>
            Your products and orders are managed through your seller account.
            New seller accounts must be approved by the administrator.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={20} color="#2874F0" />
          <Text style={styles.refreshText}>Refresh Dashboard</Text>
        </TouchableOpacity>
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
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2874F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  brand: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    marginTop: 3,
  },
  welcome: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  description: {
    color: '#667085',
    fontSize: 14,
    marginTop: 7,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#172B4D',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#667085',
    marginTop: 5,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 16,
    marginBottom: 13,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    marginHorizontal: 13,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  actionDescription: {
    fontSize: 12,
    color: '#667085',
    marginTop: 5,
    lineHeight: 18,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF4D6',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  noticeText: {
    flex: 1,
    marginLeft: 10,
    color: '#6B4E16',
    fontSize: 12,
    lineHeight: 18,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 10,
  },
  refreshText: {
    color: '#2874F0',
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#667085',
  },
});
