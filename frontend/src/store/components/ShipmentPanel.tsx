import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/src/api/client';

type Shipment = {
  seller_id: string;
  shop_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  delhivery_status?: string;
  shipment_status?: string;
  last_status?: string;
  delhivery_error?: string;
  label_url?: string;
  pickup_request_status?: string;
  pickup_date?: string;
};

const STATUS_TEXT: Record<string, string> = {
  not_started: 'Not started',
  test_mode_waiting: 'Waiting – Delhivery test mode (no shipment created)',
  live_shipments_disabled: 'Waiting – live shipments disabled',
  needs_attention: 'Needs attention',
  creating: 'Creating with Delhivery…',
  created: 'Created with Delhivery',
  unknown: 'Uncertain – check Delhivery before retrying',
  cancelled: 'Cancelled',
};

const notify = (msg: string) => (Platform.OS === 'web' ? window.alert(msg) : console.log(msg));

// Shows real Delhivery shipment state per seller parcel; never fabricates AWBs or statuses.
export function ShipmentPanel({ orderId, shipments, sellerId, onChanged }: { orderId: string; shipments?: Shipment[]; sellerId?: string; onChanged?: () => void }) {
  const [busy, setBusy] = useState('');
  const list = (shipments || []).filter((s) => !sellerId || s.seller_id === sellerId);
  if (list.length === 0) return null;

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res?.label_url) Linking.openURL(res.label_url);
      else notify(res?.message || 'Request completed.');
      onChanged?.();
    } catch (e: any) {
      notify(e?.message || 'Request failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <View testID={`shipment-panel-${orderId}`} style={s.wrap}>
      <Text style={s.title}>Delhivery shipments</Text>
      {list.map((sh) => {
        const base = `/store/shipments/${orderId}/${sh.seller_id}`;
        const hasAwb = !!sh.tracking_number;
        const canRetry = !hasAwb && ['needs_attention', 'test_mode_waiting', 'live_shipments_disabled', 'not_started'].includes(sh.delhivery_status || '');
        return (
          <View key={sh.seller_id} style={s.row}>
            <Text style={s.shop}>{sh.shop_name || sh.seller_id}</Text>
            <Text testID={`shipment-status-${orderId}-${sh.seller_id}`} style={s.meta}>
              {sh.shipment_status || STATUS_TEXT[sh.delhivery_status || 'not_started'] || sh.delhivery_status}
              {sh.last_status ? ` · ${sh.last_status}` : ''}
            </Text>
            <Text style={s.meta}>AWB: {sh.tracking_number || '— (not created yet)'}</Text>
            {!!sh.pickup_request_status && <Text style={s.meta}>Pickup: {sh.pickup_request_status}{sh.pickup_date ? ` · ${sh.pickup_date}` : ''}</Text>}
            {!!sh.delhivery_error && <Text style={s.err}>{sh.delhivery_error}</Text>}
            <View style={s.actions}>
              {hasAwb && <Act testID={`shipment-label-${orderId}`} label={busy === 'label' ? '…' : 'Label / AWB'} onPress={() => run('label', () => apiClient.get(`${base}/label`))} />}
              {hasAwb && !!sh.tracking_url && <Act testID={`shipment-track-${orderId}`} label="Track" onPress={() => Linking.openURL(sh.tracking_url!)} />}
              {hasAwb && <Act testID={`shipment-refresh-${orderId}`} label={busy === 'refresh' ? '…' : 'Refresh'} onPress={() => run('refresh', () => apiClient.get(`/store/orders/${orderId}/delhivery-tracking`))} />}
              {canRetry && <Act testID={`shipment-retry-${orderId}`} label={busy === 'retry' ? '…' : 'Create shipment'} onPress={() => run('retry', () => apiClient.post(`${base}/retry`, {}))} />}
              {sh.delhivery_status !== 'cancelled' && !['Delivered', 'Returned to Origin'].includes(sh.shipment_status || '') && (
                <Act testID={`shipment-cancel-${orderId}`} danger label={busy === 'cancel' ? '…' : 'Cancel shipment'} onPress={() => {
                  if (Platform.OS !== 'web' || window.confirm(`Cancel the shipment from ${sh.shop_name || 'this seller'}? Stock will be returned to inventory.`)) {
                    run('cancel', () => apiClient.post(`${base}/cancel`, {}));
                  }
                }} />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Act({ label, onPress, danger, testID }: { label: string; onPress: () => void; danger?: boolean; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[s.btn, danger && { borderColor: '#B91C1C' }]}>
      <Text style={[s.btnText, danger && { color: '#B91C1C' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#F1F8FE', gap: 8 },
  title: { fontWeight: '800', color: '#1E7FC2', fontSize: 13 },
  row: { gap: 3, borderTopWidth: 1, borderTopColor: '#DCEBF7', paddingTop: 6 },
  shop: { fontWeight: '700', color: '#1F2A37', fontSize: 13 },
  meta: { color: '#4B5563', fontSize: 12 },
  err: { color: '#B91C1C', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  btn: { borderWidth: 1, borderColor: '#1E7FC2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  btnText: { color: '#1E7FC2', fontWeight: '700', fontSize: 12 },
});
