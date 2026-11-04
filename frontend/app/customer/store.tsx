// frontend/app/customer/store.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationBell } from '@/src/components/NotificationBell';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Product = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  image_url?: string;
  stock?: number;
  is_available?: boolean;
  is_gift?: boolean;
  is_returnable?: boolean;
  tags?: string[];
  weight_grams?: number;
  average_rating?: number;
  review_count?: number;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type StoreOrder = {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  city?: string;
  pincode?: string;
  order_status?: string;
  payment_status?: string;
  payment_method?: string;
  total_amount?: number;
  product_subtotal?: number;
  discount_amount?: number;
  coupon_code?: string;
  shipping_fee?: number;
  platform_fee?: number;
  cod_fee?: number;
  is_gift?: boolean;
  gift_recipient_name?: string;
  gift_message?: string;
  created_at?: string;
  courier?: string;
  tracking_number?: string;
  tracking_url?: string;
  items?: any[];
};

type StoreReturn = {
  id: string;
  product_name?: string;
  quantity?: number;
  reason?: string;
  status?: string;
  reverse_status?: string;
  reverse_waybill?: string;
  reverse_tracking_url?: string;
  review_note?: string;
  created_at?: string;
};

const BLUE = '#65BDF2';
const DARK_BLUE = '#42A5E8';
const GOLD = '#EAF7FF';

const CATEGORY_ICONS: Record<string, string> = {
  all: '🛍️',
  'puja samagri': '🪔',
  'puja kit': '🙏',
  diya: '🪔',
  gifts: '🎁',
  incense: '🕯️',
  default: '📿',
};

const getOrderId = (order: any): string =>
  String(order?.id || order?.order_id || order?._id || '');

const getOrderTotal = (order: StoreOrder): number =>
  Number(order.total_amount ?? 0);

type StoreLanguage = 'en' | 'kn' | 'hi';

