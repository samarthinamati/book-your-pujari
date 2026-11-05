import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

type ReturnRequest = {
  id: string;
  order_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  reason: string;
  status: string;
  review_note?: string;
  created_at?: string;
  customer_name?: string;
  reverse_status?: string;
  reverse_waybill?: string;
  reverse_tracking_url?: string;
};

export default function SellerReturnsScreen() {
  const router = useRouter();

  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      const response = await apiClient.get('/store/returns/requests');

      const data = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.requests)
        ? response.data.requests
        : [];

      setRequests(data);
    } catch (error: any) {
      Alert.alert(
        'Unable to load return requests',
        error?.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const reviewRequest = (request: ReturnRequest, status: 'Approved' | 'Rejected') => {
    Alert.alert(
      `${status} Return Request`,
      `Are you sure you want to ${status.toLowerCase()} this return request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status,
          style: status === 'Rejected' ? 'destructive' : 'default',
          onPress: () => submitReview(request, status),
        },
      ]
    );
  };

  const submitReview = async (
    request: ReturnRequest,
    status: 'Approved' | 'Rejected'
  ) => {
    try {
      setProcessingId(request.id);

      const response = await apiClient.put(
        `/store/returns/${request.id}/review`,
        {
          status,
          review_note: notes[request.id] || '',
        }
      );

      Alert.alert(
        'Success',
        response?.message ||
          `Return request ${status.toLowerCase()} successfully.`
      );

      await loadRequests();
    } catch (error: any) {
      Alert.alert(
        'Unable to update request',
        error?.response?.data?.detail?.message ||
          error?.response?.data?.detail ||
          error?.message ||
          'Please try again.'
      );
    } finally {
      setProcessingId('');
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Date unavailable';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 'Date unavailable'
      : date.toLocaleString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#2874F0"
          style={{ marginTop: 50 }}
        />
        <Text style={styles.loadingText}>Loading return requests...</Text>
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
              loadRequests();
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

        <Text style={styles.title}>Return Requests</Text>

        <Text style={styles.subtitle}>
          Review customer return requests for your products.
        </Text>

        <View style={styles.summaryCard}>
          <Ionicons name="return-down-back-outline" size={28} color="#2874F0" />
          <View style={{ marginLeft: 13 }}>
            <Text style={styles.summaryNumber}>{requests.length}</Text>
            <Text style={styles.summaryLabel}>Total return requests</Text>
          </View>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#98A2B3" />
            <Text style={styles.emptyTitle}>No return requests</Text>
            <Text style={styles.emptyText}>
              Customer return requests for your products will appear here.
            </Text>
          </View>
        ) : (
          requests.map((request) => {
            const pending = request.status === 'Pending';
            const processing = processingId === request.id;

            return (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.headerRow}>
                  <Text style={styles.orderTitle}>
                    Order #{String(request.order_id || '').slice(-8)}
                  </Text>

                  <View
                    style={[
                      styles.statusBadge,
                      request.status === 'Approved' && styles.approvedBadge,
                      request.status === 'Rejected' && styles.rejectedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        request.status === 'Approved' && styles.approvedText,
                        request.status === 'Rejected' && styles.rejectedText,
                      ]}
                    >
                      {request.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.fieldLabel}>Product</Text>
                <Text style={styles.fieldValue}>
                  {request.product_name || request.product_id}
                </Text>

                <Text style={styles.fieldLabel}>Return quantity</Text>
                <Text style={styles.fieldValue}>{request.quantity}</Text>

                <Text style={styles.fieldLabel}>Customer reason</Text>
                <Text style={styles.reasonText}>{request.reason}</Text>

                <Text style={styles.dateText}>
                  Requested: {formatDate(request.created_at)}
                </Text>

                {pending ? (
                  <>
                    <Text style={styles.fieldLabel}>Review note (optional)</Text>

                    <TextInput
                      style={styles.noteInput}
                      placeholder="Enter a note for this customer..."
                      value={notes[request.id] || ''}
                      onChangeText={(value) =>
                        setNotes((previous) => ({
                          ...previous,
                          [request.id]: value,
                        }))
                      }
                      multiline
                      maxLength={500}
                    />

                    <TouchableOpacity
                      style={[
                        styles.approveButton,
                        processing && styles.disabledButton,
                      ]}
                      onPress={() => reviewRequest(request, 'Approved')}
                      disabled={processing}
                    >
                      {processing ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
                          <Text style={styles.buttonText}>Approve Return</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.rejectButton,
                        processing && styles.disabledButton,
                      ]}
                      onPress={() => reviewRequest(request, 'Rejected')}
                      disabled={processing}
                    >
                      <Ionicons name="close-circle-outline" size={19} color="#FFFFFF" />
                      <Text style={styles.buttonText}>Reject Return</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {request.review_note ? (
                      <>
                        <Text style={styles.fieldLabel}>Review note</Text>
                        <Text style={styles.reasonText}>{request.review_note}</Text>
                      </>
                    ) : null}
                  </>
                )}

                {request.status === 'Approved' ? (
                  <View style={styles.reverseCard}>
                    <Text style={styles.reverseTitle}>
                      <Ionicons name="cube-outline" size={18} color="#2874F0" />
{' '}Reverse Pickup
                    </Text>

                    <Text style={styles.reverseText}>
                      Status: {request.reverse_status || 'Not started'}
                    </Text>

                    {request.reverse_waybill ? (
                      <Text style={styles.reverseText}>
                        Waybill: {request.reverse_waybill}
                      </Text>
                    ) : null}

                    {request.reverse_tracking_url ? (
                      <Text style={styles.reverseText}>
                        Tracking information is available.
                      </Text>
                    ) : null}

                    <Text style={styles.reverseNotice}>
                      Approval prepares the pickup details. It does not book
                      a Delhivery reverse shipment automatically.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            loadRequests();
          }}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={20} color="#2874F0" />
          <Text style={styles.refreshText}>Refresh Requests</Text>
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
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#667085',
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
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 16,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172B4D',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#FFF4D6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    color: '#8A5A00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  approvedBadge: {
    backgroundColor: '#E8F5E9',
  },
  approvedText: {
    color: '#16803D',
  },
  rejectedBadge: {
    backgroundColor: '#FEE4E2',
  },
  rejectedText: {
    color: '#B42318',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAECF0',
    marginVertical: 14,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#172B4D',
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 14,
    color: '#344054',
    lineHeight: 21,
  },
  dateText: {
    fontSize: 11,
    color: '#98A2B3',
    marginTop: 12,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 9,
    padding: 12,
    minHeight: 75,
    textAlignVertical: 'top',
    fontSize: 13,
    color: '#172B4D',
  },
  approveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16803D',
    padding: 13,
    borderRadius: 9,
    marginTop: 14,
  },
  rejectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D92D20',
    padding: 13,
    borderRadius: 9,
    marginTop: 9,
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
  reverseCard: {
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D8E6FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  reverseTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#172B4D',
  },
  reverseText: {
    fontSize: 12,
    color: '#344054',
    marginTop: 8,
  },
  reverseNotice: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8A5A00',
    marginTop: 10,
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
});

