import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/src/store/StoreContext';
import { Page, SectionTitle } from '@/src/store/components/Page';
import { Btn, Card, Notice, QtyStepper, Row } from '@/src/store/components/ui';
import { C, money, useLayout } from '@/src/store/theme';

export default function CartScreen() {
  const { t, pName, cart, setQty, cartCount, plural } = useStore();
  const { isWide } = useLayout();
  const lines = Object.values(cart);
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const sellers = new Set(lines.map((l) => l.product.seller_id || ''));

  if (lines.length === 0) {
    return (
      <Page testID="cart-page" title={t('cart')}>
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text testID="cart-empty-message" style={s.empty}>{t('emptyCart')}</Text>
          <Btn testID="cart-start-shopping-button" label={t('startShopping')} onPress={() => router.replace('/store')} />
        </Card>
      </Page>
    );
  }

  return (
    <Page testID="cart-page" title={t('cart')}>
      <View style={[{ gap: 16 }, isWide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={[{ gap: 10 }, isWide && { flex: 2 }]}>
          {lines.map(({ product, quantity }) => (
            <Card key={product.id} style={s.line}>
              <Pressable onPress={() => router.push({ pathname: '/store/product', params: { id: product.id } })}>
                <Image source={{ uri: product.image_url }} style={s.img} />
              </Pressable>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.name} numberOfLines={2}>{pName(product)}</Text>
                <Text style={s.price}>{money(product.price)}</Text>
                <View style={s.lineActions}>
                  <QtyStepper testID={`cart-qty-${product.id}`} value={quantity} max={Math.min(Number(product.stock ?? 50), 50)} onChange={(n) => setQty(product.id, n)} />
                  <Pressable testID={`cart-remove-${product.id}`} onPress={() => setQty(product.id, 0)}>
                    <Text style={s.remove}>{t('remove')}</Text>
                  </Pressable>
                </View>
              </View>
              <Text testID={`cart-line-total-${product.id}`} style={s.lineTotal}>{money(product.price * quantity)}</Text>
            </Card>
          ))}
          {sellers.size > 1 && <Notice tone="info" text={t('multiSellerNote', { n: sellers.size })} testID="cart-multi-seller-note" />}
        </View>
        <Card style={isWide ? { flex: 1 } : undefined}>
          <SectionTitle>{t('orderSummary')}</SectionTitle>
          <Row label={`${t('subtotal')} (${plural(cartCount)})`} value={money(subtotal)} testID="cart-subtotal" />
          <Btn testID="cart-checkout-button" label={t('proceedCheckout')} onPress={() => router.push('/store/checkout')} />
        </Card>
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 17, color: C.muted, fontWeight: '600', marginBottom: 8 },
  line: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  img: { width: 84, height: 84, borderRadius: 12, backgroundColor: C.primaryLight },
  name: { fontSize: 15, fontWeight: '600', color: C.ink },
  price: { fontSize: 14, color: C.muted },
  lineActions: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  remove: { color: C.danger, fontWeight: '700', fontSize: 14 },
  lineTotal: { fontSize: 16, fontWeight: '800', color: C.ink },
});