const STORE_TRANSLATIONS: Record<StoreLanguage, Record<string, string>> = {
  en: {
    home: 'Home', tagline: 'Your Trusted Partner for Every Puja',
    search: 'Search for products, puja kits...', myOrders: 'My Orders',
    favourites: 'Wishlist', chat: 'Support Chat', gifts: 'Gift Store',
    shopCategory: 'Shop by Category', special: 'PUJARIGO SPECIAL',
    everything: 'Everything for your Puja', exploreNow: 'EXPLORE NOW ›',
    featured: 'Featured Products', recentlyViewed: 'Recently Viewed',
    addCart: 'ADD TO CART', outStock: 'Out of stock', viewDetails: 'View details',
    loading: 'Loading Puja Samagri...', cart: 'My Shopping Cart',
    emptyCart: 'Your cart is empty', startShopping: 'Start Shopping',
    total: 'Total', deliveryDetails: 'Delivery Details', applyCoupon: 'Apply Coupon',
    giftOption: '🎁 Send as a Gift / Hamper', invoice: 'Download PDF Invoice / Receipt',
  },
  kn: {
    home: 'ಮುಖಪುಟ', tagline: 'ಪ್ರತಿ ಪೂಜೆಗೆ ನಿಮ್ಮ ವಿಶ್ವಾಸಾರ್ಹ ಸಂಗಾತಿ',
    search: 'ಉತ್ಪನ್ನಗಳು ಮತ್ತು ಪೂಜಾ ಕಿಟ್‌ಗಳನ್ನು ಹುಡುಕಿ...', myOrders: 'ನನ್ನ ಆರ್ಡರ್‌ಗಳು',
    favourites: 'ಇಷ್ಟಪಟ್ಟವು', chat: 'ಚಾಟ್ ಬೆಂಬಲ', gifts: 'ಉಡುಗೊರೆ ಅಂಗಡಿ',
    shopCategory: 'ವರ್ಗದ ಪ್ರಕಾರ ಖರೀದಿಸಿ', special: 'ಪೂಜಾರಿಗೋ ವಿಶೇಷ',
    everything: 'ನಿಮ್ಮ ಪೂಜೆಗೆ ಬೇಕಾದ ಎಲ್ಲವೂ', exploreNow: 'ಈಗ ಅನ್ವೇಷಿಸಿ ›',
    featured: 'ವಿಶೇಷ ಉತ್ಪನ್ನಗಳು', recentlyViewed: 'ಇತ್ತೀಚೆಗೆ ವೀಕ್ಷಿಸಿದವು',
    addCart: 'ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ', outStock: 'ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಇಲ್ಲ', viewDetails: 'ವಿವರಗಳನ್ನು ನೋಡಿ',
    loading: 'ಪೂಜಾ ಸಾಮಗ್ರಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...', cart: 'ನನ್ನ ಖರೀದಿ ಕಾರ್ಟ್',
    emptyCart: 'ನಿಮ್ಮ ಕಾರ್ಟ್ ಖಾಲಿಯಾಗಿದೆ', startShopping: 'ಖರೀದಿ ಪ್ರಾರಂಭಿಸಿ',
    total: 'ಒಟ್ಟು', deliveryDetails: 'ವಿತರಣೆಯ ವಿವರಗಳು', applyCoupon: 'ಕೂಪನ್ ಅನ್ವಯಿಸಿ',
    giftOption: '🎁 ಉಡುಗೊರೆಯಾಗಿ ಕಳುಹಿಸಿ', invoice: 'ಪಿಡಿಎಫ್ ಇನ್‌ವಾಯ್ಸ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
  },
  hi: {
    home: 'होम', tagline: 'हर पूजा के लिए आपका भरोसेमंद साथी',
    search: 'उत्पाद और पूजा किट खोजें...', myOrders: 'मेरे ऑर्डर',
    favourites: 'विशलिस्ट', chat: 'चैट सहायता', gifts: 'उपहार स्टोर',
    shopCategory: 'श्रेणी के अनुसार खरीदें', special: 'पूजारिगो विशेष',
    everything: 'आपकी पूजा के लिए सब कुछ', exploreNow: 'अभी देखें ›',
    featured: 'विशेष उत्पाद', recentlyViewed: 'हाल ही में देखे गए',
    addCart: 'कार्ट में जोड़ें', outStock: 'स्टॉक में नहीं', viewDetails: 'विवरण देखें',
    loading: 'पूजा सामग्री लोड हो रही है...', cart: 'मेरी शॉपिंग कार्ट',
    emptyCart: 'आपकी कार्ट खाली है', startShopping: 'खरीदारी शुरू करें',
    total: 'कुल', deliveryDetails: 'डिलीवरी विवरण', applyCoupon: 'कूपन लागू करें',
    giftOption: '🎁 उपहार के रूप में भेजें', invoice: 'पीडीएफ चालान डाउनलोड करें',
  },
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createOrderInvoiceHtml = (order: StoreOrder): string => {
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${Number(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${Number(item.line_total || 0).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice - Order #${escapeHtml(order.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1e293b; padding: 30px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #65BDF2; padding-bottom: 15px; }
    .brand { color: #42A5E8; font-size: 26px; font-weight: bold; }
    .title { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 25px; }
    th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 13px; color: #475569; }
    .summary { margin-top: 20px; float: right; width: 280px; font-size: 14px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #cbd5e1; padding-top: 8px; color: #166534; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PujariGo Samagri Store</div>
      <div style="font-size: 12px; color: #64748b;">Instant Vedic Rituals & Pure Samagri Delivery</div>
    </div>
    <div style="text-align: right;">
      <strong>Order ID:</strong> #${escapeHtml(order.id)}<br/>
      <strong>Date:</strong> ${escapeHtml(order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A')}<br/>
      <strong>Payment:</strong> ${escapeHtml(order.payment_status || 'Pending')} (${escapeHtml(order.payment_method || 'Online')})
    </div>
  </div>

 </div>

<div class="title">Order Invoice / Payment Receipt</div>

<div style="margin-top: 18px; padding: 12px; background: #f8fafc; border-radius: 6px;">
  <strong>Bill To:</strong><br/>
  ${escapeHtml(order.customer_name || 'Customer')}<br/>
  ${escapeHtml(order.delivery_address || 'Address not available')}<br/>
  ${escapeHtml(order.city || '')} - ${escapeHtml(order.pincode || '')}<br/>
  Phone: ${escapeHtml(order.customer_phone || 'N/A')}
</div>

<table>
  <thead>
    <tr>
      <th>Item Description</th>
      <th style="text-align: center;">Qty</th>
      <th style="text-align: right;">Price</th>
      <th style="text-align: right;">Total</th>
    </tr>
  </thead>
  <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-row"><span>Subtotal:</span> <span>₹${Number(order.product_subtotal || 0).toFixed(2)}</span></div>
    ${Number(order.discount_amount || 0) > 0 ? `<div class="summary-row" style="color: #166534;"><span>Discount:</span> <span>-₹${Number(order.discount_amount).toFixed(2)}</span></div>` : ''}
    <div class="summary-row"><span>Shipping Fee:</span> <span>₹${Number(order.shipping_fee || 0).toFixed(2)}</span></div>
    <div class="summary-row"><span>Platform Fee:</span> <span>₹${Number(order.platform_fee || 0).toFixed(2)}</span></div>
    <div class="summary-row"><span>COD Fee:</span> <span>₹${Number(order.cod_fee || 0).toFixed(2)}</span></div>
<div class="summary-row total-row">
  <span>${String(order.payment_status || '').toLowerCase() === 'paid' ? 'Total Paid:' : 'Order Total:'}</span>
  <span>₹${getOrderTotal(order).toFixed(2)}</span>
</div>
<div style="margin-top: 12px; font-weight: bold;">
  Payment Status: ${escapeHtml(order.payment_status || 'Pending')}
</div>
  </div>

  <div style="clear: both; margin-top: 50px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center;">
    Thank you for shopping with PujariGo! For support, contact PujariGo customer service.
  </div>
</body>
</html>`;
};

export default function CustomerStoreScreen() {
  const [language, setLanguage] = useState<StoreLanguage>('en');
  const t = (key: string) => STORE_TRANSLATIONS[language][key] || STORE_TRANSLATIONS.en[key] || key;

  const [products, setProducts] = useState<Product[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Feature Modals & States
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buyNowProduct, setBuyNowProduct] = useState<Product | null>(null);
const [buyNowShippingEstimate, setBuyNowShippingEstimate] = useState<number | null>(null);
  const [buyNowEstimateLoading, setBuyNowEstimateLoading] = useState(false);
const [buyNowEstimateError, setBuyNowEstimateError] = useState('');
const [buyNowLoading, setBuyNowLoading] = useState(false);

  // Gift & Coupon States
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientPhone, setGiftRecipientPhone] = useState('');
  const [giftAddress, setGiftAddress] = useState('');
  const [giftCity, setGiftCity] = useState('');
  const [giftPin, setGiftPin] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftWrapping, setGiftWrapping] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Chat States
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationKey, setActiveConversationKey] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Orders & Checkout
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [returnRequests, setReturnRequests] = useState<StoreReturn[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  // Return Request States
const [showReturnModal, setShowReturnModal] = useState(false);
const [selectedReturnOrder, setSelectedReturnOrder] = useState<any>(null);
const [selectedReturnItem, setSelectedReturnItem] = useState<any>(null);
const [returnReason, setReturnReason] = useState('');
const [returnQuantity, setReturnQuantity] = useState('1');
const [submittingReturn, setSubmittingReturn] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [shippingEstimate, setShippingEstimate] = useState<number | null>(null);
const [shippingEstimateLoading, setShippingEstimateLoading] = useState(false);
const [shippingEstimateError, setShippingEstimateError] = useState('');

  // Product Reviews & Ratings States
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [productReviews, setProductReviews] = useState<any[]>([]);

  const loadStoreData = useCallback(async () => {
    try {
      const [prodRes, favRes, recentRes] = await Promise.all([
        apiClient.get('/store/products'),
        apiClient.get('/store/favourites').catch(() => []),
        apiClient.get('/store/recently-viewed').catch(() => []),
      ]);

      const list = Array.isArray(prodRes) ? prodRes : prodRes?.products || [];
      setProducts(list.map((p: any) => ({ ...p, id: String(p.id || p._id) })));
      setFavourites((Array.isArray(favRes) ? favRes : []).map((f: any) => String(f.id || f._id)));
      setRecentlyViewed(Array.isArray(recentRes) ? recentRes : []);
    } catch (e: any) {
      console.warn('Failed to load store data:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  useEffect(() => {
  let active = true;

  const deliveryPin = (isGift ? giftPin : pincode).trim();

  if (Object.keys(cart).length === 0 || !/^\d{6}$/.test(deliveryPin)) {
    setShippingEstimate(null);
    setShippingEstimateError('');
    setShippingEstimateLoading(false);
    return;
  }

  const estimateShipping = async () => {
    setShippingEstimate(null);
    setShippingEstimateError('');
    setShippingEstimateLoading(true);

    try {
      const response = await apiClient.post('/store/shipping/estimate', {
        items: Object.values(cart).map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
        })),
        delivery_pincode: deliveryPin,
        payment_method: paymentMethod,
      });

      if (!active) return;

      const fee = Number(response?.shipping_fee);

      if (!Number.isFinite(fee) || fee < 0) {
        throw new Error('Delhivery returned an invalid delivery charge.');
      }

      setShippingEstimate(fee);
    } catch (error: any) {
      if (!active) return;

      setShippingEstimate(null);
      setShippingEstimateError(
        error?.response?.data?.detail ||
        error?.message ||
        'Could not calculate delivery charge. Please try again.'
      );
    } finally {
      if (active) setShippingEstimateLoading(false);
    }
  };

  estimateShipping();

  return () => {
    active = false;
  };
}, [cart, pincode, giftPin, isGift, paymentMethod]);

  // Separate delivery estimate for Buy Now
useEffect(() => {
  let active = true;

  const estimateBuyNowShipping = async () => {
    if (!buyNowProduct) {
      setBuyNowShippingEstimate(null);
      setBuyNowEstimateError('');
      setBuyNowEstimateLoading(false);
      return;
    }

    const deliveryPin = pincode.trim();

    if (!/^\d{6}$/.test(deliveryPin)) {
      setBuyNowShippingEstimate(null);
      setBuyNowEstimateError('Enter a valid 6-digit delivery PIN code.');
      return;
    }

    setBuyNowEstimateLoading(true);
    setBuyNowEstimateError('');

    try {
      const response = await apiClient.post('/store/shipping/estimate', {
        items: [
          {
            product_id: buyNowProduct.id,
            quantity: 1,
          },
        ],
        delivery_pincode: deliveryPin,
        payment_method: paymentMethod,
      });

      if (!active) return;

      const fee = Number(response?.shipping_fee);

      if (!Number.isFinite(fee) || fee < 0) {
        throw new Error('Delhivery returned an invalid delivery charge.');
      }

      setBuyNowShippingEstimate(fee);
    } catch (error: any) {
      if (!active) return;

      setBuyNowShippingEstimate(null);
      setBuyNowEstimateError(
        error?.response?.data?.detail ||
        error?.message ||
        'Could not calculate delivery charge.'
      );
    } finally {
      if (active) setBuyNowEstimateLoading(false);
    }
  };

  estimateBuyNowShipping();

  return () => {
    active = false;
  };
}, [buyNowProduct, pincode, paymentMethod]);

  // 1. ❤️ Favourites Toggle
  const toggleFavourite = async (productId: string) => {
    try {
      if (favourites.includes(productId)) {
        await apiClient.delete(`/store/favourites/${productId}`);
        setFavourites(favourites.filter((id) => id !== productId));
      } else {
        await apiClient.post(`/store/favourites/${productId}`, {});
        setFavourites([...favourites, productId]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update wishlist.');
    }
  };

  // Fetch reviews for selected product
  const fetchReviews = async (productId: string) => {
    try {
      const res = await apiClient.get(`/store/products/${productId}/reviews`);
      setProductReviews(Array.isArray(res) ? res : []);
    } catch (e) {
      setProductReviews([]);
    }
  };

  const submitReview = async (productId: string) => {
    try {
      await apiClient.post(`/store/products/${productId}/reviews`, {
        product_id: productId,
        rating: newRating,
        comment: newComment.trim(),
      });
      Alert.alert('Success', 'Thank you for your review!');
      setNewComment('');
      fetchReviews(productId);
      loadStoreData(); // Refresh product ratings
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit review.');
    }
  };

  // 6. 👀 Track Recently Viewed & Open Details
  const handleOpenProduct = async (product: Product) => {
    setSelectedProduct(product);
    fetchReviews(product.id);
    try {
      await apiClient.post('/store/recently-viewed', { product_id: product.id });
      const recent = await apiClient.get('/store/recently-viewed');
      setRecentlyViewed(Array.isArray(recent) ? recent : []);
    } catch (e) {
      // Ignore background tracking error
    }
  };

 
const handleApplyCoupon = async () => {
  if (!couponCode.trim()) {
    Alert.alert('Enter Coupon', 'Please enter a coupon code.');
    return;
  }

  if (Object.keys(cart).length === 0) {
    Alert.alert('Empty Cart', 'Add products before applying a coupon.');
    return;
  }

  try {
    const cartSubtotal = Object.values(cart).reduce(
      (sum, item) =>
        sum + Number(item.product.price) * item.quantity,
      0
    );

    const res = await apiClient.post('/store/coupons/validate', {
      code: couponCode.trim().toUpperCase(),
      subtotal: cartSubtotal,
    });

    if (res?.valid && res?.coupon) {
      setAppliedCoupon(res.coupon);
      setCouponCode(res.coupon.code);
      setDiscountAmount(Number(res.discount_amount || 0));

      Alert.alert(
        'Success',
        `Coupon ${res.coupon.code} applied successfully!`
      );
    } else {
      setAppliedCoupon(null);
      setDiscountAmount(0);

      Alert.alert(
        'Invalid Coupon',
        res?.message || 'This coupon is not valid.'
      );
    }
  } catch (e: any) {
    setAppliedCoupon(null);
    setDiscountAmount(0);

    Alert.alert(
      'Invalid Coupon',
      e?.message || 'Could not apply coupon.'
    );
  }
};

const removeCoupon = () => {
  setAppliedCoupon(null);
  setDiscountAmount(0);
  setCouponCode('');
  Alert.alert('Coupon Removed', 'Your coupon has been removed.');
};


  // 2. 💬 Chat Conversations & Messages
  const loadConversations = async () => {
    try {
      const res = await apiClient.get('/store/chat/conversations');
      setConversations(Array.isArray(res) ? res : []);
    } catch (e) {
      setConversations([]);
    }
  };

  const openConversation = async (key: string) => {
    setActiveConversationKey(key);
    try {
      const msgs = await apiClient.get(`/store/chat/messages/${key}`);
      setChatMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      setChatMessages([]);
    }
  };

  
const sendChatMessage = async () => {
  const messageText = chatInput.trim();

  if (!messageText) return;

  try {
    if (activeConversationKey && activeConversationKey !== 'new') {
      // Send a reply to an existing conversation
      await apiClient.post(
        `/store/chat/messages/${encodeURIComponent(activeConversationKey)}/reply`,
        {
          message: messageText,
        }
      );

      setChatInput('');
      await openConversation(activeConversationKey);
    } else {
      // Create a new conversation with Admin
      const response = await apiClient.post('/store/chat/messages', {
        recipient_type: 'admin',
        message: messageText,
      });

      const newConversationKey =
        response?.conversation_key || response?.data?.conversation_key;

      if (!newConversationKey) {
        throw new Error('Message sent, but conversation ID was not returned.');
      }

      setChatInput('');
      setActiveConversationKey(newConversationKey);

      await openConversation(newConversationKey);
      await loadConversations();
    }
  } catch (e: any) {
    Alert.alert(
      'Error',
      e?.message || 'Could not send message.'
    );
  }
};

  // 5. 🧾 Download PDF Invoice / Receipt
  const downloadOrderInvoice = async (order: StoreOrder) => {
    try {
      const html = createOrderInvoiceHtml(order);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice #${order.id}`,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not generate invoice PDF.');
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await apiClient.get('/store/orders/my-orders');
      setOrders(Array.isArray(res) ? res : []);
    } catch (e) {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };
  const loadReturnRequests = async () => {
  setLoadingReturns(true);

  try {
    const res = await apiClient.get('/store/customer/returns');
    setReturnRequests(Array.isArray(res) ? res : []);
  } catch (error: any) {
    setReturnRequests([]);
    Alert.alert(
      'Error',
      error?.message || 'Could not load return requests.'
    );
  } finally {
    setLoadingReturns(false);
  }
};
  const submitReturnRequest = async () => {
  if (!selectedReturnOrder || !selectedReturnItem) return;

  if (returnReason.trim().length < 5) {
    Alert.alert('Reason Required', 'Please enter at least 5 characters.');
    return;
  }

  const quantity = Number(returnQuantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > Number(selectedReturnItem.quantity || 0)
  ) {
    Alert.alert('Invalid Quantity', 'Please enter a valid return quantity.');
    return;
  }

  try {
    setSubmittingReturn(true);

    await apiClient.post('/store/returns/request', {
      order_id: getOrderId(selectedReturnOrder),
      product_id: String(
        selectedReturnItem.product_id || selectedReturnItem.id
      ),
      quantity,
      reason: returnReason.trim(),
    });

    Alert.alert('Success', 'Your return request has been submitted.');

    setShowReturnModal(false);
    setSelectedReturnOrder(null);
    setSelectedReturnItem(null);
    setReturnReason('');
    setReturnQuantity('1');

await Promise.all([
  loadOrders(),
  loadReturnRequests(),
]);
  } catch (e: any) {
    Alert.alert(
      'Return Request Failed',
      e?.message || 'Could not submit your return request.'
    );
  } finally {
    setSubmittingReturn(false);
  }
};

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || product.name?.toLowerCase().includes(query) || product.category?.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'All' || product.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

 const cartItems = Object.values(cart);

const subtotal = cartItems.reduce(
  (sum, item) => sum + Number(item.product.price) * item.quantity,
  0
);

const shippingFee = shippingEstimate ?? 0;

const platformFee = Math.round(subtotal * 0.02);

const total =
  Math.max(0, subtotal - discountAmount) +
  shippingFee +
  platformFee;

  const checkoutSubtotal = buyNowProduct
  ? Number(buyNowProduct.price)
  : subtotal;

const checkoutShippingFee = buyNowProduct
  ? (buyNowShippingEstimate ?? 0)
  : shippingFee;

const checkoutDiscount = buyNowProduct ? 0 : discountAmount;

const checkoutPlatformFee = Math.round(checkoutSubtotal * 0.02);

const checkoutTotal =
  Math.max(0, checkoutSubtotal - checkoutDiscount) +
  checkoutShippingFee +
  checkoutPlatformFee;

const checkoutShippingReady = buyNowProduct
  ? buyNowShippingEstimate !== null && !buyNowEstimateLoading
  : shippingEstimate !== null && !shippingEstimateLoading;

const itemCount = cartItems.reduce(
  (sum, item) => sum + item.quantity,
  0
);

const updateQuantity = (product: Product, change: number) => {
  if (appliedCoupon) {
  setAppliedCoupon(null);
  setDiscountAmount(0);
  setCouponCode('');
}
    setCart((prev) => {
      const cur = prev[product.id]?.quantity || 0;
      const next = cur + change;
      const updated = { ...prev };
      if (next <= 0) delete updated[product.id];
      else updated[product.id] = { product, quantity: next };
      return updated;
    });
  };

  const placeOrder = async () => {
    const checkoutItems = buyNowProduct
  ? [{ product: buyNowProduct, quantity: 1 }]
  : cartItems;

if (checkoutItems.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim() || !address.trim() || !city.trim() || !pincode.trim()) {
      Alert.alert('Missing Details', 'Please fill in all delivery details.');
      return;
    }

    setPlacingOrder(true);
    try {
      const orderPayload: any = {
        items: checkoutItems.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
    })),
        payment_method: paymentMethod,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        coupon_code: !buyNowProduct && appliedCoupon ? appliedCoupon.code : undefined,
        is_gift: buyNowProduct ? false : isGift,
        gift_recipient_name: !buyNowProduct && isGift ? giftRecipientName.trim() : undefined,
        gift_recipient_phone: !buyNowProduct && isGift ? giftRecipientPhone.trim() : undefined,
        gift_delivery_address: !buyNowProduct && isGift ? giftAddress.trim() : undefined,
        gift_delivery_city: !buyNowProduct && isGift ? giftCity.trim() : undefined,
        gift_delivery_pincode: !buyNowProduct && isGift ? giftPin.trim() : undefined,
        gift_message: !buyNowProduct && isGift ? giftMessage.trim() : undefined,
        gift_wrapping: !buyNowProduct && isGift ? giftWrapping : false,
      };

      const orderRes = await apiClient.post('/store/orders', orderPayload);
      const storeOrderId = getOrderId(orderRes);

      if (paymentMethod === 'cod') {
  if (!buyNowProduct) {
    setCart({});
  }

  setBuyNowProduct(null);
  setShowCart(false);

  Alert.alert(
    'Order Placed',
    `Order ID: ${storeOrderId}\nPay ₹${checkoutTotal.toFixed(2)} on delivery.`
  );
  return;
}
      const payOrder = await apiClient.post('/store/payment/create-order', { store_order_id: storeOrderId });
      const payRes = await openRazorpayCheckout({
        key: payOrder.key_id,
        amount: String(payOrder.amount),
        currency: payOrder.currency || 'INR',
        name: 'PujariGo Samagri',
        description: 'Puja Samagri Store Order',
        order_id: payOrder.razorpay_order_id,
        prefill: { name: customerName.trim(), contact: customerPhone.trim() },
        theme: { color: DARK_BLUE },
      });

      await apiClient.post('/store/payment/verify', {
        store_order_id: storeOrderId,
        razorpay_order_id: payRes.razorpay_order_id,
        razorpay_payment_id: payRes.razorpay_payment_id,
        razorpay_signature: payRes.razorpay_signature,
      });

     if (!buyNowProduct) {
  setCart({});
}
setBuyNowProduct(null);
setShowCart(false);
      Alert.alert('Payment Successful!', `Order #${storeOrderId} placed successfully.`);
    } catch (e: any) {
      Alert.alert('Order Error', e?.message || 'Could not complete order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStoreData(); }} />}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: DARK_BLUE }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={{ color: '#FFF', fontSize: 28 }}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>PujariGo Store</Text>
              <Text style={styles.headerSubtitle}>{t('tagline')}</Text>
            </View>
            <NotificationBell />
            <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
              {(['en', 'kn', 'hi'] as StoreLanguage[]).map((lang) => (
                <TouchableOpacity key={lang} onPress={() => setLanguage(lang)} style={[styles.langChip, language === lang && styles.langChipActive]}>
                  <Text style={[styles.langText, language === lang && styles.langTextActive]}>{lang.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={{ fontSize: 20, marginRight: 8 }}>⌕</Text>
            <TextInput style={styles.searchInput} placeholder={t('search')} placeholderTextColor="#777" value={search} onChangeText={setSearch} />
          </View>
        </View>

        {/* Quick Action Bar */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setShowWishlist(true)}>
            <Text style={{ fontSize: 20 }}>❤️</Text>
            <Text style={styles.quickText}>{t('favourites')} ({favourites.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => { setShowChat(true); loadConversations(); }}>
            <Text style={{ fontSize: 20 }}>💬</Text>
            <Text style={styles.quickText}>{t('chat')}</Text>
          </TouchableOpacity>
         <TouchableOpacity
  style={styles.quickBtn}
  onPress={() => {
    setShowOrders(true);
    loadOrders();
    loadReturnRequests();
  }}
>
            <Text style={{ fontSize: 20 }}>📦</Text>
            <Text style={styles.quickText}>{t('myOrders')}</Text>
          </TouchableOpacity>
        </View>

        {/* Wishlist Modal */}
        <Modal visible={showWishlist} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>❤️ My Wishlist</Text>
              <ScrollView style={{ maxHeight: 350 }}>
                {favourites.length === 0 ? (
                  <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No items in wishlist</Text>
                ) : (
                  products.filter((p) => favourites.includes(p.id)).map((p) => (
                    <View key={p.id} style={styles.wishlistRow}>
                      <Text style={{ flex: 1, fontWeight: '600' }}>{p.name}</Text>
                      <Text style={{ fontWeight: 'bold', color: '#166534', marginRight: 10 }}>₹{p.price}</Text>
                      <TouchableOpacity onPress={() => toggleFavourite(p.id)}><Text style={{ color: 'red' }}>Remove</Text></TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
      
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowWishlist(false)}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Chat Modal */}
        <Modal visible={showChat} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentLarge}>
              <Text style={styles.modalTitle}>💬 PujariGo Support & Seller Chat</Text>
              {!activeConversationKey ? (
                <ScrollView style={{ maxHeight: 300 }}>
                  <TouchableOpacity
  style={styles.startChatBtn}
  onPress={() => {
    setChatMessages([]);
    setChatInput('');
    setActiveConversationKey('new');
  }}
>
  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
    Chat with Admin / Support
  </Text>
</TouchableOpacity>
                  {conversations.map((c) => (
                    <TouchableOpacity key={c.conversation_key} style={styles.chatConvItem} onPress={() => openConversation(c.conversation_key)}>
                      <Text style={{ fontWeight: 'bold' }}>Conversation #{c.conversation_key.slice(-6)}</Text>
                      <Text numberOfLines={1} style={{ color: '#666' }}>{c.last_message}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, maxHeight: 300 }}>
                  <TouchableOpacity onPress={() => setActiveConversationKey(null)}><Text style={{ color: BLUE, marginBottom: 8 }}>‹ Back to Chats</Text></TouchableOpacity>
                  <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                    {chatMessages.map((m) => (
                      <View key={m.id} style={[styles.chatBubble, m.sender_role === 'customer' ? styles.chatBubbleUser : styles.chatBubbleOther]}>
                        <Text style={{ fontSize: 13, color: '#1E293B' }}>{m.message}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                    <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} placeholder="Type a message..." value={chatInput} onChangeText={setChatInput} />
                    <TouchableOpacity style={styles.sendBtn} onPress={sendChatMessage}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Send</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              <TouchableOpacity style={[styles.closeBtn, { marginTop: 12 }]} onPress={() => setShowChat(false)}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        
{/* My Orders Modal */}
<Modal
  visible={showOrders}
  animationType="slide"
  transparent
  onRequestClose={() => setShowOrders(false)}
>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContentLarge, { maxHeight: '85%' }]}>
      <Text style={styles.modalTitle}>📦 My Orders</Text>

      {loadingOrders ? (
        <ActivityIndicator size="large" color={DARK_BLUE} />
      ) : orders.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#64748B', padding: 20 }}>
          You have not placed any orders yet.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: 480 }}>
          {orders.map((order) => (
            <View key={getOrderId(order)} style={styles.orderCard}>
              <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
                Order #{getOrderId(order)}
              </Text>

              <Text style={{ marginTop: 5 }}>
                Date: {order.created_at
                  ? new Date(order.created_at).toLocaleDateString()
                  : 'N/A'}
              </Text>

              <Text style={{ marginTop: 4 }}>
                Status: {order.order_status || 'Order Placed'}
              </Text>

              <Text style={{ marginTop: 4 }}>
                Payment: {order.payment_status || 'Pending'}
              </Text>

              <Text style={{ fontWeight: 'bold', marginTop: 6 }}>
                Total: ₹{getOrderTotal(order).toFixed(2)}
              </Text>

              {(order.items || []).map((item: any, index: number) => (
                <View
                  key={`${item.product_id || index}`}
                  style={{
                    borderTopWidth: 1,
                    borderColor: '#E2E8F0',
                    marginTop: 10,
                    paddingTop: 8,
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>
                    {item.name} × {item.quantity}
                  </Text>

                  <Text>₹{Number(item.line_total || 0).toFixed(2)}</Text>

                  {order.order_status === 'Delivered' &&
                    item.is_returnable === true && (
                      <TouchableOpacity
                        style={styles.invoiceBtn}
                        onPress={() => {
                          setSelectedReturnOrder(order);
                          setSelectedReturnItem(item);
                          setReturnReason('');
                          setReturnQuantity('1');
                          setShowReturnModal(true);
                        }}
                      >
                        <Text style={{ color: DARK_BLUE, fontWeight: 'bold' }}>
                          Request Return
                        </Text>
                      </TouchableOpacity>
                    )}
                </View>
              ))}

              {order.tracking_url ? (
                <TouchableOpacity
                  style={styles.invoiceBtn}
                  onPress={() => Linking.openURL(order.tracking_url!)}
                >
                  <Text style={{ color: DARK_BLUE, fontWeight: 'bold' }}>
                    Track Order
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.invoiceBtn}
                onPress={() => downloadOrderInvoice(order)}
              >
                <Text style={{ color: DARK_BLUE, fontWeight: 'bold' }}>
                  Download Invoice / Receipt
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* My Return Requests */}
<View style={{ marginTop: 15, maxHeight: 220 }}>
  <Text style={styles.sectionHeading}>My Return Requests</Text>

  {loadingReturns ? (
    <ActivityIndicator size="small" color={DARK_BLUE} />
  ) : returnRequests.length === 0 ? (
    <Text style={{ color: '#64748B', padding: 10 }}>
      No return requests yet.
    </Text>
  ) : (
    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
      {returnRequests.map((item) => (
        <View key={item.id} style={styles.orderCard}>
          <Text style={{ fontWeight: 'bold' }}>
            {item.product_name || 'Product'} × {item.quantity || 1}
          </Text>

          <Text>Request status: {item.status || 'Pending'}</Text>
          <Text>Pickup status: {item.reverse_status || 'Not started'}</Text>

          {item.reverse_waybill ? (
            <Text>Tracking number: {item.reverse_waybill}</Text>
          ) : null}

          {item.reverse_tracking_url ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.reverse_tracking_url!)}
            >
              <Text style={{ color: DARK_BLUE, fontWeight: 'bold' }}>
                Track Return
              </Text>
            </TouchableOpacity>
          ) : null}

          {item.review_note ? (
            <Text>Review note: {item.review_note}</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  )}
</View>

{/* Close Button */}
<TouchableOpacity
  style={styles.closeBtn}
  onPress={() => setShowOrders(false)}
>
  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Close</Text>
</TouchableOpacity>
    </View>
  </View>
</Modal>


        {/* Recently Viewed Strip */}
        {recentlyViewed.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>👀 {t('recentlyViewed')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recentlyViewed.map((p) => (
                <TouchableOpacity key={`recent-${p.id}`} style={styles.miniCard} onPress={() => handleOpenProduct(p)}>
                  <Image source={{ uri: p.image_url || 'https://via.placeholder.com/100' }} style={{ width: 80, height: 80, borderRadius: 6 }} resizeMode="contain" />
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', marginTop: 4 }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>₹{p.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Main Product Grid */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionHeading}>{t('shopCategory')}</Text>
          <View style={styles.grid}>
            {filteredProducts.map((p) => {
              const isFav = favourites.includes(p.id);
              return (
                <View key={p.id} style={styles.productCard}>
                  <TouchableOpacity onPress={() => toggleFavourite(p.id)} style={styles.favIcon}>
                    <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleOpenProduct(p)}>
                    <Image source={{ uri: p.image_url || 'https://via.placeholder.com/150' }} style={styles.productImg} resizeMode="contain" />
                    <Text numberOfLines={2} style={styles.productTitle}>{p.name}</Text>
                    
                    {/* Star Rating Display on Product Card */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 3 }}>
                      <Text style={{ color: '#F59E0B', fontSize: 12 }}>★</Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 3 }}>
                        {p.average_rating ? p.average_rating.toFixed(1) : 'No reviews'} ({p.review_count || 0})
                      </Text>
                    </View>

                    <Text style={styles.productPrice}>₹{p.price}</Text>
                    <Text
  style={{
    fontSize: 10,
    color: p.is_returnable ? '#16803D' : '#D92D20',
    marginTop: 3,
  }}
>
  {p.is_returnable ? '7-day returns' : 'Non-returnable'}
</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addCartBtn} onPress={() => updateQuantity(p, 1)}>
                    <Text style={{ color: BLUE, fontWeight: 'bold', fontSize: 11 }}>{t('addCart')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Product Details & Reviews Modal */}
        <Modal
          visible={selectedProduct !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedProduct(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
              <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>
                <TouchableOpacity onPress={() => setSelectedProduct(null)} style={{ alignSelf: 'flex-end', padding: 8 }}>
                  <Text style={{ fontSize: 24, color: '#333' }}>✕</Text>
                </TouchableOpacity>

                {selectedProduct?.image_url ? (
                  <Image source={{ uri: selectedProduct.image_url }} style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F1F3F6' }} resizeMode="contain" />
                ) : null}

                <Text style={{ fontSize: 22, fontWeight: '700', color: '#222', marginTop: 12 }}>{selectedProduct?.name}</Text>
                <Text style={{ color: '#166534', fontSize: 20, fontWeight: '700', marginTop: 6 }}>₹{Number(selectedProduct?.price || 0).toFixed(2)}</Text>
                <Text
  style={{
    fontSize: 13,
    color: selectedProduct?.is_returnable ? '#16803D' : '#D92D20',
    marginTop: 6,
    fontWeight: '600',
  }}
>
  {selectedProduct?.is_returnable
    ? 'Returnable within 7 days after delivery'
    : 'This product is non-returnable'}
</Text>

                <Text style={{ fontSize: 15, color: '#444', marginTop: 10, lineHeight: 20 }}>
                  {selectedProduct?.description?.trim() || 'No description has been added for this product yet.'}
                </Text>
      {/* Buy Now Button */}
<TouchableOpacity
  style={{
    backgroundColor: '#2874F0',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  }}
  disabled={
    !selectedProduct ||
    selectedProduct.stock === 0 ||
    selectedProduct.is_available === false
  }
  onPress={() => {
    if (!selectedProduct) return;

    setBuyNowProduct(selectedProduct);
    setBuyNowShippingEstimate(null);
    setBuyNowEstimateError('');
    setSelectedProduct(null);
    setShowCart(true);
  }}
>
  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
    BUY NOW
  </Text>
</TouchableOpacity>

                {/* Customer Reviews Section */}
                <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Customer Reviews</Text>
                  {productReviews.length === 0 ? (
                    <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 12 }}>No reviews yet. Be the first to review!</Text>
                  ) : (
                    productReviews.map((rev) => (
                      <View key={rev.id} style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{rev.customer_name}</Text>
                          <Text style={{ color: '#F59E0B', fontSize: 12 }}>{'★'.repeat(rev.rating)}</Text>
                        </View>
                        {rev.comment ? <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{rev.comment}</Text> : null}
                      </View>
                    ))
                  )}

                  <Text style={{ fontSize: 14, fontWeight: 'bold', marginTop: 12, marginBottom: 6 }}>Write a Review</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setNewRating(star)}>
                        <Text style={{ fontSize: 24, color: star <= newRating ? '#F59E0B' : '#CBD5E1' }}>★</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, padding: 10, backgroundColor: '#FFF', minHeight: 60, textAlignVertical: 'top' }}
                    placeholder="Share your experience..."
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#2874F0', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 8 }}
                    onPress={() => selectedProduct && submitReview(selectedProduct.id)}
                  >
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Submit Review</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Cart / Checkout Modal */}
        <Modal visible={showCart} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F3FAFF', padding: 16 }}>
            <TouchableOpacity onPress={() => setShowCart(false)}><Text style={{ color: BLUE, fontWeight: 'bold', fontSize: 16 }}>‹ Back to Store</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{t('cart')}</Text>
            <ScrollView style={{ flex: 1 }}>
              {buyNowProduct ? (
  <View key={buyNowProduct.id} style={styles.cartRow}>
    <Text style={{ flex: 1, fontWeight: '600' }}>
      {buyNowProduct.name} (x1)
    </Text>
    <Text style={{ fontWeight: 'bold' }}>
      ₹{Number(buyNowProduct.price).toFixed(2)}
    </Text>
  </View>
) : (
  cartItems.map(({ product, quantity }) => (
    <View key={product.id} style={styles.cartRow}>
      <Text style={{ flex: 1, fontWeight: '600' }}>
        {product.name} (x{quantity})
      </Text>
      <Text style={{ fontWeight: 'bold' }}>
        ₹{product.price * quantity}
      </Text>
    </View>
  ))
)}
              {/* 🎁 Gift Store & Delivery Options */}
              <TouchableOpacity style={styles.giftToggle} onPress={() => setIsGift(!isGift)}>
                <Text style={{ fontWeight: 'bold', color: '#B45309' }}>{isGift ? '☑' : '☐'} {t('giftOption')}</Text>
              </TouchableOpacity>

              {isGift && (
                <View style={styles.giftBox}>
                  <TextInput style={styles.input} placeholder="Recipient Name" value={giftRecipientName} onChangeText={setGiftRecipientName} />
                  <TextInput style={styles.input} placeholder="Recipient Phone" value={giftRecipientPhone} onChangeText={setGiftRecipientPhone} keyboardType="phone-pad" />
                  <TextInput style={styles.input} placeholder="Gift Delivery Address" value={giftAddress} onChangeText={setGiftAddress} />
                  <TextInput style={styles.input} placeholder="City" value={giftCity} onChangeText={setGiftCity} />
                  <TextInput style={styles.input} placeholder="6-digit PIN Code" value={giftPin} onChangeText={setGiftPin} maxLength={6} keyboardType="number-pad" />
                  <TextInput style={styles.input} placeholder="Gift Message on Card" value={giftMessage} onChangeText={setGiftMessage} />
                </View>
              )}

              {/* 🏷️ Coupons and Discounts */}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} placeholder="Enter Coupon Code" value={couponCode}onChangeText={(value) => {
  setCouponCode(value);

  if (appliedCoupon) {
    setAppliedCoupon(null);
    setDiscountAmount(0);
  }
}} autoCapitalize="characters" />
                <TouchableOpacity style={styles.applyCouponBtn} onPress={handleApplyCoupon}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
              </View>
             {appliedCoupon && (
  <View style={{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  }}>
    <Text style={{ color: '#166534', flex: 1, fontSize: 12 }}>
      Applied: {appliedCoupon.description || appliedCoupon.code} (-₹{discountAmount.toFixed(2)})
    </Text>

    <TouchableOpacity onPress={removeCoupon}>
      <Text style={{ color: '#B91C1C', fontWeight: 'bold' }}>
        Remove
      </Text>
    </TouchableOpacity>
  </View>
)}

              {/* Delivery Details */}
              <Text style={[styles.sectionHeading, { marginTop: 16 }]}>{t('deliveryDetails')}</Text>
              <TextInput style={styles.input} placeholder="Your Name" value={customerName} onChangeText={setCustomerName} />
              <TextInput style={styles.input} placeholder="Mobile Number" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" maxLength={10} />
              <TextInput style={styles.input} placeholder="Delivery Address" value={address} onChangeText={setAddress} />
              <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
              <TextInput style={styles.input} placeholder="PIN Code" value={pincode} onChangeText={setPincode} maxLength={6} keyboardType="number-pad" />

              {/* Payment Method Selector */}
              <Text style={[styles.sectionHeading, { marginTop: 16 }]}>Payment Method</Text>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'online' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('online')}
              >
                <Text style={styles.paymentOptionText}>💳 Pay Online (UPI / Razorpay)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('cod')}
              >
                <Text style={styles.paymentOptionText}>💵 Cash on Delivery (COD)</Text>
              </TouchableOpacity>

              {/* Checkout Calculation Summary */}
<View style={styles.summaryBox}>
  <View style={styles.summaryRow}>
    <Text>Product Subtotal:</Text>
    <Text>₹{checkoutSubtotal.toFixed(2)}</Text>
  </View>

  {checkoutDiscount > 0 && (
    <View style={styles.summaryRow}>
      <Text>Coupon Discount:</Text>
      <Text>-₹{checkoutDiscount.toFixed(2)}</Text>
    </View>
  )}

  <View style={styles.summaryRow}>
    <Text>Delivery Charge:</Text>
    <Text>
      {buyNowProduct
        ? buyNowEstimateLoading
          ? 'Calculating...'
          : buyNowShippingEstimate === null
            ? 'Not available'
            : `₹${checkoutShippingFee.toFixed(2)}`
        : `₹${checkoutShippingFee.toFixed(2)}`}
    </Text>
  </View>

  <View style={styles.summaryRow}>
    <Text>Platform Fee:</Text>
    <Text>₹{checkoutPlatformFee.toFixed(2)}</Text>
  </View>

  <View style={[styles.summaryRow, {
    borderTopWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 6,
    paddingTop: 6,
  }]}>
    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Final Amount:</Text>
    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#166534' }}>
      ₹{checkoutTotal.toFixed(2)}
    </Text>
  </View>

  {buyNowEstimateError ? (
    <Text style={{ color: '#DC2626', marginTop: 8 }}>
      {buyNowEstimateError}
    </Text>
  ) : null}
</View>

             <TouchableOpacity
  style={[
    styles.checkoutBtn,
    (placingOrder || !checkoutShippingReady) && { opacity: 0.5 },
  ]}
  disabled={placingOrder || !checkoutShippingReady}
  onPress={placeOrder}
>
  {placingOrder ? (
    <ActivityIndicator color="#FFF" />
  ) : (
    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>
      {paymentMethod === 'cod' ? 'Place COD Order' : 'Confirm & Pay'} ₹{checkoutTotal.toFixed(2)}
    </Text>
  )}
</TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        

{/* Return Request Modal */}
<Modal
  visible={showReturnModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowReturnModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Request Product Return</Text>

      <Text>
        Product: {selectedReturnItem?.product_name ||
          selectedReturnItem?.name ||
          selectedReturnItem?.title ||
          'Selected Product'}
      </Text>

      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>
        Return Quantity
      </Text>

      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={returnQuantity}
        onChangeText={setReturnQuantity}
        placeholder="Enter quantity"
      />

      <Text style={{ fontWeight: 'bold', marginTop: 12 }}>
        Reason for Return
      </Text>

      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
        multiline
        value={returnReason}
        onChangeText={setReturnReason}
        placeholder="Explain your reason"
      />

      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
        Returns are allowed within 7 days of delivery for eligible products.
      </Text>

      <TouchableOpacity
        style={styles.closeBtn}
        disabled={submittingReturn}
        onPress={submitReturnRequest}
      >
        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
          {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowReturnModal(false)}
        style={{ padding: 10, alignItems: 'center' }}
      >
        <Text>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

</ScrollView>

      {/* Bottom Cart Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>₹{total.toFixed(2)}</Text>
          <Text style={{ fontSize: 10, color: '#666' }}>{itemCount} items</Text>
        </View>
        <TouchableOpacity style={styles.viewCartBarBtn} onPress={() => setShowCart(true)}>
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>VIEW CART ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3FAFF' },
  content: { paddingBottom: 90 },
  header: { padding: 16, paddingTop: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backButton: { width: 36, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: '#E7EEFF', fontSize: 10 },
  langChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  langChipActive: { backgroundColor: '#FFF' },
  langText: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },
  langTextActive: { color: DARK_BLUE },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 10, height: 42 },
  searchInput: { flex: 1, fontSize: 14 },
  quickActions: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 10, justifyContent: 'space-around', marginBottom: 8 },
  quickBtn: { alignItems: 'center', flex: 1 },
  quickText: { fontSize: 11, fontWeight: '700', color: DARK_BLUE, marginTop: 2 },
  sectionContainer: { backgroundColor: '#FFF', padding: 12, marginBottom: 8 },
  sectionHeading: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  miniCard: { width: 90, marginRight: 10, alignItems: 'center', backgroundColor: '#F8FAFC', padding: 6, borderRadius: 8 },
  productsSection: { backgroundColor: '#FFF', padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  productCard: { width: '48%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, position: 'relative', marginBottom: 8 },
  favIcon: { position: 'absolute', top: 6, right: 6, zIndex: 2 },
  productImg: { width: '100%', height: 120, marginBottom: 6 },
  productTitle: { fontSize: 12, fontWeight: '600', height: 32 },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#166534', marginTop: 4 },
  addCartBtn: { marginTop: 6, padding: 6, borderWidth: 1, borderColor: BLUE, borderRadius: 4, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 16 },
  modalContentLarge: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, height: '70%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  closeBtn: { backgroundColor: DARK_BLUE, padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 12 },
  wishlistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  startChatBtn: { backgroundColor: '#16A34A', padding: 12, borderRadius: 6, alignItems: 'center', marginBottom: 10 },
  chatConvItem: { padding: 10, backgroundColor: '#F8FAFC', borderRadius: 6, marginBottom: 6 },
  chatBubble: { padding: 8, borderRadius: 8, marginVertical: 4, maxWidth: '80%' },
  chatBubbleUser: { backgroundColor: '#DCFCE7', alignSelf: 'flex-end' },
  chatBubbleOther: { backgroundColor: '#E2E8F0', alignSelf: 'flex-start' },
  sendBtn: { backgroundColor: BLUE, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 6 },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  giftToggle: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 6, marginTop: 10 },
  giftBox: { backgroundColor: '#FFFBEB', padding: 10, borderRadius: 6, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, padding: 10, marginTop: 8, backgroundColor: '#FFF' },
  applyCouponBtn: { backgroundColor: '#16A34A', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 6 },
  summaryBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginTop: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  paymentOption: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, marginTop: 8, backgroundColor: '#FFF' },
  paymentOptionSelected: { borderColor: BLUE, backgroundColor: '#EBF8FF' },
  paymentOptionText: { fontWeight: '600', color: '#1E293B' },
  checkoutBtn: { backgroundColor: '#166534', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  orderCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginBottom: 10 },
  invoiceBtn: { marginTop: 8, backgroundColor: GOLD, padding: 8, borderRadius: 6, alignItems: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewCartBarBtn: { backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
});
 
