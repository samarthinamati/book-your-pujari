// frontend/app/customer/booking.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { openRazorpayCheckout } from '@/src/utils/razorpay';

export default function BookingScreen() {
  const { saintId, poojaName } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [saint, setSaint] = useState<any>(null);
  const [selectedPooja, setSelectedPooja] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [bookingDate, setBookingDate] = useState(new Date());
  const [bookingTime, setBookingTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');

  useEffect(() => { fetchSaintDetails(); }, [saintId]);

  const fetchSaintDetails = async () => {
    try {
      const data = await apiClient.get(`/saints/${saintId}`);
      setSaint(data);
      const pooja = data.poojas.find(
        (p: any) => p.name === decodeURIComponent(poojaName as string)
      );
      setSelectedPooja(pooja);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load saint details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedPooja) return { base: 0, commission: 0, total: 0 };
    const base = selectedPooja.price;
    const commission = Math.round(base * 0.10);
    const total = Math.round(base + commission);
    return { base, commission, total };
  };

  const handleBooking = async () => {
    if (!address.trim()) { Alert.alert('Error', 'Please enter your address'); return; }
    if (!customerName.trim() || !customerPhone.trim()) {
      Alert.alert('Error', 'Please enter your name and phone number'); return;
    }

    setSubmitting(true);
    try {
      const bookingData = {
        saint_id: saintId,
        pooja_name: selectedPooja.name,
        booking_date: bookingDate.toISOString().split('T')[0],
        booking_time: bookingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        address: address.trim(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
      };

      const booking = await apiClient.post('/bookings', bookingData);

      let paymentOrder;
      try {
        paymentOrder = await apiClient.post('/payment/create-order', { booking_id: booking.id });
      } catch (error: any) {
        Alert.alert('Payment Setup Failed',
          error.message || 'Unable to initialize payment. Please try again or contact support.',
          [{ text: 'OK' }]);
        return;
      }

      // On native (mobile), navigate to WebView-based payment screen
      if (Platform.OS !== 'web') {
        router.push({
          pathname: '/customer/payment',
          params: {
            bookingId: booking.id,
            orderId: paymentOrder.order_id,
            amount: String(paymentOrder.amount),
            currency: paymentOrder.currency,
            keyId: paymentOrder.key_id,
            customerName: customerName,
            customerPhone: customerPhone,
            description: `${selectedPooja.name} by ${saint.name}`,
          },
        });
        return;
      }

      // On web, open Razorpay directly via JS SDK
      const options = {
        description: `${selectedPooja.name} by ${saint.name}`,
        image: 'https://i.imgur.com/3g7nmJC.png',
        currency: paymentOrder.currency,
        key: paymentOrder.key_id,
        amount: paymentOrder.amount.toString(),
        name: 'Book Your Pujari',
        order_id: paymentOrder.order_id,
        prefill: {
          email: `${customerPhone}@bookyourpujari.com`,
          contact: customerPhone,
          name: customerName,
        },
        theme: { color: '#FF6B35' },
      };

      try {
        const data = await openRazorpayCheckout(options);
        try {
          await apiClient.post('/payment/verify', {
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_order_id: data.razorpay_order_id,
            razorpay_signature: data.razorpay_signature,
            booking_id: booking.id,
          });
          Alert.alert('Booking Confirmed!', 'Your pooja has been booked successfully.',
            [{ text: 'OK', onPress: () => router.replace('/customer/bookings') }]);
        } catch (error: any) {
          Alert.alert('Payment Verification Failed', error.message);
        }
      } catch (error: any) {
        Alert.alert('Payment Cancelled', error?.description || 'Your payment was cancelled or failed.');
      }
    } catch (error: any) {
      Alert.alert('Booking Failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !saint || !selectedPooja) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  const pricing = calculateTotal();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Pooja</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.saintCard}>
          <View style={styles.saintInfo}>
            <View style={styles.saintAvatar}>
              <Ionicons name="person" size={32} color="#FF6B35" />
            </View>
            <View style={styles.saintDetails}>
              <Text style={styles.saintName}>{saint.name}</Text>
              <Text style={styles.saintLocation}>{saint.location}</Text>
              <View style={styles.saintRating}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={styles.ratingText}>{saint.rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pooja Details</Text>
          <View style={styles.poojaCard}>
            <Text style={styles.poojaName}>{selectedPooja.name}</Text>
            {selectedPooja.description ? (
              <Text style={styles.poojaDescription}>{selectedPooja.description}</Text>
            ) : null}
            {selectedPooja.duration ? (
              <View style={styles.poojaMeta}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.metaText}>{selectedPooja.duration}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date & Time</Text>
          <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.dateTimeText}>
              {bookingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.dateTimeText}>
              {bookingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker value={bookingDate} mode="date" minimumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setBookingDate(date);
              }} />
          )}
          {showTimePicker && (
            <DateTimePicker value={bookingTime} mode="time"
              onChange={(event, date) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (date) setBookingTime(date);
              }} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Details</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" />
            <TextInput style={styles.input} placeholder="Your Name"
              value={customerName} onChangeText={setCustomerName} placeholderTextColor="#999" />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#666" />
            <TextInput style={styles.input} placeholder="Your Phone Number"
              value={customerPhone} onChangeText={setCustomerPhone}
              keyboardType="phone-pad" placeholderTextColor="#999" />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Complete Address"
              value={address} onChangeText={setAddress} multiline numberOfLines={3}
              placeholderTextColor="#999" />
          </View>
        </View>

        <View style={styles.totalSection}>
          <View style={styles.totalCard}>
            <Text style={styles.totalCardLabel}>Total Amount</Text>
            <Text style={styles.totalCardValue}>₹{pricing.total}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.bookButton, submitting && styles.buttonDisabled]}
          onPress={handleBooking} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Text style={styles.bookButtonText}>Proceed to Payment</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flex: 1 },
  saintCard: { backgroundColor: '#FFF', padding: 16, marginBottom: 8 },
  saintInfo: { flexDirection: 'row' },
  saintAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saintDetails: { flex: 1 },
  saintName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  saintLocation: { fontSize: 14, color: '#666', marginBottom: 4 },
  saintRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '600', color: '#333' },
  section: { backgroundColor: '#FFF', padding: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  poojaCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16 },
  poojaName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  poojaDescription: { fontSize: 14, color: '#666', marginBottom: 8 },
  poojaMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 14, color: '#666' },
  dateTimeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, padding: 16, marginBottom: 12, gap: 12 },
  dateTimeText: { fontSize: 16, color: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F5F5F5',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12, gap: 12 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  totalSection: { padding: 20, marginBottom: 8 },
  totalCard: { backgroundColor: '#FFF5F0', borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 2, borderColor: '#FF6B35' },
  totalCardLabel: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  totalCardValue: { fontSize: 36, fontWeight: 'bold', color: '#FF6B35' },
  bookButton: { flexDirection: 'row', backgroundColor: '#FF6B35', borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center', margin: 20, gap: 8,
    shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  bookButtonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
