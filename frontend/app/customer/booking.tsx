// frontend/app/customer/booking.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { openRazorpayCheckout } from '@/src/utils/razorpay';

export default function BookingScreen() {
  const params = useLocalSearchParams();

  const saintId = Array.isArray(params.saintId)
    ? params.saintId[0]
    : params.saintId;

  const poojaNameParam = Array.isArray(params.poojaName)
    ? params.poojaName[0]
    : params.poojaName;

  const { user } = useAuth();
  const router = useRouter();

  const [saint, setSaint] = useState<any>(null);
  const [selectedPooja, setSelectedPooja] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [visitDate, setVisitDate] = useState(new Date());
  const [visitTime, setVisitTime] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [address, setAddress] = useState('');

  const [customerName, setCustomerName] = useState(
    user?.name || ''
  );

  const [customerPhone, setCustomerPhone] = useState(
    user?.phone || ''
  );

  useEffect(() => {
    if (!saintId) {
      setLoading(false);

      Alert.alert(
        'Error',
        'Saint information is missing.',
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
          },
        ]
      );

      return;
    }

    fetchSaintDetails();
  }, [saintId, poojaNameParam]);

  const fetchSaintDetails = async () => {
    try {
      console.log('[Booking] Saint ID:', saintId);
      console.log('[Booking] Pooja:', poojaNameParam);

      const data = await apiClient.get(
        `/saints/${encodeURIComponent(String(saintId))}`
      );

      console.log('[Booking] Saint response:', data);

      if (!data) {
        throw new Error('Saint details not found');
      }

      setSaint(data);

      const poojas = Array.isArray(data.poojas)
        ? data.poojas
        : [];

      let decodedPoojaName = '';

      if (poojaNameParam) {
        try {
          decodedPoojaName = decodeURIComponent(
            String(poojaNameParam)
          );
        } catch {
          decodedPoojaName = String(poojaNameParam);
        }
      }

      const pooja = poojas.find(
        (p: any) =>
          String(p?.name || '') === decodedPoojaName
      );

      if (pooja) {
        setSelectedPooja(pooja);
      } else if (poojas.length > 0) {
        setSelectedPooja(poojas[0]);
      } else {
        setSelectedPooja(null);
      }
    } catch (error: any) {
      console.error(
        '[Booking] Failed to load:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Failed to load booking details.',
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * PRICE CALCULATION
   *
   * Pujari amount + 10% platform commission.
   *
   * Final amount is rounded UP.
   *
   * Examples:
   * ₹6   -> ₹6.60 -> ₹7
   * ₹50  -> ₹55
   * ₹101 -> ₹111.10 -> ₹112
   */
  const calculateTotal = () => {
    if (!selectedPooja) {
      return {
        base: 0,
        commission: 0,
        total: 0,
      };
    }

    const base = Number(selectedPooja?.price ?? 0);

    if (!Number.isFinite(base) || base < 0) {
      return {
        base: 0,
        commission: 0,
        total: 0,
      };
    }

    const commission = base * 0.10;

    // Always round UP to the next whole rupee.
    const total = Math.ceil(
      (base + commission) * 100
    ) / 100;

    // Final payment amount must be a whole rupee.
    const finalTotal = Math.ceil(total);

    return {
      base,
      commission,
      total: finalTotal,
    };
  };

  const handleBooking = async () => {
    if (!saintId) {
      Alert.alert(
        'Error',
        'Saint information is missing.'
      );
      return;
    }

    if (!selectedPooja) {
      Alert.alert(
        'Error',
        'Please select a pooja service.'
      );
      return;
    }

    if (!address.trim()) {
      Alert.alert(
        'Error',
        'Please enter your home address.'
      );
      return;
    }

    if (
      !customerName.trim() ||
      !customerPhone.trim()
    ) {
      Alert.alert(
        'Error',
        'Please enter your name and phone number.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const bookingData = {
        saint_id: String(saintId),

        pooja_name:
          selectedPooja?.name || '',

        booking_date:
          visitDate
            .toISOString()
            .split('T')[0],

        booking_time:
          visitTime.toLocaleTimeString(
            'en-US',
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          ),

        address: address.trim(),

        customer_name:
          customerName.trim(),

        customer_phone:
          customerPhone.trim(),
      };

      console.log(
        '[Booking] Creating home visit booking:',
        bookingData
      );

      const booking =
        await apiClient.post(
          '/bookings',
          bookingData
        );

      console.log(
        '[Booking] Created:',
        booking
      );

      if (!booking?.id) {
        throw new Error(
          'Booking was not created correctly.'
        );
      }

      let paymentOrder;

      try {
        paymentOrder =
          await apiClient.post(
            '/payment/create-order',
            {
              booking_id: booking.id,
            }
          );
      } catch (error: any) {
        Alert.alert(
          'Payment Setup Failed',
          error?.message ||
            'Unable to initialize payment. Please try again.',
          [{ text: 'OK' }]
        );

        return;
      }

      if (!paymentOrder?.order_id) {
        throw new Error(
          'Payment order could not be created.'
        );
      }

      console.log(
        '[Payment] Backend payment order:',
        paymentOrder
      );

      if (Platform.OS !== 'web') {
        router.push({
          pathname: '/customer/payment',
          params: {
            bookingId: String(
              booking.id
            ),

            orderId: String(
              paymentOrder.order_id
            ),

            amount: String(
              paymentOrder.amount
            ),

            currency:
              paymentOrder.currency ||
              'INR',

            keyId:
              paymentOrder.key_id ||
              '',

            customerName:
              customerName.trim(),

            customerPhone:
              customerPhone.trim(),

            description: `${
              selectedPooja?.name ||
              'Pooja'
            } by ${
              saint?.name ||
              'Saint'
            }`,
          },
        });

        return;
      }

      const options = {
        description: `${
          selectedPooja?.name ||
          'Pooja'
        } by ${
          saint?.name ||
          'Saint'
        }`,

        image:
          'https://i.imgur.com/3g7nmJC.png',

        currency:
          paymentOrder.currency ||
          'INR',

        key:
          paymentOrder.key_id,

        amount:
          String(
            paymentOrder.amount
          ),

        name:
          'Book Your Pujari',

        order_id:
          paymentOrder.order_id,

        prefill: {
          email: `${customerPhone.trim()}@bookyourpujari.com`,
          contact:
            customerPhone.trim(),
          name:
            customerName.trim(),
        },

        theme: {
          color: '#FF6B35',
        },
      };

      try {
        const paymentResult =
          await openRazorpayCheckout(
            options
          );

        console.log(
          '[Payment] Result:',
          paymentResult
        );

        await apiClient.post(
          '/payment/verify',
          {
            razorpay_payment_id:
              paymentResult.razorpay_payment_id,

            razorpay_order_id:
              paymentResult.razorpay_order_id,

            razorpay_signature:
              paymentResult.razorpay_signature,

            booking_id:
              booking.id,
          }
        );

        Alert.alert(
          'Booking Confirmed!',
          'Your pooja has been booked successfully. The Saint will visit your home at the selected date and time.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace(
                  '/customer/bookings'
                ),
            },
          ]
        );
      } catch (error: any) {
        console.error(
          '[Payment] Error:',
          error
        );

        Alert.alert(
          'Payment Failed',
          error?.description ||
            error?.message ||
            'Your payment was cancelled or failed.'
        );
      }
    } catch (error: any) {
      console.error(
        '[Booking] Error:',
        error
      );

      Alert.alert(
        'Booking Failed',
        error?.message ||
          'Unable to create booking. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color="#FF6B35"
        />

        <Text style={styles.loadingText}>
          Loading booking details...
        </Text>
      </View>
    );
  }

  if (!saint) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={60}
            color="#FF6B35"
          />

          <Text style={styles.errorTitle}>
            Saint details unavailable
          </Text>

          <TouchableOpacity
            style={
              styles.backToDashboardButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backToDashboardText
              }
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedPooja) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={60}
            color="#FF6B35"
          />

          <Text style={styles.errorTitle}>
            Pooja service unavailable
          </Text>

          <TouchableOpacity
            style={
              styles.backToDashboardButton
            }
            on
