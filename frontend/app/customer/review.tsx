// frontend/app/customer/review.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

export default function ReviewScreen() {
  const { bookingId, saintId } = useLocalSearchParams();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { Alert.alert('Error', 'Please select a rating'); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/reviews', {
        booking_id: bookingId,
        saint_id: saintId,
        rating,
        comment: comment.trim(),
      });
      Alert.alert('Success', 'Thank you for your review!',
        [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>How was your experience?</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starButton}>
                <Ionicons name={star <= rating ? 'star' : 'star-outline'}
                  size={48} color={star <= rating ? '#FFB800' : '#CCC'} />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingText}>
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Very Good!' :
               rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </Text>
          )}
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>Share your feedback</Text>
          <TextInput style={styles.commentInput} placeholder="Tell others about your experience..."
            value={comment} onChangeText={setComment} multiline numberOfLines={6}
            placeholderTextColor="#999" textAlignVertical="top" />
        </View>

        <TouchableOpacity style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Submit Review</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flex: 1, padding: 20 },
  ratingSection: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  starsContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  starButton: { padding: 4 },
  ratingText: { fontSize: 16, fontWeight: '600', color: '#FF6B35' },
  commentSection: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 24 },
  commentInput: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, fontSize: 15,
    color: '#333', minHeight: 120 },
  submitButton: { backgroundColor: '#FF6B35', borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
