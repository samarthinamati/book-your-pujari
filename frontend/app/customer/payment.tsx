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

    // Round UP to the next whole rupee.
    const total = Math.ceil(base + commission);

    return {
      base,
      commission,
      total,
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

      /*
       * WEB
       *
       * The backend payment amount is used here.
       * For ₹6 pooja:
       * ₹6 + 10% = ₹6.60
       * Backend rounds UP = ₹7
       * Razorpay amount = 700 paise
       */
      if (Platform.OS === 'web') {
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

          /*
           * IMPORTANT:
           * Verify payment with backend first.
           * Only after successful verification
           * redirect to the Bookings / Calendar page.
           */
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

          /*
           * PAYMENT SUCCESS
           *
           * No success popup.
           * Directly open the customer's
           * Bookings / Calendar dashboard.
           */
        if (Platform.OS === 'web') {
  window.location.replace(
    `${window.location.origin}/customer/bookings`
  );
} else {
  router.replace('/customer/bookings');
}

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

        return;
      }

      /*
       * MOBILE
       */
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

  const pricing = calculateTotal();

  const saintRating = Number(
    saint?.rating ?? 0
  );

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Book Pooja
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* SAINT DETAILS */}
        <View style={styles.saintCard}>
          <View style={styles.saintInfo}>

            <View
              style={styles.saintAvatar}
            >
              <Ionicons
                name="person"
                size={32}
                color="#FF6B35"
              />
            </View>

            <View
              style={styles.saintDetails}
            >
              <Text
                style={styles.saintName}
              >
                {saint.name ||
                  'Saint'}
              </Text>

              <Text
                style={
                  styles.saintLocation
                }
              >
                {saint.location ||
                  'Location not available'}
              </Text>

              <View
                style={styles.saintRating}
              >
                <Ionicons
                  name="star"
                  size={14}
                  color="#FFB800"
                />

                <Text
                  style={
                    styles.ratingText
                  }
                >
                  {saintRating.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* POOJA DETAILS */}
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Pooja Details
          </Text>

          <View
            style={styles.poojaCard}
          >
            <Text
              style={styles.poojaName}
            >
              {selectedPooja.name ||
                'Pooja Service'}
            </Text>

            {selectedPooja.description ? (
              <Text
                style={
                  styles.poojaDescription
                }
              >
                {
                  selectedPooja.description
                }
              </Text>
            ) : null}

            {selectedPooja.duration ? (
              <View
                style={styles.poojaMeta}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#666"
                />

                <Text
                  style={styles.metaText}
                >
                  {
                    selectedPooja.duration
                  }
                </Text>
              </View>
            ) : null}

            {/* POOJA BASE PRICE */}
            <View
              style={styles.priceRow}
            >
              <Text
                style={styles.priceLabel}
              >
                Pooja Price
              </Text>

              <Text
                style={styles.priceValue}
              >
                ₹{pricing.base}
              </Text>
            </View>
          </View>
        </View>

        {/* SAINT VISIT DATE & TIME */}
        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            When should the Saint visit?
          </Text>

          <Text
            style={styles.sectionDescription}
          >
            Select when the Saint should come to
            your home for the pooja.
          </Text>

          {/* VISIT DATE */}
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() =>
              setShowDatePicker(true)
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color="#FF6B35"
            />

            <View
              style={styles.dateTimeInfo}
            >
              <Text
                style={styles.dateTimeLabel}
              >
                Visit Date
              </Text>

              <Text
                style={styles.dateTimeText}
              >
                {visitDate.toLocaleDateString(
                  'en-IN',
                  {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }
                )}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          {/* VISIT TIME */}
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() =>
              setShowTimePicker(true)
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="time-outline"
              size={22}
              color="#FF6B35"
            />

            <View
              style={styles.dateTimeInfo}
            >
              <Text
                style={styles.dateTimeLabel}
              >
                Visit Time
              </Text>

              <Text
                style={styles.dateTimeText}
              >
                {visitTime.toLocaleTimeString(
                  'en-IN',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          {/* DATE PICKER */}
          {showDatePicker && (
            <DateTimePicker
              value={visitDate}
              mode="date"
              minimumDate={new Date()}
              display="default"
              onChange={(
                event,
                date
              ) => {
                setShowDatePicker(false);

                if (date) {
                  setVisitDate(date);
                }
              }}
            />
          )}

          {/* TIME PICKER */}
          {showTimePicker && (
            <DateTimePicker
              value={visitTime}
              mode="time"
              display="default"
              onChange={(
                event,
                date
              ) => {
                setShowTimePicker(false);

                if (date) {
                  setVisitTime(date);
                }
              }}
            />
          )}
        </View>

        {/* CUSTOMER DETAILS */}
        <View style={styles.section}>

          <Text
            style={styles.sectionTitle}
          >
            Your Details
          </Text>

          <View
            style={styles.inputContainer}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Your Name"
              value={customerName}
              onChangeText={
                setCustomerName
              }
              placeholderTextColor="#999"
            />
          </View>

          <View
            style={styles.inputContainer}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Your Phone Number"
              value={customerPhone}
              onChangeText={
                setCustomerPhone
              }
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

          <View
            style={styles.inputContainer}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color="#666"
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
              ]}
              placeholder="Your Home Address"
              value={address}
              onChangeText={
                setAddress
              }
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* TOTAL */}
        <View
          style={styles.totalSection}
        >
          <View
            style={styles.totalCard}
          >
            <Text
              style={
                styles.totalCardLabel
              }
            >
              Total Amount
            </Text>

            <Text
              style={
                styles.totalCardValue
              }
            >
              ₹{pricing.total}
            </Text>

            <Text
              style={styles.commissionText}
            >
              Includes 10% platform commission
            </Text>
          </View>
        </View>

        {/* PAYMENT */}
        <TouchableOpacity
          style={[
            styles.bookButton,
            submitting &&
              styles.buttonDisabled,
          ]}
          onPress={handleBooking}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator
              color="#FFF"
            />
          ) : (
            <>
              <Text
                style={
                  styles.bookButtonText
                }
              >
                Proceed to Payment
              </Text>

              <Ionicons
                name="arrow-forward"
                size={20}
                color="#FFF"
              />
            </>
          )}
        </TouchableOpacity>

        <View
          style={styles.bottomSpace}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8F9FA',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },

  backToDashboardButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  backToDashboardText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  headerSpacer: {
    width: 40,
  },

  /* CONTENT */

  content: {
    flex: 1,
  },

  /* SAINT */

  saintCard: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 8,
  },

  saintInfo: {
    flexDirection: 'row',
  },

  saintAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  saintDetails: {
    flex: 1,
  },

  saintName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  saintLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  saintRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  /* SECTIONS */

  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },

  sectionDescription: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
    marginBottom: 16,
  },

  /* POOJA */

  poojaCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },

  poojaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  poojaDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },

  poojaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },

  metaText: {
    fontSize: 14,
    color: '#666',
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },

  priceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },

  /* DATE & TIME */

  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  dateTimeInfo: {
    flex: 1,
    marginLeft: 12,
  },

  dateTimeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 3,
  },

  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  /* CUSTOMER INPUTS */

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 12,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  /* TOTAL */

  totalSection: {
    padding: 20,
    marginBottom: 8,
  },

  totalCard: {
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },

  totalCardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },

  totalCardValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
  },

  commissionText: {
    fontSize: 12,
    color: '#777',
    marginTop: 8,
  },

  /* PAYMENT */

  bookButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  bookButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },

  bottomSpace: {
    height: 30,
  },
});
