import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '@/src/api/client';

export function SellerPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [sellers, setSellers] = useState<any[]>([]);
  useEffect(() => {
    apiClient.get('/store/admin/seller-applications')
      .then((rows) => setSellers((rows || []).filter((r: any) => r.status === 'approved')))
      .catch(() => setSellers([]));
  }, []);
  return (
    <View style={{ marginBottom: 12, gap: 6 }}>
      <Text style={s.label}>Seller (required for shipping)</Text>
      {sellers.length === 0 ? <Text style={s.muted}>No approved sellers yet. Approve a seller first.</Text> : (
        <View style={s.chips}>
          {sellers.map((sl) => (
            <Pressable key={sl.user_id} testID={`admin-product-seller-${sl.user_id}`} onPress={() => onChange(sl.user_id)} style={[s.chip, value === sl.user_id && s.chipOn]}>
              <Text style={[s.chipText, value === sl.user_id && { color: '#FFF' }]}>{sl.shop_name} · {sl.pincode}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function AdminStoreSettings({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<any>(null);
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    apiClient.get('/store/admin/settings').then((r) => { setSettings(r); setValue(String(r.commission_percent)); }).catch((e) => setMsg(e.message));
  }, []);
  const save = async () => {
    setMsg('');
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 50) { setMsg('Enter a commission between 0 and 50.'); return; }
    try {
      const r = await apiClient.put('/store/admin/settings', { commission_percent: n });
      setSettings({ ...settings, commission_percent: r.commission_percent });
      setMsg('Saved. New orders will use this commission.');
    } catch (e: any) { setMsg(e.message); }
  };
  return (
    <View testID="admin-store-settings" style={s.card}>
      <Pressable testID="admin-settings-back" onPress={onBack}><Text style={{ color: '#FF6B35', fontWeight: '700' }}>← Back to Store Menu</Text></Pressable>
      <Text style={s.title}>Store settings</Text>
      <Text style={s.label}>Seller commission (%)</Text>
      <TextInput testID="admin-commission-input" value={value} onChangeText={setValue} keyboardType="decimal-pad" style={s.input} />
      <Pressable testID="admin-commission-save" onPress={save} style={s.save}><Text style={{ color: '#FFF', fontWeight: '700' }}>Save commission</Text></Pressable>
      {!!msg && <Text testID="admin-settings-message" style={s.muted}>{msg}</Text>}
      {settings && (
        <View style={{ gap: 4, marginTop: 8 }}>
          <Text style={s.muted}>Shipping: {settings.shipping_is_demo ? `DEMO flat ₹${settings.demo_shipping_fee} per seller parcel` : 'Delhivery live rates'}</Text>
          <Text style={s.muted}>Live Delhivery shipments: {settings.live_shipments_enabled ? 'ENABLED' : 'disabled'}</Text>
        </View>
      )}
    </View>
  );
}

export function RefundAction({ order, onChanged }: { order: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!order.refund_status) return null;
  const pending = order.refund_status === 'pending_admin_action';
  const issue = async () => {
    if (!window.confirm(`Refund ₹${order.refund_due_amount} to the customer through Razorpay?`)) return;
    setBusy(true);
    try {
      const r = await apiClient.post(`/store/admin/orders/${order.id}/refund`, {});
      window.alert(`Razorpay confirmed refund ${r.razorpay_refund_id} for ₹${r.amount}.`);
      onChanged();
    } catch (e: any) {
      window.alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View testID={`refund-status-${order.id}`} style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: pending ? '#FEF3C7' : '#DCFCE7', gap: 6 }}>
      <Text style={{ fontWeight: '700', color: pending ? '#92400E' : '#15803D' }}>
        {pending ? `Refund PENDING – ₹${order.refund_due_amount} not refunded yet` : order.refund_status === 'refunded' ? `Refunded via Razorpay (₹${order.refund_due_amount})` : `Refund ${order.refund_status}`}
      </Text>
      {pending && (
        <Pressable testID={`refund-issue-${order.id}`} disabled={busy} onPress={issue} style={[s.save, busy && { opacity: 0.5 }]}>
          <Text style={{ color: '#FFF', fontWeight: '700' }}>{busy ? 'Refunding…' : 'Issue refund via Razorpay'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#DDD', gap: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#1F2A37' },
  label: { fontWeight: '700', color: '#374151' },
  muted: { color: '#6B7280', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, maxWidth: 160 },
  save: { backgroundColor: '#1E7FC2', padding: 12, borderRadius: 8, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#1E7FC2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: '#1E7FC2' },
  chipText: { color: '#1E7FC2', fontWeight: '600', fontSize: 12 },
});
