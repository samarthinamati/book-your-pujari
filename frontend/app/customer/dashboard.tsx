// frontend/app/customer/dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiClient } from '@/src/api/client';

interface Saint {
  id: string;
  name: string;
  photo: string;
  bio: string;
  experience_years: number;
  location: string;
  operating_areas: string[];
  poojas: Array<{ name: string; description: string; price: number; duration: string }>;
  rating: number;
  total_bookings: number;
}

export default function CustomerDashboard() {
  const [saints, setSaints] = useState<Saint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchPooja, setSearchPooja] = useState('');
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => { fetchSaints(); }, []);

  const fetchSaints = async () => {
    try {
      const data = await apiClient.get('/saints/search');
      setSaints(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load saints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      let query = '/saints/search?';
      if (searchLocation) query += `location=${encodeURIComponent(searchLocation)}&`;
      if (searchPooja) query += `pooja=${encodeURIComponent(searchPooja)}`;
      const data = await apiClient.get(query);
      setSaints(data);
    } catch (error: any) {
      Alert.alert('Error', 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/auth/login'); } },
    ]);
  };

  const onRefresh = () => { setRefreshing(true); fetchSaints(); };

  if (loading && saints.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/customer/bookings')}>
            <Ionicons name="calendar" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Find Your Pujari</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="location-outline" size={20} color="#666" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search by location"
              value={searchLocation} onChangeText={setSearchLocation} placeholderTextColor="#999" />
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search by pooja type"
              value={searchPooja} onChangeText={setSearchPooja} placeholderTextColor="#999" />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.saintsSection}>
          <Text style={styles.sectionTitle}>{saints.length} Available Pujaris</Text>

          {saints.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No pujaris found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search filters</Text>
            </View>
          ) : (
            saints.map((saint) => (
              <TouchableOpacity key={saint.id} style={styles.saintCard}
                onPress={() => router.push(`/customer/saint-details?id=${saint.id}`)}>
                <View style={styles.saintHeader}>
                  <View style={styles.saintAvatar}>
                    <Ionicons name="person" size={32} color="#FF6B35" />
                  </View>
                  <View style={styles.saintInfo}>
                    <Text style={styles.saintName}>{saint.name}</Text>
                    <View style={styles.saintMeta}>
                      <Ionicons name="location" size={14} color="#666" />
                      <Text style={styles.saintLocation}>{saint.location}</Text>
                    </View>
                    <View style={styles.saintStats}>
                      <View style={styles.stat}>
                        <Ionicons name="star" size={14} color="#FFB800" />
                        <Text style={styles.statText}>{saint.rating.toFixed(1)}</Text>
                      </View>
                      <View style={styles.stat}>
                        <Ionicons name="briefcase" size={14} color="#666" />
                        <Text style={styles.statText}>{saint.experience_years}y exp</Text>
                      </View>
                      <View style={styles.stat}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.statText}>{saint.total_bookings} bookings</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {saint.bio ? <Text style={styles.saintBio}>{saint.bio}</Text> : null}

                <View style={styles.poojasList}>
                  <Text style={styles.poojaLabel}>Services:</Text>
                  {saint.poojas.slice(0, 3).map((pooja, index) => (
                    <View key={index} style={styles.poojaItem}>
                      <Text style={styles.poojaName}>{pooja.name}</Text>
                      <Text style={styles.poojaPrice}>₹{Math.round(pooja.price * 1.10)}</Text>
                    </View>
                  ))}
                  {saint.poojas.length > 3 && (
                    <Text style={styles.moreServices}>+{saint.poojas.length - 3} more</Text>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetails}>View Details & Book</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FF6B35" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  greeting: { fontSize: 14, color: '#666' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  searchSection: { padding: 20, backgroundColor: '#FFF', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, paddingHorizontal: 16, height: 50, marginBottom: 12 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  searchButton: { backgroundColor: '#FF6B35', borderRadius: 12, height: 50,
    alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  searchButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  saintsSection: { padding: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#666', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8 },
  saintCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
    shadowRadius: 8, elevation: 3 },
  saintHeader: { flexDirection: 'row', marginBottom: 12 },
  saintAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saintInfo: { flex: 1 },
  saintName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  saintMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  saintLocation: { fontSize: 14, color: '#666', marginLeft: 4 },
  saintStats: { flexDirection: 'row', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#666' },
  saintBio: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  poojasList: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12, marginBottom: 12 },
  poojaLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  poojaItem: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6 },
  poojaName: { fontSize: 14, color: '#666' },
  poojaPrice: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
  moreServices: { fontSize: 12, color: '#999', marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  viewDetails: { fontSize: 14, fontWeight: '600', color: '#FF6B35' },
});
