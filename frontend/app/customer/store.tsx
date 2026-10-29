

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { openRazorpayCheckout } from '@/src/utils/razorpay';
import { apiClient } from '@/src/api/client';

type Product = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  image_url?: string;
  stock?: number;
  is_available?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type StoreOrder = {
  id: string;
  order_status?: string;
  payment_status?: string;
  payment_method?: string;
  total_amount?: number;
  total?: number;
  amount?: number;
  created_at?: string;
  courier?: string;
  tracking_number?: string;
  tracking_url?: string;
  return_status?: string;
  replacement_status?: string;
  items?: any[];
};

const BLUE = '#2874F0';
const DARK_BLUE = '#1746A2';

const CATEGORY_ICONS: Record<string, string> = {
  all: '🛍️',
  'puja samagri': '🪔',
  'puja kit': '🙏',
  'puja kits': '🙏',
  diya: '🪔',
  diyas: '🪔',
  incense: '🕯️',
  flowers: '🌼',
  idols: '🛕',
  'pooja items': '🪷',
  default: '📿',
};

const getOrderId = (order: any): string =>
  String(order?.id || order?.order_id || order?._id || '');

const getOrderTotal = (order: StoreOrder): number =>
  Number(order.total_amount ?? order.total ?? order.amount ?? 0);

