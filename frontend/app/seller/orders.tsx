
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import * as Print from 'expo-print';

type OrderItem = {
  name: string;
  quantity: number;
  line_total: number;
};

type SellerParcel = {
  weight_grams?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  ready_for_pickup?: boolean;
  ready_at?: string;
};

type ParcelInput = {
  weight_grams: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
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
  seller_parcel?: SellerParcel;
};

const emptyParcel: ParcelInput = {
  weight_grams: '',
  length_cm: '',
  width_cm: '',
  height_cm: '',
};

export default function SellerOrdersScreen() {
  const router = useRouter();

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [parcelInputs, setParcelInputs] = useState<
    Record<string, ParcelInput>
  >({});
  const [selectedLabelOrder, setSelectedLabelOrder] =
    useState<SellerOrder | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingParcelId, setSavingParcelId] = useState('');
  const [readyOrderId, setReadyOrderId] = useState('');
  
const [confirmReadyOrder, setConfirmReadyOrder] =
  useState<SellerOrder | null>(null);

const [actionMessage, setActionMessage] = useState('');


  const loadOrders = useCallback(async () => {
    try {
      const response = await apiClient.get('/store/seller/orders');
      const loadedOrders = Array.isArray(response)
        ? response
        : Array.isArray(response?.orders)
        ? response.orders
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.orders)
        ? response.data.orders
        : [];

      setOrders(loadedOrders);

      const inputs: Record<string, ParcelInput> = {};

      loadedOrders.forEach((order: SellerOrder) => {
        const parcel = order.seller_parcel || {};

        inputs[order.id] = {
          weight_grams: parcel.weight_grams
            ? String(parcel.weight_grams)
            : '',
          length_cm: parcel.length_cm
            ? String(parcel.length_cm)
            : '',
          width_cm: parcel.width_cm
            ? String(parcel.width_cm)
            : '',
          height_cm: parcel.height_cm
            ? String(parcel.height_cm)
            : '',
        };
      });

      setParcelInputs(inputs);
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

    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleString();
  };

  const updateParcelInput = (
    orderId: string,
    field: keyof ParcelInput,
    value: string
  ) => {
    setParcelInputs((previous) => ({
      ...previous,
      [orderId]: {
        ...(previous[orderId] || emptyParcel),
        [field]: value,
      },
    }));
  };

  const saveParcelDetails = async (order: SellerOrder) => {
    const input = parcelInputs[order.id] || emptyParcel;

    const weight = Number(input.weight_grams);
    const length = Number(input.length_cm);
    const width = Number(input.width_cm);
    const height = Number(input.height_cm);

    if (
      !input.weight_grams.trim() ||
      !input.length_cm.trim() ||
      !input.width_cm.trim() ||
      !input.height_cm.trim()
    ) {
      Alert.alert(
        'Missing parcel details',
        'Please enter weight, length, width and height.'
      );
      return;
    }

    if (
      !Number.isInteger(weight) ||
      weight < 1 ||
      weight > 50000 ||
      !Number.isFinite(length) ||
      length <= 0 ||
      length > 200 ||
      !Number.isFinite(width) ||
      width <= 0 ||
      width > 200 ||
      !Number.isFinite(height) ||
      height <= 0 ||
      height > 200
    ) {
      Alert.alert(
        'Invalid parcel details',
        'Weight must be 1–50000 grams. Each dimension must be greater than 0 and no more than 200 cm.'
      );
      return;
    }

    try {
      setSavingParcelId(order.id);

      await apiClient.put(
        '/store/seller/orders/' + order.id + '/parcel',
        {
          weight_grams: weight,
          length_cm: length,
          width_cm: width,
          height_cm: height,
        }
      );

      Alert.alert(
        'Saved successfully',
        'Your parcel details have been saved.'
      );

      await loadOrders();
    } catch (error: any) {
      Alert.alert(
        'Unable to save parcel',
        error?.message || 'Please try again.'
      );
    } finally {
      setSavingParcelId('');
    }
  };

 
const markReadyForPickup = (order: SellerOrder) => {
  const parcel = order.seller_parcel;

  if (
    !parcel?.weight_grams ||
    !parcel?.length_cm ||
    !parcel?.width_cm ||
    !parcel?.height_cm
  ) {
    setActionMessage('Please save parcel details first.');
    return;
  }

  setActionMessage('');
  setConfirmReadyOrder(order);
};

const confirmMarkReady = async () => {
  if (!confirmReadyOrder) return;

  const order = confirmReadyOrder;

  try {
    setReadyOrderId(order.id);
    setActionMessage('');

    await apiClient.post(
      '/store/seller/orders/' + order.id + '/ready-for-pickup',
      {}
    );

    setConfirmReadyOrder(null);
    setActionMessage('Order successfully marked as Ready for Pickup!');

    await loadOrders();
  } catch (error: any) {
    setActionMessage(
      error?.response?.data?.detail ||
      error?.message ||
      'Unable to update order. Please try again.'
    );
  } finally {
    setReadyOrderId('');
  }
};

  const printShippingLabel = async (order: SellerOrder) => {
    try {
      const escapeHtml = (value: any) =>
        String(value || '').replace(/[&<>"']/g, (char) => {
          const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          };

          return entities[char] || char;
        });

      const itemsHtml = (order.items || [])
        .map((item) => {
          return (
            '<tr>' +
            '<td>' + escapeHtml(item.name) + '</td>' +
            '<td>' + Number(item.quantity || 0) + '</td>' +
            '</tr>'
          );
        })
        .join('');

      const html =
        '<!DOCTYPE html>' +
        '<html><head>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
        '<style>' +
        'body{font-family:Arial,sans-serif;padding:18px;color:#172B4D;}' +
        '.label{border:2px solid #222;padding:20px;max-width:500px;margin:auto;}' +
        '.brand{font-size:25px;font-weight:bold;text-align:center;}' +
        '.heading{text-align:center;font-size:17px;margin:12px 0;font-weight:bold;}' +
        '.section{border-top:1px solid #777;padding:12px 0;}' +
        '.order{font-size:16px;font-weight:bold;}' +
        '.address{font-size:17px;line-height:1.6;}' +
        'table{width:100%;border-collapse:collapse;}' +
        'th,td{border:1px solid #999;padding:8px;text-align:left;}' +
        '.tracking{font-weight:bold;overflow-wrap:anywhere;}' +
        '.footer{text-align:center;margin-top:15px;font-weight:bold;}' +
        '</style></head><body>' +
        '<div class="label">' +
        '<div class="brand">PUJARIGO</div>' +
        '<div class="heading">SHIP TO</div>' +
        '<div class="section"><div class="order">Order #' +
        escapeHtml(String(order.id).slice(-8)) +
        '</div></div>' +
        '<div class="section address">' +
        '<strong>' + escapeHtml(order.customer_name || 'Customer') + '</strong><br/>' +
        escapeHtml(order.delivery_address) + '<br/>' +
        escapeHtml(order.city) + ' - ' + escapeHtml(order.pincode) + '<br/>' +
        'Phone: ' + escapeHtml(order.customer_phone) +
        '</div>' +
        '<div class="section"><strong>Items in this parcel</strong>' +
        '<table><tr><th>Product</th><th>Qty</th></tr>' +
        itemsHtml +
        '</table></div>' +
        '<div class="section">Courier: ' +
        escapeHtml(order.courier || 'Not assigned') +
        '<br/><span class="tracking">AWB / Tracking: ' +
        escapeHtml(order.tracking_number || 'Not assigned') +
        '</span></div>' +
        '<div class="footer">Thank you for shopping with PujariGo</div>' +
        '</div></body></html>';

      await Print.printAsync({ html });
    } catch (error: any) {
      Alert.alert(
        'Print Error',
        error?.message || 'Unable to print shipping label.'
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#2874F0"
          style={{ marginTop: 50 }}
        />
        <Text style={styles.loadingText}>
          Loading your orders...
        </Text>
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
          Manage your shop orders and prepare parcels for collection.
        </Text>
        
{actionMessage ? (
  <View style={styles.savedParcel}>
    <Text style={styles.savedParcelText}>
      {actionMessage}
    </Text>
  </View>
) : null}


        <View style={styles.summaryCard}>
          <Ionicons name="receipt-outline" size={28} color="#2874F0" />
          <View style={{ marginLeft: 13 }}>
            <Text style={styles.summaryNumber}>{orders.length}</Text>
            <Text style={styles.summaryLabel}>Orders found</Text>
          </View>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="bag-outline"
              size={48}
              color="#98A2B3"
            />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Orders containing your products will appear here.
            </Text>
          </View>
        ) : (
          orders.map((order, index) => {
            const parcel = order.seller_parcel || {};
            const input = parcelInputs[order.id] || emptyParcel;
            const isReady = parcel.ready_for_pickup === true;
            const shipmentStarted = Boolean(order.tracking_number);

            return (
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
                  <View
                    key={`${item.name}-${itemIndex}`}
                    style={styles.itemRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>
                        {item.name}
                      </Text>
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
                  <Text style={styles.totalLabel}>
                    Your item total
                  </Text>
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

                <View style={styles.parcelSection}>
                  <Text style={styles.parcelTitle}>
                    <Ionicons
                      name="cube-outline"
                      size={18}
                      color="#2874F0"
                    />{' '}
                    Parcel Preparation
                  </Text>

                  <Text style={styles.parcelHint}>
                    Enter the final packed parcel measurements.
                  </Text>

                  <Text style={styles.inputLabel}>Weight (grams)</Text>
                  <TextInput
                    style={styles.parcelInput}
                    value={input.weight_grams}
                    onChangeText={(value) =>
                      updateParcelInput(order.id, 'weight_grams', value)
                    }
                    placeholder="Example: 750"
                    keyboardType="numeric"
                    editable={!shipmentStarted && !isReady}
                  />

                  <Text style={styles.inputLabel}>Length (cm)</Text>
                  <TextInput
                    style={styles.parcelInput}
                    value={input.length_cm}
                    onChangeText={(value) =>
                      updateParcelInput(order.id, 'length_cm', value)
                    }
                    placeholder="Example: 20"
                    keyboardType="decimal-pad"
                    editable={!shipmentStarted && !isReady}
                  />

                  <Text style={styles.inputLabel}>Width (cm)</Text>
                  <TextInput
                    style={styles.parcelInput}
                    value={input.width_cm}
                    onChangeText={(value) =>
                      updateParcelInput(order.id, 'width_cm', value)
                    }
                    placeholder="Example: 15"
                    keyboardType="decimal-pad"
                    editable={!shipmentStarted && !isReady}
                  />

                  <Text style={styles.inputLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.parcelInput}
                    value={input.height_cm}
                    onChangeText={(value) =>
                      updateParcelInput(order.id, 'height_cm', value)
                    }
                    placeholder="Example: 10"
                    keyboardType="decimal-pad"
                    editable={!shipmentStarted && !isReady}
                  />

                  {parcel.weight_grams ? (
                    <View style={styles.savedParcel}>
                      <Text style={styles.savedParcelText}>
                        Saved: {parcel.weight_grams} g
                        {'  '}|{'  '}
                        {parcel.length_cm} × {parcel.width_cm} × {parcel.height_cm} cm
                      </Text>
                    </View>
                  ) : null}

                  {!shipmentStarted && !isReady ? (
                    <TouchableOpacity
                      style={[
                        styles.saveParcelButton,
                        savingParcelId === order.id && styles.disabledButton,
                      ]}
                      onPress={() => saveParcelDetails(order)}
                      disabled={savingParcelId === order.id}
                    >
                      {savingParcelId === order.id ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons
                            name="save-outline"
                            size={19}
                            color="#FFFFFF"
                          />
                          <Text style={styles.buttonText}>
                            Save Parcel Details
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {isReady ? (
                    <View style={styles.readyBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color="#16803D"
                      />
                      <Text style={styles.readyText}>
                        Ready for Pickup
                      </Text>
                    </View>
                  ) : null}

                  {!isReady && !shipmentStarted && parcel.weight_grams ? (
                    <TouchableOpacity
                      style={[
                        styles.readyButton,
                        readyOrderId === order.id && styles.disabledButton,
                      ]}
                      onPress={() => markReadyForPickup(order)}
                      disabled={readyOrderId === order.id}
                    >
                      {readyOrderId === order.id ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-done-outline"
                            size={20}
                            color="#FFFFFF"
                          />
                          <Text style={styles.buttonText}>
                            Ready for Pickup
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {shipmentStarted ? (
                    <Text style={styles.shipmentStartedText}>
                      Shipment tracking is already assigned. Parcel details are locked.
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.printLabelButton}
                  onPress={() => setSelectedLabelOrder(order)}
                >
                  <Ionicons
                    name="eye-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.printLabelText}>View Label</Text>
                </TouchableOpacity>

                <Text style={styles.noticeText}>
                 Courier shipment creation and pickup scheduling depend on
                 your Delhivery live-shipping settings. Test mode does not
                 book a real courier pickup. Check the shipment status and
                 tracking details before dispatch.
                 </Text>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            loadOrders();
          }}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh-outline"
            size={20}
            color="#2874F0"
          />
          <Text style={styles.refreshText}>Refresh Orders</Text>
        </TouchableOpacity>
      </ScrollView>

<Modal
  visible={confirmReadyOrder !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setConfirmReadyOrder(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.labelModal}>
      <Text style={styles.modalTitle}>
        Confirm Ready for Pickup
      </Text>

      <Text style={{ marginTop: 12, color: '#667085', lineHeight: 22 }}>
        Have you packed this order and prepared it for courier collection?
      </Text>

      <TouchableOpacity
        style={styles.readyButton}
        onPress={confirmMarkReady}
        disabled={readyOrderId !== ''}
      >
        {readyOrderId !== '' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Yes, Ready</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => setConfirmReadyOrder(null)}
        disabled={readyOrderId !== ''}
      >
        <Text style={styles.refreshText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>


      <Modal
        visible={selectedLabelOrder !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLabelOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.labelModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Shipping Label Preview
              </Text>

              <TouchableOpacity
                onPress={() => setSelectedLabelOrder(null)}
              >
                <Ionicons
                  name="close-circle"
                  size={28}
                  color="#667085"
                />
              </TouchableOpacity>
            </View>

            {selectedLabelOrder && (
              <ScrollView>
                <View style={styles.shippingLabel}>
                  <Text style={styles.labelBrand}>PUJARIGO</Text>
                  <Text style={styles.labelHeading}>SHIP TO</Text>

                  <View style={styles.labelDivider} />

                  <Text style={styles.labelOrder}>
                    Order #{selectedLabelOrder.id}
                  </Text>

                  <Text style={styles.labelCustomer}>
                    {selectedLabelOrder.customer_name || 'Customer'}
                  </Text>

                  <Text style={styles.labelAddress}>
                    {selectedLabelOrder.delivery_address || 'Address unavailable'}
                  </Text>

                  <Text style={styles.labelAddress}>
                    {selectedLabelOrder.city || ''} - {selectedLabelOrder.pincode || ''}
                  </Text>

                  <Text style={styles.labelAddress}>
                    Phone: {selectedLabelOrder.customer_phone || 'N/A'}
                  </Text>

                  <View style={styles.labelDivider} />

                  <Text style={styles.labelSection}>
                    PRODUCTS IN THIS PARCEL
                  </Text>

                  {(selectedLabelOrder.items || []).map((item, index) => (
                    <View
                      key={`${item.name}-${index}`}
                      style={styles.labelItem}
                    >
                      <Text style={styles.labelItemName}>
                        {item.name}
                      </Text>
                      <Text style={styles.labelItemQty}>
                        Qty: {item.quantity}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.labelDivider} />

                  <Text style={styles.labelAddress}>
                    Courier: {selectedLabelOrder.courier || 'Not assigned'}
                  </Text>

                  <Text style={styles.labelAddress}>
                    AWB / Tracking: {selectedLabelOrder.tracking_number || 'Not assigned'}
                  </Text>

                  <Text style={styles.labelFooter}>
                    Thank you for shopping with PujariGo
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.printLabelButton}
                  onPress={() => printShippingLabel(selectedLabelOrder)}
                >
                  <Ionicons
                    name="print-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.printLabelText}>
                    Print Shipping Label
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#667085',
    fontSize: 14,
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
  parcelSection: {
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D8E6FF',
    borderRadius: 12,
    padding: 13,
    marginTop: 17,
  },
  parcelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  parcelHint: {
    fontSize: 12,
    color: '#667085',
    marginTop: 6,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#344054',
    marginTop: 9,
    marginBottom: 5,
  },
  parcelInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#172B4D',
  },
  savedParcel: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  savedParcelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16803D',
  },
  saveParcelButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2874F0',
    padding: 13,
    borderRadius: 9,
    marginTop: 14,
  },
  readyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16803D',
    padding: 13,
    borderRadius: 9,
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 9,
    marginTop: 13,
  },
  readyText: {
    color: '#16803D',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  shipmentStartedText: {
    color: '#667085',
    fontSize: 12,
    marginTop: 12,
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
  printLabelButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2874F0',
    padding: 13,
    borderRadius: 9,
    marginTop: 14,
  },
  printLabelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginTop: 5,
  },
  refreshText: {
    color: '#2874F0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 15,
  },
  labelModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  shippingLabel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#222222',
    padding: 16,
  },
  labelBrand: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#172B4D',
    textAlign: 'center',
  },
  labelHeading: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#172B4D',
    textAlign: 'center',
    marginVertical: 12,
  },
  labelDivider: {
    height: 1,
    backgroundColor: '#777777',
    marginVertical: 12,
  },
  labelOrder: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 10,
  },
  labelCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 5,
  },
  labelAddress: {
    fontSize: 14,
    lineHeight: 22,
    color: '#344054',
  },
  labelSection: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#172B4D',
    marginBottom: 10,
  },
  labelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  labelItemName: {
    flex: 1,
    fontSize: 13,
    color: '#344054',
  },
  labelItemQty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginLeft: 10,
  },
  labelFooter: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#172B4D',
    marginTop: 18,
  },
});
