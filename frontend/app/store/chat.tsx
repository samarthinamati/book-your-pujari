import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/src/api/client';

export default function StoreChatScreen() {
  const { orderId, sellerId, productId, shopName } = useLocalSearchParams<{
    orderId: string;
    sellerId: string;
    productId?: string;
    shopName?: string;
  }>();
  const [conversationKey, setConversationKey] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const loadConversation = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const conversations = await apiClient.get('/store/chat/conversations');
      const found = (conversations || []).find(
        (c: any) => c.order_id === orderId && String(c.other_party_id) === String(sellerId)
      );
      if (!found) {
        setConversationKey('');
        setMessages([]);
        return;
      }
      setConversationKey(found.conversation_key);
      const result = await apiClient.get(`/store/chat/messages/${encodeURIComponent(found.conversation_key)}`);
      setMessages(result || []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load chat.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, sellerId]);

  useEffect(() => {
    if (!orderId || !sellerId) {
      setError('Seller or order information is missing.');
      setLoading(false);
      return;
    }
    loadConversation();
    const timer = setInterval(() => loadConversation(true), 5000);
    return () => clearInterval(timer);
  }, [loadConversation, orderId, sellerId]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const sendMessage = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      if (conversationKey) {
        await apiClient.post(`/store/chat/messages/${encodeURIComponent(conversationKey)}/reply`, { message });
      } else {
        const created = await apiClient.post('/store/chat/messages', {
          recipient_type: 'seller',
          recipient_id: sellerId,
          product_id: productId || undefined,
          order_id: orderId,
          message,
        });
        if (created?.conversation_key) setConversationKey(created.conversation_key);
      }
      setText('');
      await loadConversation(true);
    } catch (e: any) {
      setError(e?.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#172B4D" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Chat with Seller</Text>
          <Text style={s.subtitle}>{shopName || 'Seller'} · Order {String(orderId).slice(0, 8)}</Text>
        </View>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#2874F0" /></View>
      ) : (
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={42} color="#2874F0" />
              <Text style={s.emptyTitle}>Start a conversation</Text>
              <Text style={s.emptyText}>Ask the seller about your product or order.</Text>
            </View>
          ) : messages.map((m: any) => {
            const mine = String(m.sender_id) !== String(sellerId);
            return (
              <View key={m.id} style={[s.messageRow, mine ? s.mineRow : s.theirRow]}>
                <View style={[s.bubble, mine ? s.mineBubble : s.theirBubble]}>
                  <Text style={[s.messageText, mine ? s.mineText : s.theirText]}>{m.message}</Text>
                  {!!m.created_at && <Text style={[s.time, mine ? s.mineTime : s.theirTime]}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={s.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#98A2B3"
          multiline
          maxLength={2000}
          style={s.input}
          onSubmitEditing={Platform.OS === 'web' ? sendMessage : undefined}
        />
        <Pressable onPress={sendMessage} disabled={!text.trim() || sending} style={[s.send, (!text.trim() || sending) && s.sendDisabled]}>
          {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E4E7EC' },
  back: { padding: 6, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#172B4D' },
  subtitle: { marginTop: 3, fontSize: 12, color: '#667085' },
  error: { margin: 12, padding: 10, borderRadius: 10, color: '#B42318', backgroundColor: '#FEF3F2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#172B4D' },
  emptyText: { marginTop: 5, textAlign: 'center', color: '#667085', lineHeight: 20 },
  messageRow: { flexDirection: 'row', width: '100%' },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  mineBubble: { backgroundColor: '#2874F0', borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC', borderBottomLeftRadius: 5 },
  messageText: { fontSize: 14, lineHeight: 20 },
  mineText: { color: '#FFFFFF' },
  theirText: { color: '#172B4D' },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  mineTime: { color: '#DCE9FF' },
  theirTime: { color: '#98A2B3' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E7EC' },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#172B4D', backgroundColor: '#FFFFFF' },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2874F0', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.45 },
});
