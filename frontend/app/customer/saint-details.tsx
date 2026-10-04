// frontend/app/customer/saint-details.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

interface Pooja {
  name?: string;
  description?: string;
  price?: number;
  duration?: string;
}

interface Saint {
  id: string;
  name?: string;
  photo?: string;
  bio?: string;
  experience_years?: number;
  location?: string;
  operating_areas?: string[];
  poojas?: Pooja[];
  rating?: number;
  total_bookings?: number;
}

interface Review {
  id: string;
  customer_name?: string;
  rating?: number;
  comment?: string;
  created_at?: string;
}

export default function SaintDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const saintId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [saint, setSaint] = useState<Saint | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!saintId) {
      setLoading(false);
      Alert.alert('Error', 'Saint ID is missing');
      return;
    }

    loadSaint();
    loadReviews();
  }, [saintId]);

  const loadSaint = async () => {
    try {
      console.log('[Saint Details] Loading saint:', saintId);

      const data = await apiClient.get(
        `/saints/${encodeURIComponent(String(saintId))}`
      );

      console.log('[Saint Details] API response:', data);

      if (!data) {
        throw new Error('Saint data is empty');
      }

      const safeSaint: Saint = {
        id: String(data.id ?? saintId),
        name: data.name ?? 'Saint',
        photo: data.photo ?? '',
        bio: data.bio ?? '',
        experience_years: Number(data.experience_years ?? 0),
        location: data.location ?? 'Location not available',
        operating_areas: Array.isArray(data.operating_areas)
          ? data.operating_areas
          : [],
        poojas: Array.isArray(data.poojas)
          ? data.poojas
          : [],
        rating: Number(data.rating ?? 0),
        total_bookings: Number(data.total_bookings ?? 0),
      };

      setSaint(safeSaint);
    } catch (error: any) {
      console.error(
        '[Saint Details] Failed:',
        error
      );

      Alert.alert(
        'Error',
        error?.message || 'Failed to load saint details',
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

  const loadReviews = async () => {
    if (!saintId) return;

    try {
      const data = await apiClient.get(
        `/reviews/saint/${encodeURIComponent(String(saintId))}`
      );

      if (Array.isArray(data)) {
        setReviews(data);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.log('[Saint Reviews] No reviews found');
      setReviews([]);
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
          Loading saint details...
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
            Saint details not available
          </Text>

          <TouchableOpacity
            style={styles.backToDashboardButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToDashboardText}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const rating = Number(saint.rating ?? 0);
  const experienceYears = Number(
    saint.experience_years ?? 0
  );
  const totalBookings = Number(
    saint.total_bookings ?? 0
  );

  const operatingAreas = Array.isArray(
    saint.operating_areas
  )
    ? saint.operating_areas
    : [];

  const poojas = Array.isArray(saint.poojas)
    ? saint.poojas
    : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Saint Details
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* PROFILE */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons
                name="person"
                size={48}
                color="#FF6B35"
              />
            </View>
          </View>

          <Text style={styles.saintName}>
            {saint.name || 'Saint'}
          </Text>

          {/* STATS */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons
                name="star"
                size={24}
                color="#FFB800"
              />

              <Text style={styles.statValue}>
                {rating.toFixed(1)}
              </Text>

              <Text style={styles.statLabel}>
                Rating
              </Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons
                name="briefcase"
                size={24}
                color="#FF6B35"
              />

              <Text style={styles.statValue}>
                {experienceYears}
              </Text>

              <Text style={styles.statLabel}>
                Years Exp
              </Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color="#4CAF50"
              />

              <Text style={styles.statValue}>
                {totalBookings}
              </Text>

              <Text style={styles.statLabel}>
                Bookings
              </Text>
            </View>
          </View>
        </View>

        {/* LOCATION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="location"
              size={20}
              color="#FF6B35"
            />

            <Text style={styles.sectionTitle}>
              Location
            </Text>
          </View>

          <Text style={styles.locationText}>
            {saint.location || 'Location not available'}
          </Text>

          {operatingAreas.length > 0 && (
            <View style={styles.areasContainer}>
              {operatingAreas.map(
                (area, index) => (
                  <View
                    key={`${area}-${index}`}
                    style={styles.areaChip}
                  >
                    <Text style={styles.areaText}>
                      {area}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}
        </View>

        {/* ABOUT */}
        {saint.bio ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="information-circle"
                size={20}
                color="#FF6B35"
              />

              <Text style={styles.sectionTitle}>
                About
              </Text>
            </View>

            <Text style={styles.bioText}>
              {saint.bio}
            </Text>
          </View>
        ) : null}

        {/* SERVICES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="list"
              size={20}
              color="#FF6B35"
            />

            <Text style={styles.sectionTitle}>
              Services Offered
            </Text>
          </View>

          {poojas.length === 0 ? (
            <View style={styles.emptyServices}>
              <Ionicons
                name="information-circle-outline"
                size={32}
                color="#999"
              />

              <Text style={styles.emptyServicesText}>
                No services available
              </Text>
            </View>
          ) : (
            poojas.map((pooja, index) => {
              const poojaPrice = Number(
                pooja?.price ?? 0
              );

              const finalPrice = Math.round(
                poojaPrice * 1.10
              );

              const poojaName =
                pooja?.name || 'Pooja Service';

              return (
                <View
                  key={`${poojaName}-${index}`}
                  style={styles.poojaCard}
                >
                  <View style={styles.poojaHeader}>
                    <Text style={styles.poojaName}>
                      {poojaName}
                    </Text>

                    <Text style={styles.poojaPrice}>
                      ₹{finalPrice}
                    </Text>
                  </View>

                  {pooja?.description ? (
                    <Text
                      style={
                        styles.poojaDescription
                      }
                    >
                      {pooja.description}
                    </Text>
                  ) : null}

                  {pooja?.duration ? (
                    <View
                      style={styles.poojaFooter}
                    >
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color="#666"
                      />

                      <Text
                        style={
                          styles.poojaDuration
                        }
                      >
                        {pooja.duration}
                      </Text>
                    </View>
                  ) : null}

                  {/* BOOK NOW */}
                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => {
                      router.push(
                        `/customer/booking?saintId=${encodeURIComponent(
                          String(saint.id)
                        )}&poojaName=${encodeURIComponent(
                          poojaName
                        )}`
                      );
                    }}
                  >
                    <Text
                      style={styles.bookButtonText}
                    >
                      Book Now
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* REVIEWS */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="star"
                size={20}
                color="#FF6B35"
              />

              <Text style={styles.sectionTitle}>
                Reviews ({reviews.length})
              </Text>
            </View>

            {reviews.map((review, index) => {
              const reviewRating = Number(
                review?.rating ?? 0
              );

              let reviewDate = '';

              if (review?.created_at) {
                const date = new Date(
                  review.created_at
                );

                if (!Number.isNaN(date.getTime())) {
                  reviewDate =
                    date.toLocaleDateString();
                }
              }

              return (
                <View
                  key={
                    review.id ||
                    `review-${index}`
                  }
                  style={styles.reviewCard}
                >
                  <View style={styles.reviewHeader}>
                    <Text
                      style={styles.reviewName}
                    >
                      {review?.customer_name ||
                        'Customer'}
                    </Text>

                    <View
                      style={styles.reviewRating}
                    >
                      <Ionicons
                        name="star"
                        size={16}
                        color="#FFB800"
                      />

                      <Text
                        style={
                          styles.reviewRatingText
                        }
                      >
                        {reviewRating.toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  {review?.comment ? (
                    <Text
                      style={styles.reviewComment}
                    >
                      {review.comment}
                    </Text>
                  ) : null}

                  {reviewDate ? (
                    <Text
                      style={styles.reviewDate}
                    >
                      {reviewDate}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpace} />
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

  content: {
    flex: 1,
  },

  profileSection: {
    backgroundColor: '#FFF',
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 8,
  },

  avatarContainer: {
    marginBottom: 16,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FF6B35',
  },

  saintName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 24,
  },

  statBox: {
    alignItems: 'center',
  },

  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },

  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  locationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },

  areasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  areaChip: {
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  areaText: {
    fontSize: 14,
    color: '#FF6B35',
  },

  bioText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },

  poojaCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  poojaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  poojaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },

  poojaPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },

  poojaDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },

  poojaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },

  poojaDuration: {
    fontSize: 13,
    color: '#666',
  },

  bookButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  bookButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  emptyServices: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },

  emptyServicesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },

  reviewCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
  },

  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  reviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },

  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  reviewRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },

  reviewDate: {
    fontSize: 12,
    color: '#999',
  },

  bottomSpace: {
    height: 30,
  },
});
