import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { useStore } from '@/src/store/StoreContext';
import { statusKey } from '@/src/store/i18n';
import { Page, Loading } from '@/src/store/components/Page';
import { Btn, Card, Notice, StatusChip } from '@/src/store/components/ui';
import { C, formatDate, money, shortId } from '@/src/store/theme';

export default function OrdersScreen() {
  const { t, plural } = useStore();
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/store/orders/my-orders').then((r) => setOrders(r || [])).catch((e) => { setError(e.message); setOrders([]); });
  }, []);

  return (
    <Page testID="orders-page" title={t('myOrders')}>
      {!!error && <Notice tone="error" text={error} testID="orders-error" />}
      {orders === null ? <Loading text={t('loading')} /> : orders.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text testID="orders-empty-message" style={s.empty}>{t('noOrders')}</Text>
          <Btn testID="orders-start-shopping-button" label={t('startShopping')} onPress={() => router.replace('/store')} />
        </Card>
      ) : orders.map((o) => (
        <Pressable key={o.id} testID={`order-card-${o.id}`} onPress={() => router.push({ pathname: '/store/order', params: { id: o.id } })}>
          <Card>
            <View style={s.top}>
              <View>
                <Text style={s.id}>{shortId(o.id)}</Text>
                <Text style={s.meta}>{t('orderedOn')} {formatDate(o.created_at)}</Text>
              </View>
              <StatusChip status={o.order_status} label={t(statusKey(o.order_status))} testID={`order-status-${o.id}`} />
            </View>
            <View style={s.thumbs}>
              {(o.items || []).slice(0, 4).map((it: any) => (
                <Image key={it.product_id} source={{ uri: it.image_url }} style={s.thumb} />
              ))}
              <Text style={s.meta}>{plural((o.items || []).reduce((n: number, it: any) => n + Number(it.quantity || 0), 0))}</Text>
            </View>
            <View style={s.top}>
              <Text style={s.meta}>{t('payment')}: {o.payment_status === 'paid' ? t('paid') : o.payment_method === 'cod' ? t('codPending') : t('pending')}</Text>
              <Text testID={`order-total-${o.id}`} style={s.total}>{money(o.total_amount)}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </Page>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 17, color: C.muted, fontWeight: '600', marginBottom: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  id: { fontSize: 16, fontWeight: '800', color: C.ink },
  meta: { fontSize: 13, color: C.muted },
  total: { fontSize: 17, fontWeight: '800', color: C.ink },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: C.primaryLight },
});