export default function CustomerStoreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCart, setShowCart] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [ordersError, setOrdersError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const loadProducts = useCallback(async () => {
    setError('');

    try {
      const result = await apiClient.get('/store/products');
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.products)
          ? result.products
          : [];

      setProducts(
        list.map((item: any) => ({
          ...item,
          id: String(item.id || item._id || item.product_id || ''),
        })).filter((item: Product) => Boolean(item.id))
      );
    } catch (e: any) {
      setError(e?.message || 'Could not load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError('');

    try {
      const result = await apiClient.get('/store/orders/my-orders');
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.orders)
          ? result.orders
          : [];

      setOrders(
        list.map((order: any) => ({
          ...order,
          id: getOrderId(order),
        })).filter((order: StoreOrder) => Boolean(order.id))
      );
    } catch (e: any) {
      setOrdersError(
        e?.message ||
          'Could not load your orders. Please try again.'
      );
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => {
    const names = products
      .map((product) => product.category?.trim())
      .filter((name): name is string => Boolean(name));

    return ['All', ...Array.from(new Set(names))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === 'All' ||
        product.category?.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const cartItems = Object.values(cart);

  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const itemCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const updateQuantity = (product: Product, change: number) => {
    const stock = Number(product.stock ?? 50);

    setCart((previous) => {
      const current = previous[product.id]?.quantity || 0;
      const next = current + change;
      const updated = { ...previous };

      if (next <= 0) {
        delete updated[product.id];
      } else if (next <= Math.min(stock, 50)) {
        updated[product.id] = { product, quantity: next };
      } else {
        Alert.alert(
          'Stock limit',
          `Only ${stock} item(s) are currently available.`
        );
      }

      return updated;
    });
  };

  const resetCheckout = () => {
    setCart({});
    setCustomerName('');
    setCustomerPhone('');
    setAddress('');
    setCity('');
    setPincode('');
    setShowCart(false);
  };

  const openMyOrders = () => {
    setShowCart(false);
    setShowOrders(true);
    loadOrders();
  };

  const scrollToProducts = () => {
    setSearch('');
    setSelectedCategory('All');
    setShowCart(false);
    setShowOrders(false);
  };

  const placeOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Your cart is empty', 'Please select some products.');
      return;
    }

    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !address.trim() ||
      !city.trim() ||
      !pincode.trim()
    ) {
      Alert.alert('Missing details', 'Please fill in all delivery details.');
      return;
    }

    if (!/^\d{10}$/.test(customerPhone.trim())) {
      Alert.alert('Invalid mobile number', 'Enter a 10-digit mobile number.');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      Alert.alert('Invalid PIN code', 'Enter a 6-digit PIN code.');
      return;
    }

    setPlacingOrder(true);

    let storeOrderId = '';

    try {
      const order = await apiClient.post('/store/orders', {
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
      });

console.log('STORE ORDER RESPONSE:', JSON.stringify(order));
console.log('STORE ORDER ID:', getOrderId(order));

      storeOrderId = getOrderId(order);

      if (!storeOrderId) {
        throw new Error(
          'The order ID was not returned. Please check My Orders before placing another order.'
        );
      }

      // COD orders do not go through Razorpay.
      if (paymentMethod === 'cod') {
        resetCheckout();

        Alert.alert(
          'Order placed successfully!',
          `Your Cash on Delivery order has been placed.\nOrder ID: ${storeOrderId}\nAmount to pay on delivery: ₹${total.toFixed(2)}`,
          [{ text: 'View My Orders', onPress: openMyOrders }, { text: 'OK' }]
        );

        return;
      }

      const paymentOrder = await apiClient.post(
        '/store/payment/create-order',
        { store_order_id: storeOrderId }
      );

      if (
        !paymentOrder.key_id ||
        !paymentOrder.razorpay_order_id ||
        paymentOrder.amount == null
      ) {
        throw new Error('The payment order response is incomplete.');
      }

      const paymentResponse = await openRazorpayCheckout({
        key: paymentOrder.key_id,
        amount: String(paymentOrder.amount),
        currency: paymentOrder.currency || 'INR',
        name: 'PujariGo',
        description: 'Puja Samagri Store Order',
        order_id: paymentOrder.razorpay_order_id,
        prefill: {
          name: customerName.trim(),
          contact: customerPhone.trim(),
        },
        theme: { color: DARK_BLUE },
      });

      const verification = await apiClient.post('/store/payment/verify', {
        store_order_id: storeOrderId,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      if (
        verification.payment_status &&
        verification.payment_status !== 'paid'
      ) {
        throw new Error(
          'Payment verification is not complete. Please check your order status before trying again.'
        );
      }

      resetCheckout();

      Alert.alert(
        'Payment successful!',
        `Your Samagri order has been paid successfully.\nOrder ID: ${storeOrderId}`,
        [{ text: 'View My Orders', onPress: openMyOrders }, { text: 'OK' }]
      );
    } catch (e: any) {
      const errorCode = e?.code;
      const errorMessage =
        typeof e?.description === 'string'
          ? e.description
          : typeof e?.message === 'string'
            ? e.message
            : 'Please check your order status and try again.';
console.log('COD ORDER ERROR:', e);
console.log('COD ERROR MESSAGE:', errorMessage);

      if (
        errorCode === 'PAYMENT_CANCELLED' ||
        /payment cancelled|checkout cancelled/i.test(errorMessage)
      ) {
        Alert.alert(
          'Payment cancelled',
          'Your cart has been kept. If an order was created, check My Orders before trying again.'
        );
      } else {
        Alert.alert(
          'Payment or order issue',
          `${errorMessage}\n\nIf an order was created or money was deducted, check My Orders before attempting another payment.`
        );
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  const showComingSoon = (action: string, orderId: string) => {
    Alert.alert(
      `${action} — Coming Soon`,
      `Order ID: ${orderId}\n\nThis button is ready in the store screen, but the backend request feature has not been connected yet. No ${action.toLowerCase()} request has been submitted.`
    );
  };

  const renderOrder = (order: StoreOrder) => {
    const status = order.order_status || 'Order status unavailable';
    const paymentStatus = order.payment_status || 'Pending';
    const method = (order.payment_method || 'online').toLowerCase();
    const returnStatus = order.return_status || 'Not Requested';
    const replacementStatus = order.replacement_status || 'Not Requested';

    const delivered = status.toLowerCase() === 'delivered';
    const cancelled = status.toLowerCase() === 'cancelled';

    return (
      <View key={order.id} style={styles.orderCard}>
        <Text style={styles.orderTitle}>Order #{order.id}</Text>

        {order.created_at ? (
          <Text style={styles.orderMeta}>
            Placed: {new Date(order.created_at).toLocaleDateString()}
          </Text>
        ) : null}

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderLabel}>Order status</Text>
          <Text style={styles.orderValue}>{status}</Text>
        </View>

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderLabel}>Payment</Text>
          <Text style={styles.orderValue}>
            {method === 'cod' ? 'Cash on Delivery' : 'Online'}
          </Text>
        </View>

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderLabel}>Payment status</Text>
          <Text style={styles.orderValue}>{paymentStatus}</Text>
        </View>

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderLabel}>Order total</Text>
          <Text style={styles.orderTotal}>
            ₹{getOrderTotal(order).toFixed(2)}
          </Text>
        </View>

        <View style={styles.trackingBox}>
          <Text style={styles.trackingTitle}>Delivery Tracking</Text>
          <Text style={styles.trackingText}>
            {order.courier ? `Courier: ${order.courier}\n` : ''}
            {order.tracking_number
              ? `Order ID: ${order.tracking_number}`
              : 'Tracking details will appear when provided by the store.'}
          </Text>

          {order.tracking_number ? (
  <TouchableOpacity
    style={styles.secondaryButton}
    onPress={async () => {
      const trackingPage =
        order.tracking_url?.trim() ||
        'https://www.delhivery.com/tracking';

      try {
        await Linking.openURL(trackingPage);
      } catch {
        Alert.alert(
          'Unable to open tracking',
          'Please try opening Delhivery tracking in your browser.'
        );
      }
    }}
  >
    <Text style={styles.secondaryButtonText}>
      Track My Order ↗
    </Text>
  </TouchableOpacity>
) : (
  <Text style={styles.trackingText}>
    Tracking will be available after the store adds a courier tracking number.
  </Text>
)}
        </View>

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderLabel}>Return status</Text>
          <Text style={styles.orderValue}>{returnStatus}</Text>
        </View>

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderLabel}>Replacement status</Text>
          <Text style={styles.orderValue}>{replacementStatus}</Text>
        </View>

        <View style={styles.orderActions}>
          {!cancelled && !delivered && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => showComingSoon('Cancel Order', order.id)}
            >
              <Text style={styles.actionButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          )}

          {delivered && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => showComingSoon('Return Item', order.id)}
              >
                <Text style={styles.actionButtonText}>Return Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => showComingSoon('Replace Item', order.id)}
              >
                <Text style={styles.actionButtonText}>Replace Item</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.orderFootnote}>
          Return, replacement and cancellation requests will be connected when
          backend support is added.
        </Text>
      </View>
    );
  };

  const renderProduct = (item: Product) => {
    const quantity = cart[item.id]?.quantity || 0;
    const unavailable =
      item.is_available === false ||
      (item.stock !== undefined && Number(item.stock) <= 0);

    const icon =
      CATEGORY_ICONS[(item.category || '').toLowerCase()] ||
      CATEGORY_ICONS.default;

    return (
      <View key={item.id} style={styles.productCard}>
        <TouchableOpacity
  activeOpacity={0.85}
  onPress={() => setSelectedProduct(item)}
>
          <View style={styles.imageContainer}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.productImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderIcon}>{icon}</Text>
                <Text style={styles.placeholderLabel}>Puja Samagri</Text>
              </View>
            )}
          </View>

          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <Text style={styles.productCategory} numberOfLines={1}>
            {item.category || 'Puja Samagri'}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              ₹{Number(item.price || 0).toFixed(0)}
            </Text>
          </View>

          <Text style={styles.deliveryText}>View product details</Text>
        </TouchableOpacity>

        {unavailable ? (
          <View style={styles.unavailableButton}>
            <Text style={styles.unavailableText}>Out of stock</Text>
          </View>
        ) : quantity === 0 ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => updateQuantity(item, 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>ADD TO CART</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item, -1)}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.quantity}>{quantity}</Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item, 1)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Loading Puja Samagri...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProducts();
              if (showOrders) loadOrders();
            }}
            colors={[BLUE]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (showOrders || showCart) {
                  setShowOrders(false);
                  setShowCart(false);
                } else {
                  router.back();
                }
              }}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleArea}>
              <Text style={styles.brandTitle}>PujariGo</Text>
              <Text style={styles.headerSubtitle}>
                Your Trusted Partner for Every Puja
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => router.push('/customer/dashboard')}
            >
              <Text style={styles.headerActionIcon}>⌂</Text>
              <Text style={styles.headerActionText}>Home</Text>
            </TouchableOpacity>
          </View>

          {!showCart && !showOrders && (
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for products, puja kits..."
                placeholderTextColor="#777777"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={styles.clearSearch}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={openMyOrders}
          >
            <Text style={styles.quickActionIcon}>📦</Text>
            <Text style={styles.quickActionText}>My Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setShowOrders(false);
              setShowCart(true);
            }}
          >
            <Text style={styles.quickActionIcon}>🛒</Text>
            <Text style={styles.quickActionText}>
              Cart ({itemCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() =>
              Alert.alert(
                'Returns & Replacements',
                'You will be able to request a return or replacement for eligible delivered orders. Backend support is coming soon.'
              )
            }
          >
            <Text style={styles.quickActionIcon}>🔄</Text>
            <Text style={styles.quickActionText}>Returns</Text>
          </TouchableOpacity>
        </View>

        {showOrders ? (
          <View style={styles.ordersSection}>
            <Text style={styles.pageTitle}>My Orders</Text>
            <Text style={styles.pageSubtitle}>
              View order status, payment and delivery tracking.
            </Text>

            <TouchableOpacity
              style={styles.refreshOrdersButton}
              onPress={loadOrders}
              disabled={loadingOrders}
            >
              <Text style={styles.refreshOrdersText}>
                {loadingOrders ? 'Refreshing...' : 'Refresh Orders'}
              </Text>
            </TouchableOpacity>

            {loadingOrders && (
              <ActivityIndicator
                size="large"
                color={BLUE}
                style={{ marginVertical: 20 }}
              />
            )}

            {!!ordersError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{ordersError}</Text>
                <TouchableOpacity onPress={loadOrders}>
                  <Text style={styles.retry}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loadingOrders && !ordersError && orders.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>No orders found</Text>
                <Text style={styles.emptyText}>
                  Your placed orders will appear here.
                </Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={scrollToProducts}
                >
                  <Text style={styles.resetButtonText}>Start Shopping</Text>
                </TouchableOpacity>
              </View>
            )}

            {orders.map(renderOrder)}
          </View>
        ) : showCart ? (
          <>
            <View style={styles.cartPageHeader}>
              <TouchableOpacity
                style={styles.backToShop}
                onPress={() => setShowCart(false)}
              >
                <Text style={styles.backToShopText}>‹ Continue Shopping</Text>
              </TouchableOpacity>
              <Text style={styles.cartPageTitle}>My Shopping Cart</Text>
              <Text style={styles.resultCount}>
                {itemCount} item(s) in your cart
              </Text>
            </View>

            <View style={styles.section}>
              {cartItems.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🛒</Text>
                  <Text style={styles.emptyTitle}>Your cart is empty</Text>
                  <Text style={styles.emptyText}>
                    Add some puja essentials to get started.
                  </Text>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => setShowCart(false)}
                  >
                    <Text style={styles.resetButtonText}>Start Shopping</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {cartItems.map(({ product, quantity }) => (
                    <View key={product.id} style={styles.cartRow}>
                      {product.image_url ? (
                        <Image
                          source={{ uri: product.image_url }}
                          style={styles.cartImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.cartImagePlaceholder}>
                          <Text style={{ fontSize: 25 }}>🪔</Text>
                        </View>
                      )}

                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartName}>{product.name}</Text>
                        <Text style={styles.cartPrice}>
                          ₹{Number(product.price).toFixed(2)}
                        </Text>
                        <View style={styles.cartQuantityControls}>
                          <TouchableOpacity
                            style={styles.smallQuantityButton}
                            onPress={() => updateQuantity(product, -1)}
                          >
                            <Text style={styles.smallQuantityText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantity}>{quantity}</Text>
                          <TouchableOpacity
                            style={styles.smallQuantityButton}
                            onPress={() => updateQuantity(product, 1)}
                          >
                            <Text style={styles.smallQuantityText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.cartLineTotal}>
                        ₹{(Number(product.price) * quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>
                      ₹{total.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.checkoutNote}>
                    Delivery charges, if applicable, may be added separately.
                  </Text>
                </>
              )}
            </View>

            {cartItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Delivery Details</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Customer name"
                  value={customerName}
                  onChangeText={setCustomerName}
                />

                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile number"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />

                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Full delivery address"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />

                <TextInput
                  style={styles.input}
                  placeholder="City"
                  value={city}
                  onChangeText={setCity}
                />

                <TextInput
                  style={styles.input}
                  placeholder="6-digit PIN code"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <Text style={styles.sectionHeading}>
                  Choose Payment Method
                </Text>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'online' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('online')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentOptionText}>
                    {paymentMethod === 'online' ? '🔘' : '⚪'} Pay Online (UPI / Razorpay)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'cod' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('cod')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paymentOptionText}>
                    {paymentMethod === 'cod' ? '🔘' : '⚪'} Cash on Delivery
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    placingOrder && styles.disabledButton,
                  ]}
                  disabled={placingOrder}
                  onPress={placeOrder}
                >
                  {placingOrder ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.orderButtonText}>
                      {paymentMethod === 'cod'
                        ? `Place Order • ₹${total.toFixed(2)} (COD)`
                        : `Pay ₹${total.toFixed(2)} Securely`}
                    </Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.paymentNote}>
                  {paymentMethod === 'cod'
                    ? 'Pay for your order when it is delivered.'
                    : 'Secure online checkout powered by Razorpay.'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.categorySection}>
              <Text style={styles.sectionHeading}>Shop by Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
              >
                {categories.map((category) => {
                  const active = selectedCategory === category;
                  const icon =
                    CATEGORY_ICONS[category.toLowerCase()] ||
                    CATEGORY_ICONS.default;

                  return (
                    <TouchableOpacity
                      key={category}
                      style={styles.categoryItem}
                      onPress={() => setSelectedCategory(category)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.categoryCircle,
                          active && styles.categoryCircleActive,
                        ]}
                      >
                        <Text style={styles.categoryEmoji}>{icon}</Text>
                      </View>
                      <Text
                        style={[
                          styles.categoryText,
                          active && styles.categoryTextActive,
                        ]}
                        numberOfLines={2}
                      >
                        {category}
                      </Text>
                      {active && <View style={styles.categoryUnderline} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.promoBanner}>
              <View style={styles.promoContent}>
                <Text style={styles.promoEyebrow}>PUJARIGO SPECIAL</Text>
                <Text style={styles.promoTitle}>
                  Everything for{'\n'}your Puja
                </Text>
                <Text style={styles.promoSubtitle}>
                  Make every ceremony special
                </Text>
                <TouchableOpacity
                  style={styles.shopNowButton}
                  onPress={scrollToProducts}
                  activeOpacity={0.85}
                >
                  <Text style={styles.shopNowText}>EXPLORE NOW ›</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.promoIllustration}>
                <Text style={styles.promoLamp}>🪔</Text>
                <Text style={styles.promoFlowers}>🌼 🙏 🌼</Text>
              </View>
            </View>

            <View style={styles.benefitsStrip}>
              <View style={styles.benefit}>
                <Text style={styles.benefitIcon}>🪷</Text>
                <Text style={styles.benefitText}>Puja Essentials</Text>
              </View>
              <View style={styles.benefitDivider} />
              <View style={styles.benefit}>
                <Text style={styles.benefitIcon}>📦</Text>
                <Text style={styles.benefitText}>Home Delivery</Text>
              </View>
              <View style={styles.benefitDivider} />
              <View style={styles.benefit}>
                <Text style={styles.benefitIcon}>🔒</Text>
                <Text style={styles.benefitText}>Secure Payment</Text>
              </View>
            </View>

            <View style={styles.productsSection}>
              <View style={styles.productsHeadingRow}>
                <View style={styles.headingLeft}>
                  <Text style={styles.sectionHeading}>
                    {search.trim()
                      ? 'Search Results'
                      : selectedCategory === 'All'
                        ? 'Recommended for You'
                        : selectedCategory}
                  </Text>
                  <Text style={styles.resultCount}>
                    {filteredProducts.length} products
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setSelectedCategory('All');
                  }}
                >
                  <Text style={styles.viewAll}>Clear filters</Text>
                </TouchableOpacity>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity onPress={loadProducts}>
                    <Text style={styles.retry}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!error && products.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🛍️</Text>
                  <Text style={styles.emptyTitle}>Products coming soon</Text>
                  <Text style={styles.emptyText}>
                    Please check again later.
                  </Text>
                </View>
              )}

              {!error && products.length > 0 && filteredProducts.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🔎</Text>
                  <Text style={styles.emptyTitle}>No matching products</Text>
                  <Text style={styles.emptyText}>
                    Try another product name or category.
                  </Text>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={scrollToProducts}
                  >
                    <Text style={styles.resetButtonText}>Show all products</Text>
                  </TouchableOpacity>
                </View>
              )}

              {filteredProducts.length > 0 && (
                <View style={styles.productGrid}>
                  {filteredProducts.map(renderProduct)}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {!showCart && !showOrders && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInfo}>
            <Text style={styles.bottomBarTotal}>₹{total.toFixed(2)}</Text>
            <Text style={styles.bottomBarCaption}>
              {itemCount} item(s) selected
            </Text>
          </View>

          <TouchableOpacity
            style={styles.viewCartButton}
            onPress={() => setShowCart(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.viewCartIcon}>🛒</Text>
            <Text style={styles.viewCartText}>
              {itemCount > 0 ? `VIEW CART (${itemCount})` : 'VIEW CART'}
            </Text>
            <Text style={styles.viewCartArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F3F6' },
  content: { paddingBottom: 100 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F1F3F6',
  },
  loadingText: { marginTop: 12, color: '#555555' },

  header: {
    backgroundColor: BLUE,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: { width: 34, justifyContent: 'center' },
  backArrow: { fontSize: 36, lineHeight: 38, color: '#FFFFFF' },
  headerTitleArea: { flex: 1 },
  brandTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: 'bold' },
  headerSubtitle: { color: '#E7EEFF', fontSize: 10, marginTop: 3 },
  headerAction: { alignItems: 'center', paddingLeft: 8 },
  headerActionIcon: { fontSize: 24, color: '#FFFFFF' },
  headerActionText: { fontSize: 10, color: '#FFFFFF', marginTop: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 27, color: BLUE, marginRight: 9 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#222222' },
  clearSearch: { fontSize: 17, color: '#555555', padding: 5 },

  quickActions: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 9,
  },
  quickActionButton: { alignItems: 'center', flex: 1, gap: 4 },
  quickActionIcon: { fontSize: 22 },
  quickActionText: { fontSize: 11, color: '#333333', fontWeight: '600' },

  categorySection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 9,
    paddingHorizontal: 10,
  },
  sectionHeading: { fontSize: 17, fontWeight: 'bold', color: '#212121' },
  categoryList: { paddingTop: 12, paddingBottom: 5, gap: 8 },
  categoryItem: { width: 78, alignItems: 'center', paddingBottom: 5 },
  categoryCircle: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#F1F5FC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5EAF2',
  },
  categoryCircleActive: {
    backgroundColor: '#E2EDFF',
    borderColor: BLUE,
    borderWidth: 2,
  },
  categoryEmoji: { fontSize: 27 },
  categoryText: {
    color: '#333333',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 7,
    minHeight: 25,
  },
  categoryTextActive: { color: BLUE, fontWeight: 'bold' },
  categoryUnderline: {
    height: 3,
    width: 28,
    borderRadius: 2,
    backgroundColor: BLUE,
    marginTop: 2,
  },

  promoBanner: {
    backgroundColor: '#DCEBFF',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 7,
    minHeight: 178,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  promoContent: { flex: 1 },
  promoEyebrow: {
    color: DARK_BLUE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 7,
  },
  promoTitle: {
    color: '#172B4D',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 30,
  },
  promoSubtitle: { color: '#46566F', fontSize: 11, marginTop: 7 },
  shopNowButton: {
    alignSelf: 'flex-start',
    backgroundColor: BLUE,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 12,
  },
  shopNowText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  promoIllustration: { width: 105, alignItems: 'center', justifyContent: 'center' },
  promoLamp: { fontSize: 68 },
  promoFlowers: { fontSize: 18, marginTop: 4 },

  benefitsStrip: {
    backgroundColor: '#FFFFFF',
    marginBottom: 9,
    paddingVertical: 13,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  benefit: { flex: 1, alignItems: 'center', gap: 4 },
  benefitIcon: { fontSize: 20 },
  benefitText: { color: '#4A4A4A', fontSize: 9, textAlign: 'center' },
  benefitDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },

  productsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 18,
  },
  productsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headingLeft: { flex: 1 },
  resultCount: { color: '#777777', fontSize: 11, marginTop: 4 },
  viewAll: { color: BLUE, fontSize: 11, paddingLeft: 8 },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
  },
  productCard: {
    width: '49%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E8EB',
    borderRadius: 5,
    padding: 9,
    marginBottom: 2,
  },
  imageContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    marginBottom: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
  },
  placeholderIcon: { fontSize: 43 },
  placeholderLabel: { fontSize: 10, color: '#888888', marginTop: 5 },
  productName: {
    color: '#212121',
    fontSize: 13,
    fontWeight: '600',
    minHeight: 35,
    lineHeight: 17,
  },
  productCategory: { color: '#777777', fontSize: 10, marginTop: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  price: { color: '#212121', fontSize: 17, fontWeight: 'bold' },
  deliveryText: {
    color: '#287C46',
    fontSize: 9,
    marginTop: 5,
    marginBottom: 9,
  },
  addButton: {
    minHeight: 35,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { color: BLUE, fontWeight: 'bold', fontSize: 10 },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 4,
    minHeight: 35,
    paddingHorizontal: 5,
  },
  quantityButton: {
    width: 27,
    height: 27,
    borderRadius: 4,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  quantity: { color: '#212121', fontWeight: 'bold' },
  unavailableButton: { minHeight: 35, justifyContent: 'center', alignItems: 'center' },
  unavailableText: { color: '#B42318', fontSize: 11 },

  emptyBox: { alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 38, marginBottom: 8 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  emptyText: { fontSize: 13, color: '#777777', textAlign: 'center', marginTop: 6 },
  resetButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: BLUE,
    borderRadius: 5,
  },
  resetButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  errorBox: {
    backgroundColor: '#FDECEC',
    padding: 14,
    borderRadius: 6,
    marginBottom: 14,
  },
  errorText: { color: '#B42318' },
  retry: { color: BLUE, fontWeight: 'bold', marginTop: 8 },

  cartPageHeader: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 9 },
  backToShop: { alignSelf: 'flex-start', marginBottom: 12 },
  backToShopText: { color: BLUE, fontWeight: '600' },
  cartPageTitle: { fontSize: 21, color: '#212121', fontWeight: 'bold' },
  section: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 9 },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  cartImage: { width: 65, height: 70, backgroundColor: '#FAFAFA', borderRadius: 5 },
  cartImagePlaceholder: {
    width: 65,
    height: 70,
    backgroundColor: '#F8FAFD',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  cartItemInfo: { flex: 1 },
  cartName: { color: '#333333', fontWeight: '600', fontSize: 13 },
  cartPrice: { fontWeight: 'bold', color: '#212121', marginTop: 4 },
  cartLineTotal: { color: '#212121', fontWeight: 'bold', fontSize: 12 },
  cartQuantityControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  smallQuantityButton: {
    width: 25,
    height: 25,
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallQuantityText: { fontSize: 18, color: BLUE, fontWeight: 'bold' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    paddingTop: 14,
    marginTop: 12,
  },
  totalLabel: { fontSize: 17, fontWeight: 'bold', color: '#212121' },
  totalAmount: { fontSize: 19, fontWeight: 'bold', color: '#15803D' },
  checkoutNote: { fontSize: 11, color: '#777777', marginTop: 10 },

  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9DDE3',
    borderWidth: 1,
    borderRadius: 5,
    padding: 12,
    fontSize: 14,
    marginTop: 12,
    color: '#222222',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  paymentOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D9E0',
    borderRadius: 8,
    padding: 13,
    marginTop: 8,
  },
  paymentOptionSelected: { borderColor: BLUE, backgroundColor: '#EAF2FF' },
  paymentOptionText: { fontSize: 14, color: '#222222', fontWeight: '600' },
  orderButton: {
    backgroundColor: '#FB641B',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: { opacity: 0.5 },
  orderButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  paymentNote: {
    fontSize: 11,
    color: '#777777',
    marginTop: 10,
    lineHeight: 17,
    textAlign: 'center',
  },

  ordersSection: { padding: 12 },
  pageTitle: { fontSize: 23, fontWeight: 'bold', color: '#212121' },
  pageSubtitle: { fontSize: 12, color: '#666666', marginTop: 5, marginBottom: 12 },
  refreshOrdersButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  refreshOrdersText: { color: BLUE, fontWeight: 'bold' },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E6EC',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  orderTitle: { fontSize: 15, fontWeight: 'bold', color: '#212121' },
  orderMeta: { fontSize: 11, color: '#777777', marginTop: 5, marginBottom: 8 },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  orderLabel: { fontSize: 12, color: '#666666', flex: 1 },
  orderValue: { fontSize: 12, color: '#222222', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  orderTotal: { fontSize: 14, color: '#15803D', fontWeight: 'bold' },
  trackingBox: {
    backgroundColor: '#F5F8FF',
    padding: 11,
    borderRadius: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  trackingTitle: { fontSize: 13, fontWeight: 'bold', color: DARK_BLUE },
  trackingText: { fontSize: 12, color: '#444444', marginTop: 5, lineHeight: 18 },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: { color: BLUE, fontSize: 11, fontWeight: 'bold' },
  orderFootnote: { fontSize: 10, color: '#888888', marginTop: 10, lineHeight: 15 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E5EA',
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomBarInfo: { flex: 1 },
  bottomBarTotal: { color: '#212121', fontSize: 18, fontWeight: 'bold' },
  bottomBarCaption: { color: '#777777', fontSize: 10, marginTop: 3 },
  viewCartButton: {
    backgroundColor: BLUE,
    borderRadius: 5,
    paddingHorizontal: 15,
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  viewCartIcon: { fontSize: 17 },
  viewCartText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 },
  viewCartArrow: { color: '#FFFFFF', fontSize: 22 },
});

