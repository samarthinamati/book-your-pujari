import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Product, useStore } from '@/src/store/StoreContext';
import { Page, Loading } from '@/src/store/components/Page';
import { ProductCard } from '@/src/store/components/ProductCard';
import { Btn, Card } from '@/src/store/components/ui';
import { C, useLayout } from '@/src/store/theme';

export default function WishlistScreen() {
  const { t, wishlist } = useStore();
  const { cols } = useLayout();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    apiClient.get('/store/favourites').then((r) => setProducts(r || [])).catch(() => setProducts([]));
  }, []);

  const visible = (products || []).filter((p) => wishlist.includes(p.id));

  return (
    <Page testID="wishlist-page" title={t('wishlist')}>
      {products === null ? <Loading text={t('loading')} /> : visible.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text testID="wishlist-empty-message" style={s.empty}>{t('emptyWishlist')}</Text>
          <Btn testID="wishlist-start-shopping-button" label={t('startShopping')} onPress={() => router.replace('/store')} />
        </Card>
      ) : (
        <View style={s.grid}>
          {visible.map((p) => <ProductCard key={p.id} product={p} width={`${100 / cols}%`} />)}
        </View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 17, color: C.muted, fontWeight: '600', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7 },
});
