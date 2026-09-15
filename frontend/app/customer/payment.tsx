// frontend/app/customer/payment.tsx
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

export default function PaymentWebScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const bookingId = params.bookingId as string;
  const orderId = params.orderId as string;
  const amount = params.amount as string;
  const currency = params.currency as string;
  const keyId = params.keyId as string;
  const customerName = params.customerName as string;
  const customerPhone = params.customerPhone as string;
  const description = params.description as string;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { text-align: center; padding: 40px 20px; }
    .amount { font-size: 32px; font-weight: bold; color: #FF6B35; margin: 12px 0; }
    .label { color: #666; font-size: 14px; }
    button { background: #FF6B35; color: white; border: 0; border-radius: 10px; padding: 14px 32px; font-size: 16px; font-weight: 600; margin-top: 24px; cursor: pointer; }
    .loading { color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="label">Total Amount</div>
    <div class="amount">₹${(parseInt(amount) / 100).toFixed(2)}</div>
    <button id="pay-btn" onclick="startPayment()">Pay Now</button>
    <div id="status" class="loading"></div>
  </div>
  <script>
    function postMsg(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }
    function startPayment() {
      document.getElementById('pay-btn').style.display = 'none';
      document.getElementById('status').innerText = 'Opening Razorpay...';
      var options = {
        key: '${keyId}',
        amount: '${amount}',
        currency: '${currency}',
        name: 'Book Your Pujari',
        description: '${description.replace(/'/g, "\\'")}',
        order_id: '${orderId}',
        prefill: {
          email: '${customerPhone}@bookyourpujari.com',
          name: '${customerName.replace(/'/g, "\\'")}',
          contact: '${customerPhone}'
        },
        theme: { color: '#FF6B35' },
        handler: function(response) {
          postMsg({
            event: 'success',
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          });
        },
        modal: {
          ondismiss: function() { postMsg({ event: 'dismiss' }); }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(response) {
        postMsg({ event: 'failed', code: response.error.code, description: response.error.description });
      });
      rzp.open();
    }
    window.addEventListener('load', function() { setTimeout(startPayment, 500); });
  </script>
</body>
</html>
  `;

  const handleMessage = async (event: any) => {
    if (processing) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'success') {
        setProcessing(true);
        try {
          await apiClient.post('/payment/verify', {
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_order_id: data.razorpay_order_id,
            razorpay_signature: data.razorpay_signature,
            booking_id: bookingId,
          });
          Alert.alert('Booking Confirmed!', 'Your pooja has been booked successfully.',
            [{ text: 'OK', onPress: () => router.replace('/customer/bookings') }]);
        } catch (error: any) {
          Alert.alert('Payment Verification Failed', error.message,
            [{ text: 'OK', onPress: () => router.back() }]);
        }
      } else if (data.event === 'failed') {
        Alert.alert('Payment Failed', data.description || 'Payment could not be processed.',
          [{ text: 'OK', onPress: () => router.back() }]);
      } else if (data.event === 'dismiss') {
        Alert.alert('Payment Cancelled', 'You cancelled the payment.',
          [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (e) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1 }}>
        <WebView ref={webViewRef} originWhitelist={['*']} source={{ html }}
          onMessage={handleMessage} onLoadEnd={() => setLoading(false)}
          javaScriptEnabled domStorageEnabled startInLoadingState style={{ flex: 1 }} />
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Loading Razorpay...</Text>
          </View>
        )}
        {processing && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Verifying payment...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 15 },
});
