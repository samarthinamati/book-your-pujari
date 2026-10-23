
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

type OrderItem = {
  name: string;
  quantity: number;
  line_total: number;
};

type SellerOrder = {
  id: string;
  order_status?: string;
  payment_status?: string;
  items?: OrderItem[];
  seller_total?: number;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  city?: string;
  pincode?: string;
  courier?: string;
  tracking_number?: string;
  tracking_url?: string;
};

export default function SellerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const response = await apiClient.get('/store/seller/orders');
      setOrders(Array.isArray(response) ? response : []);
    } catch (error: any) {
      Alert.alert(
        'Unable to load orders',
        error?.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const formatDate = (value?: string) => {
    if (!value) return 'Date unavailable';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';

    return date.toLocaleString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#2874F0"
          style={{ marginTop: 50 }}
        />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrders();
            }}
          />
        }
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#172B4D" />
          <Text style={styles.backText}>Seller Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>
          Orders containing products from your shop.
        </Text>

        <View style={styles.summaryCard}>
          <Ionicons name="receipt-outline" size={28} color="#2874F0" />
          <View style={{ marginLeft: 13 }}>
            <Text style={styles.summaryNumber}>{orders.length}</Text>
            <Text style={styles.summaryLabel}>Orders found</Text>
          </View>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bag-outline" size={48} color="#98A2B3" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Orders containing your products will appear here.
            </Text>
          </View>
        ) : (
          orders.map((order, index) => (
            <View
              key={order.id || `order-${index}`}
              style={styles.orderCard}
            >
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderTitle}>
                    Order #{String(order.id || '').slice(-8) || 'Unknown'}
                  </Text>
                  <Text style={styles.orderDate}>
                    {formatDate(order.created_at)}
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    {order.order_status || 'Status unavailable'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Your items</Text>

              {(order.items || []).map((item, itemIndex) => (
                <View key={`${item.name}-${itemIndex}`} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>
                      Quantity: {item.quantity}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    ₹{Number(item.line_total || 0).toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Your item total</Text>
                <Text style={styles.totalAmount}>
                  ₹{Number(order.seller_total || 0).toFixed(2)}
                </Text>
              </View>

              {order.payment_status ? (
                <Text style={styles.detailText}>
                  Payment: {order.payment_status}
                </Text>
              ) : null}

              {order.courier ? (
                <Text style={styles.detailText}>
                  Courier: {order.courier}
                </Text>
              ) : null}

              {order.tracking_number ? (
                <Text style={styles.detailText}>
                  Tracking number: {order.tracking_number}
                </Text>
              ) : null}

              <Text style={styles.noticeText}>
                For customer delivery details and shipment updates, use the
                approved seller order workflow. Do not change the status of a
                mixed-seller order until separate seller shipments are supported.
              </Text>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            loadOrders();
          }}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={20} color="#2874F0" />
          <Text style={styles.refreshText}>Refresh Orders</Text>
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
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  title: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    marginTop: 6,
    marginBottom: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    marginBottom: 20,
  },
  summaryNumber: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#667085',
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#344054',
    marginTop: 13,
  },
  emptyText: {
    fontSize: 13,
    color: '#667085',
    marginTop: 7,
    textAlign: 'center',
    lineHeight: 19,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 16,
    marginBottom: 15,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  orderDate: {
    fontSize: 12,
    color: '#667085',
    marginTop: 5,
  },
  statusBadge: {
    backgroundColor: '#EAF2FF',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    maxWidth: '48%',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2874F0',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAECF0',
    marginVertical: 15,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#172B4D',
    marginLeft: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
    paddingTop: 14,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#16803D',
  },
  detailText: {
    fontSize: 12,
    color: '#667085',
    marginTop: 8,
  },
  noticeText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8A5A00',
    backgroundColor: '#FFF4D6',
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
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
