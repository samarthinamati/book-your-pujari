import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { useStore } from '@/src/store/StoreContext';
import { statusKey } from '@/src/store/i18n';
import { Page, Loading, SectionTitle } from '@/src/store/components/Page';
import { Btn, Card, Notice, Row, StatusChip } from '@/src/store/components/ui';
import { C, formatDate, money, shortId, useLayout } from '@/src/store/theme';

const STEPS = ['Order Placed', 'Preparing', 'Shipped', 'Out for Delivery', 'Delivered'];

export default function OrderDetails() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const { t } = useStore();
  const { isWide } = useLayout();
  const [order, setOrder] = useState<any>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [trackMsg, setTrackMsg] = useState('');

  const load = useCallback(() => {
    apiClient.get(`/store/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
    apiClient.get('/store/customer/returns').then((r) => setReturns((r || []).filter((x: any) => x.order_id === id))).catch(() => {});
  }, [id]);

  const refreshTracking = async () => {
    setRefreshing(true);
    setTrackMsg('');
    try {
      await apiClient.get(`/store/orders/${id}/delhivery-tracking`);
      load();
    } catch {
      setTrackMsg(t('trackingUnavailable'));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id, load]);

  if (error) return <Page testID="order-page" title={t('orderDetails')}><Notice tone="error" text={error} testID="order-error" /></Page>;
  if (!order) return <Page testID="order-page" title={t('orderDetails')}><Loading text={t('loading')} /></Page>;

  const cancelled = order.order_status === 'Cancelled';
  const stepIndex = Math.max(0, STEPS.indexOf(order.order_status));
  const deliveredAt = order.delivered_at ? new Date(order.delivered_at.endsWith('Z') ? order.delivered_at : `${order.delivered_at}Z`) : null;
  const returnOpen = order.order_status === 'Delivered' && !!deliveredAt && Date.now() - deliveredAt.getTime() <= 7 * 86400000;

  return (
    <Page testID="order-page" title={t('orderDetails')}>
      {placed === '1' && (
        <Notice tone="success" testID="order-success-banner" text={`${t('orderPlaced')}${order.payment_status === 'paid' ? ` · ${t('paymentVerified')}` : ''}`} />
      )}
      {order.refund_status === 'pending_admin_action' && <Notice tone="demo" testID="order-refund-pending" text={`${t('refundPending')} (${money(order.refund_due_amount)})`} />}
      {order.refund_status === 'refunded' && <Notice tone="success" testID="order-refunded" text={`${t('refunded')} (${money(order.refund_due_amount)})`} />}
      <Card>
        <View style={s.top}>
          <View>
            <Text testID="order-id" style={s.id}>{shortId(order.id)}</Text>
            <Text style={s.muted}>{t('orderedOn')} {formatDate(order.created_at)}</Text>
          </View>
          <StatusChip status={order.order_status} label={t(statusKey(order.order_status))} testID="order-detail-status" />
        </View>
        {!cancelled && (
          <View style={[s.timeline, isWide && { flexDirection: 'row' }]}>
            {STEPS.map((step, i) => (
              <View key={step} testID={`order-step-${i}`} style={[s.step, isWide && { flex: 1 }]}>
                <View style={[s.dot, i <= stepIndex && s.dotDone]}>
                  {i <= stepIndex && <Ionicons name="checkmark" size={12} color={C.white} />}
                </View>
                <Text style={[s.stepText, i <= stepIndex && { color: C.ink, fontWeight: '700' }]}>{t(statusKey(step))}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <View style={[{ gap: 16 }, isWide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={[{ gap: 16 }, isWide && { flex: 3 }]}>
          <Card>
            <View style={s.top}>
              <SectionTitle>{t('tracking')}</SectionTitle>
              {(order.shipments || []).some((sh: any) => sh.tracking_number) && (
                <Pressable testID="order-refresh-tracking" onPress={refreshTracking}>
                  <Text style={s.link}>{refreshing ? t('loading') : t('refreshTracking')}</Text>
                </Pressable>
              )}
            </View>
            {!!trackMsg && <Text style={s.muted}>{trackMsg}</Text>}
            {(order.shipments || []).length === 0 || !(order.shipments || []).some((sh: any) => sh.tracking_number) ? (
              <Text testID="order-tracking-pending" style={s.muted}>{t('trackingPending')}</Text>
            ) : null}
            {(order.shipments || []).filter((sh: any) => sh.tracking_number).map((sh: any) => (
              <View key={sh.seller_id} testID={`order-shipment-${sh.seller_id}`} style={s.item}>
                <Text style={s.itemName}>{t('shipmentFrom')}: {sh.shop_name}</Text>
                <Row label={t('courier')} value={sh.courier || 'Delhivery'} />
                <Row label={t('awb')} value={sh.tracking_number} testID="order-tracking-number" />
                <Row label={t('status')} value={sh.shipment_status ? t(statusKey(sh.shipment_status)) : '—'} />
                {(sh.scans || []).slice().reverse().slice(0, 6).map((sc: any, i: number) => (
                  <Text key={i} style={s.muted}>• {sc.status}{sc.location ? ` · ${sc.location}` : ''}{sc.time ? ` · ${formatDate(sc.time)}` : ''}</Text>
                ))}
                {!!sh.tracking_url && (
                  <Btn testID="order-open-tracking" variant="outline" icon="open-outline" label={t('openTracking')} onPress={() => Linking.openURL(sh.tracking_url)} />
                )}
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle>{t('orderItems')}</SectionTitle>
            {(order.items || []).map((it: any) => (
              <OrderItem key={it.product_id} item={it} orderId={order.id} returnOpen={returnOpen}
                existingReturn={returns.find((r) => r.product_id === it.product_id)} onReturned={load} />
            ))}
            {order.order_status === 'Delivered' && !returnOpen && <Text style={s.muted}>{t('returnClosed')}</Text>}
            {order.order_status !== 'Delivered' && <Text style={s.muted}>{t('returnWindow')}</Text>}
          </Card>
        </View>

        <View style={[{ gap: 16 }, isWide && { flex: 2 }]}>
          <Card>
            <SectionTitle>{t('orderSummary')}</SectionTitle>
            <Row label={t('subtotal')} value={money(order.product_subtotal)} />
            {order.discount_amount > 0 && <Row label={t('discount')} value={`− ${money(order.discount_amount)}`} />}
            <Row label={t('platformFee')} value={money(order.platform_fee)} />
            <Row label={t('shipping')} value={money(order.shipping_fee)} tag={order.shipping_is_demo ? 'DEMO' : undefined} />
            {order.cod_fee > 0 && <Row label={t('codFee')} value={money(order.cod_fee)} />}
            <Row bold label={t('total')} value={money(order.total_amount)} testID="order-detail-total" />
            <Row label={t('payment')} testID="order-payment-status"
              value={order.payment_status === 'paid' ? `${t('paid')} · Razorpay` : order.payment_method === 'cod' ? t('codPending') : t('pending')} />
          </Card>
          <Card>
            <SectionTitle>{t('deliverTo')}</SectionTitle>
            <Text style={s.addr}>{order.customer_name} · {order.customer_phone}</Text>
            <Text style={s.muted}>{order.delivery_address}, {order.city} - {order.pincode}</Text>
          </Card>
        </View>
      </View>
    </Page>
  );
}

function OrderItem({ item, orderId, returnOpen, existingReturn, onReturned }: any) {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await apiClient.post('/store/returns/request', { order_id: orderId, product_id: item.product_id, quantity: item.quantity, reason: reason.trim() });
      setOpen(false);
      onReturned();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.item}>
      <View style={s.itemRow}>
        <Image source={{ uri: item.image_url }} style={s.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={s.itemName}>{item.name}</Text>
          <Text style={s.muted}>{money(item.unit_price)} × {item.quantity} · {item.is_returnable ? t('returnable') : t('nonReturnable')}</Text>
          {!!item.shop_name && <Text style={s.muted}>{t('soldBy')}: {item.shop_name}</Text>}
        </View>
        <Text style={s.itemPrice}>{money(item.line_total)}</Text>
      </View>
      {existingReturn ? (
        <Text testID={`order-return-status-${item.product_id}`} style={s.returnTag}>{t('returnRequested')} · {existingReturn.status}</Text>
      ) : returnOpen && item.is_returnable ? (
        open ? (
          <View style={{ gap: 8 }}>
            <TextInput testID={`order-return-reason-${item.product_id}`} value={reason} onChangeText={setReason} placeholder={t('returnReason')} placeholderTextColor="#9CA3AF" multiline style={s.input} />
            {!!err && <Text style={{ color: C.danger }}>{err}</Text>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn testID={`order-return-submit-${item.product_id}`} label={t('submitReturn')} loading={busy} disabled={reason.trim().length < 5} onPress={submit} />
              <Btn testID={`order-return-cancel-${item.product_id}`} variant="outline" label={t('cancel')} onPress={() => setOpen(false)} />
            </View>
          </View>
        ) : (
          <Pressable testID={`order-request-return-${item.product_id}`} onPress={() => setOpen(true)}>
            <Text style={s.link}>{t('requestReturn')}</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  id: { fontSize: 20, fontWeight: '800', color: C.ink },
  muted: { fontSize: 13, color: C.muted, lineHeight: 19 },
  timeline: { gap: 10, marginTop: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  dotDone: { backgroundColor: C.success, borderColor: C.success },
  stepText: { fontSize: 13, color: C.muted, flexShrink: 1 },
  item: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 8 },
  itemRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: C.primaryLight },
  itemName: { fontSize: 15, fontWeight: '700', color: C.ink },
  itemPrice: { fontSize: 15, fontWeight: '800', color: C.ink },
  addr: { fontSize: 15, fontWeight: '700', color: C.ink },
  link: { color: C.primaryDark, fontWeight: '700', fontSize: 14 },
  returnTag: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: C.demo, backgroundColor: C.demoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 14, color: C.ink, backgroundColor: C.white },
});
