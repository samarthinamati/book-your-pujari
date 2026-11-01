// frontend/src/components/NotificationBell.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const fetchNotifs = async () => {
    try {
      const res = await apiClient.get('/store/notifications');
      setNotifications(Array.isArray(res) ? res : []);
    } catch (e) {
      // Background fetch error ignored
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    try {
      await apiClient.put(`/store/notifications/${id}/read`, {});
      fetchNotitsLocal();
    } catch (e) {}
  };

  const fetchNotitsLocal = () => fetchNotifs();

  return (
    <>
      <TouchableOpacity style={styles.bellContainer} onPress={() => setShowModal(true)}>
        <Ionicons name="notifications-outline" size={24} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={showModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔔 Notifications</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications yet</Text>
              ) : (
                notifications.map((n) => (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.notifItem, !n.is_read && styles.unreadItem]}
                    onPress={() => markAsRead(n.id)}
                  >
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMsg}>{n.message}</Text>
                    <Text style={styles.notifDate}>{new Date(n.created_at).toLocaleTimeString()}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)}>
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellContainer: { padding: 8, position: 'relative' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'red', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#666', marginVertical: 20 },
  notifItem: { padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  unreadItem: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  notifTitle: { fontWeight: 'bold', fontSize: 14, color: '#1E293B' },
  notifMsg: { fontSize: 13, color: '#475569', marginTop: 2 },
  notifDate: { fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'right' },
  closeBtn: { backgroundColor: '#2874F0', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 12 },
});
