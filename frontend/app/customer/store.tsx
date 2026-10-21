
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

const BLUE = '#2874F0';

export default function CustomerStoreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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

      setProducts(list);
    } catch (e: any) {
      setError(e?.message || 'Could not load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const updateQuantity = (product: Product, change: number) => {
    setCart((previous) => {
      const current = previous[product.id]?.quantity || 0;
      const next = current + change;
      const updated = { ...previous };

      if (next <= 0) {
        delete updated[product.id];
      } else if (next <= 50) {
        updated[product.id] = { product, quantity: next };
      }

      return updated;
    });
  };

  const cartItems = Object.values(cart);

  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const itemCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  
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

    if (!/^\d{6}$/.test(pincode.trim())) {
      Alert.alert('Invalid PIN code', 'Enter a 6-digit PIN code.');
      return;
    }

    setPlacingOrder(true);

    try {
      // Step 1: Create the Store order.
      const order = await apiClient.post('/store/orders', {
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
      });

      const storeOrderId = String(
        order.id || order.order_id || order._id || ''
      );

      if (!storeOrderId) {
        throw new Error(
          'The order was created, but its ID was not returned. Please contact support before retrying.'
        );
      }

      // Step 2: Ask the backend to create a Razorpay order.
      const paymentOrder = await apiClient.post(
        '/store/payment/create-order',
        {
          store_order_id: storeOrderId,
        }
      );

      if (
        !paymentOrder.key_id ||
        !paymentOrder.razorpay_order_id ||
        paymentOrder.amount == null
      ) {
        throw new Error('The payment order response is incomplete.');
      }

      // Step 3: Open Razorpay checkout.
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
        theme: {
          color: '#1746A2',
        },
      });

      // Step 4: Verify payment securely with the backend.
      const verification = await apiClient.post(
        '/store/payment/verify',
        {
          store_order_id: storeOrderId,
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        }
      );

      if (
        verification.payment_status &&
        verification.payment_status !== 'paid'
      ) {
        throw new Error(
          'Payment verification is not complete. Please check your order status before trying again.'
        );
      }

      // Step 5: Clear the cart only after payment verification succeeds.
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setCity('');
      setPincode('');

      Alert.alert(
        'Payment successful!',
        `Your Samagri order has been paid successfully.\nOrder ID: ${storeOrderId}`
      );
    } catch (e: any) {
      const errorCode = e?.code;
      const errorMessage =
        typeof e?.description === 'string'
          ? e.description
          : typeof e?.message === 'string'
            ? e.message
            : 'Please check your order status and try again.';

      if (
        errorCode === 'PAYMENT_CANCELLED' ||
        /payment cancelled|checkout cancelled/i.test(errorMessage)
      ) {
        Alert.alert(
          'Payment cancelled',
          'Your cart has been kept. You can try checkout again.'
        );
      } else {
        Alert.alert(
          'Payment or order issue',
          `${errorMessage}\n\nIf money was deducted, check your order status before attempting another payment.`
        );
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderProduct = (item: Product) => {
    const quantity = cart[item.id]?.quantity || 0;
    const unavailable =
      item.is_available === false ||
      (item.stock !== undefined && Number(item.stock) <= 0);

    return (
      <View key={item.id} style={styles.productCard}>
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderIcon}>🪔</Text>
              <Text style={styles.placeholderLabel}>Puja Item</Text>
            </View>
          )}
        </View>

        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>

        <Text style={styles.productCategory} numberOfLines={1}>
          {item.category || 'Puja Samagri'}
        </Text>

        <Text style={styles.price}>
          ₹{Number(item.price || 0).toFixed(0)}
        </Text>

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
            <Text style={styles.addButtonText}>ADD +</Text>
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
            }}
          />
        }
      >
        {/* BLUE SHOP HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleArea}>
              <Text style={styles.brandTitle}>PujariGo</Text>
              <Text style={styles.headerSubtitle}>Puja Samagri Store</Text>
            </View>

            <TouchableOpacity
              style={styles.cartIconButton}
              onPress={() => {
                // The cart summary is below the product list.
                setSearch('');
                setSelectedCategory('All');
              }}
            >
              <Text style={styles.cartIcon}>🛒</Text>
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {itemCount > 99 ? '99+' : itemCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for puja items"
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
        </View>

        {/* CATEGORY SHORTCUTS */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionHeading}>Shop by Category</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {categories.map((category, index) => {
              const active = selectedCategory === category;

              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={styles.categoryEmoji}>
                    {category === 'All'
                      ? '🛍️'
                      : ['🪔', '🌼', '🕯️', '🙏', '📿'][index % 5]}
                  </Text>
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* PRODUCT GRID */}
        <View style={styles.productsSection}>
          <View style={styles.productsHeadingRow}>
            <View>
              <Text style={styles.sectionHeading}>
                {search.trim()
                  ? 'Search Results'
                  : selectedCategory === 'All'
                    ? 'Popular Products'
                    : selectedCategory}
              </Text>
              <Text style={styles.resultCount}>
                {filteredProducts.length} items
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
              <Text style={styles.emptyTitle}>No matching items</Text>
              <Text style={styles.emptyText}>
                Try another product name or category.
              </Text>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  setSearch('');
                  setSelectedCategory('All');
                }}
              >
                <Text style={styles.resetButtonText}>Show all products</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.productGrid}>
            {filteredProducts.map(renderProduct)}
          </View>
        </View>

        {/* CART SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>My Cart ({itemCount})</Text>

          {cartItems.length === 0 ? (
            <Text style={styles.muted}>
              Tap ADD on a product to add it to your cart.
            </Text>
          ) : (
            <>
              {cartItems.map(({ product, quantity }) => (
                <View key={product.id} style={styles.cartRow}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartName}>{product.name}</Text>
                    <Text style={styles.cartQuantity}>Qty: {quantity}</Text>
                  </View>

                  <Text style={styles.cartPrice}>
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
            </>
          )}
        </View>

        {/* DELIVERY DETAILS */}
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
            placeholder="Mobile number"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
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

          <TouchableOpacity
            style={[
              styles.orderButton,
              (placingOrder || cartItems.length === 0) &&
                styles.disabledButton,
            ]}
            disabled={placingOrder || cartItems.length === 0}
            onPress={placeOrder}
          >
            {placingOrder ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.orderButtonText}>Create Order</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.paymentNote}>
            Payment is not completed by creating an order. Online checkout
            will be connected after the order flow is tested.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F1F3F6',
  },
  content: {
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F1F3F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#555555',
  },
  header: {
    backgroundColor: BLUE,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 34,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 36,
    lineHeight: 38,
    color: '#FFFFFF',
  },
  headerTitleArea: {
    flex: 1,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E7EEFF',
    fontSize: 12,
    marginTop: 2,
  },
  cartIconButton: {
    padding: 6,
    position: 'relative',
  },
  cartIcon: {
    fontSize: 25,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: '#FF6161',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 25,
    color: BLUE,
    marginRight: 9,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222222',
    outlineStyle: 'none',
  } as any,
  clearSearch: {
    fontSize: 17,
    color: '#555555',
    padding: 5,
  },
  categorySection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 17,
    paddingBottom: 14,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  categoryList: {
    paddingHorizontal: 12,
    paddingTop: 13,
    gap: 10,
  },
  categoryChip: {
    width: 90,
    minHeight: 83,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E1E5EA',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#EAF2FF',
    borderColor: BLUE,
  },
  categoryEmoji: {
    fontSize: 25,
    marginBottom: 5,
  },
  categoryChipText: {
    color: '#444444',
    fontSize: 11,
    textAlign: 'center',
  },
  categoryChipTextActive: {
    color: BLUE,
    fontWeight: 'bold',
  },
  productsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 17,
    paddingBottom: 16,
  },
  productsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  resultCount: {
    color: '#777777',
    fontSize: 12,
    marginTop: 4,
  },
  viewAll: {
    color: BLUE,
    fontSize: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  productCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E8EB',
    borderRadius: 6,
    padding: 9,
    marginBottom: 2,
  },
  imageContainer: {
    width: '100%',
    height: 145,
    backgroundColor: '#FAFAFA',
    borderRadius: 4,
    marginBottom: 9,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 42,
  },
  placeholderLabel: {
    fontSize: 11,
    color: '#888888',
    marginTop: 5,
  },
  productName: {
    color: '#212121',
    fontSize: 14,
    fontWeight: '600',
    minHeight: 36,
    lineHeight: 18,
  },
  productCategory: {
    color: '#777777',
    fontSize: 11,
    marginTop: 3,
  },
  price: {
    color: '#212121',
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 9,
  },
  addButton: {
    minHeight: 35,
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: BLUE,
    fontWeight: 'bold',
    fontSize: 12,
  },
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
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantity: {
    color: '#212121',
    fontWeight: 'bold',
  },
  unavailableButton: {
    minHeight: 35,
    justifyContent: 'center',
  },
  unavailableText: {
    color: '#B42318',
    fontSize: 11,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  emptyText: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
    marginTop: 6,
  },
  resetButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: BLUE,
    borderRadius: 5,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 10,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartName: {
    color: '#333333',
    fontWeight: '600',
  },
  cartQuantity: {
    color: '#777777',
    fontSize: 12,
    marginTop: 4,
  },
  cartPrice: {
    fontWeight: 'bold',
    color: '#212121',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    paddingTop: 14,
    marginTop: 12,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#15803D',
  },
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
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  orderButton: {
    backgroundColor: BLUE,
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentNote: {
    fontSize: 12,
    color: '#777777',
    marginTop: 12,
    lineHeight: 18,
  },
  muted: {
    color: '#777777',
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: '#FDECEC',
    padding: 14,
    borderRadius: 6,
    marginBottom: 14,
  },
  errorText: {
    color: '#B42318',
  },
  retry: {
    color: BLUE,
    fontWeight: 'bold',
    marginTop: 8,
  },
});
