
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

export default function CustomerStoreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const loadProducts = useCallback(async () => {
    setError('');
    try {
      const result = await apiClient.get('/store/products');
      setProducts(Array.isArray(result) ? result : result.products || []);
    } catch (e: any) {
      setError(e.message || 'Could not load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

      Alert.alert(
        'Order created',
        `Order ID: ${order.id || order.order_id || 'Created'}\nPayment is not completed yet.`
      );

      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setCity('');
      setPincode('');
    } catch (e: any) {
      Alert.alert('Could not create order', e.message || 'Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const quantity = cart[item.id]?.quantity || 0;
    const unavailable =
      item.is_available === false || Number(item.stock ?? 0) <= 0;

    return (
      <View style={styles.productCard}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.productImage, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>🪔</Text>
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.category}>{item.category || 'Puja Samagri'}</Text>
          {!!item.description && (
            <Text style={styles.description} numberOfLines={3}>
              {item.description}
            </Text>
          )}
          <Text style={styles.price}>₹{Number(item.price).toFixed(2)}</Text>

          {unavailable ? (
            <Text style={styles.unavailable}>Currently unavailable</Text>
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
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B4513" />
        <Text style={styles.muted}>Loading Puja Samagri...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Puja Samagri Store</Text>
        <Text style={styles.subtitle}>
          Shop essential items for your puja.
        </Text>
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
        <Text style={styles.empty}>
          No products are available yet. Please check again later.
        </Text>
      )}

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item, index) => item.id || String(index)}
        scrollEnabled={false}
        contentContainerStyle={styles.productList}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Cart ({itemCount})</Text>
        {cartItems.length === 0 ? (
          <Text style={styles.muted}>Add products to your cart.</Text>
        ) : (
          <>
            {cartItems.map(({ product, quantity }) => (
              <View key={product.id} style={styles.cartRow}>
                <Text style={styles.cartName}>
                  {product.name} × {quantity}
                </Text>
                <Text style={styles.cartPrice}>
                  ₹{(Number(product.price) * quantity).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>₹{total.toFixed(2)}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Details</Text>
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
            (placingOrder || cartItems.length === 0) && styles.disabledButton,
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
          Creating an order does not complete payment. Online checkout will be
          connected after the order flow is tested.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    color: '#8B4513',
    fontSize: 16,
    marginBottom: 14,
  },
  title: {
    color: '#7A2E00',
    fontSize: 27,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#6B625B',
    fontSize: 15,
    marginTop: 6,
  },
  productList: {
    gap: 12,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EADBC8',
    gap: 12,
  },
  productImage: {
    width: 105,
    height: 115,
    borderRadius: 8,
    backgroundColor: '#F2E6D8',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 35,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#34251B',
  },
  category: {
    fontSize: 12,
    color: '#8B4513',
    marginTop: 3,
  },
  description: {
    fontSize: 13,
    color: '#655B52',
    marginTop: 5,
  },
  price: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#7A2E00',
    marginTop: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#8B4513',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  quantity: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 15,
    textAlign: 'center',
  },
  unavailable: {
    color: '#B42318',
    fontSize: 12,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EADBC8',
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7A2E00',
    marginBottom: 14,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cartName: {
    flex: 1,
    color: '#34251B',
  },
  cartPrice: {
    fontWeight: '600',
    color: '#34251B',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EADBC8',
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#7A2E00',
  },
  input: {
    backgroundColor: '#FFFCF8',
    borderColor: '#E0D1C1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#34251B',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  orderButton: {
    backgroundColor: '#8B4513',
    borderRadius: 9,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
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
    color: '#71665C',
    marginTop: 12,
    lineHeight: 18,
  },
  muted: {
    color: '#71665C',
    marginTop: 8,
  },
  empty: {
    textAlign: 'center',
    color: '#71665C',
    padding: 24,
  },
  errorBox: {
    backgroundColor: '#FDECEC',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#B42318',
  },
  retry: {
    color: '#8B4513',
    fontWeight: 'bold',
    marginTop: 8,
  },
});
