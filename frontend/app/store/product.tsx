import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Product, useStore } from '@/src/store/StoreContext';
import { Page, Loading, SectionTitle } from '@/src/store/components/Page';
import { Btn, Card, Notice, QtyStepper } from '@/src/store/components/ui';
import { C, money, useLayout } from '@/src/store/theme';

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, pName, pDesc, cat, addToCart, wishlist, toggleWishlist } = useStore();
  const { isWide } = useLayout();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/store/products/${id}`).then(setProduct).catch((e) => setError(e.message));
    apiClient.get(`/store/products/${id}/reviews`).then((r) => setReviews(r || [])).catch(() => setReviews([]));
    apiClient.post('/store/recently-viewed', { product_id: id }).catch(() => {});
  }, [id]);

  if (error) return <Page testID="product-page"><Notice tone="error" text={error} testID="product-error" /></Page>;
  if (!product) return <Page testID="product-page"><Loading text={t('loading')} /></Page>;

  const images = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];
  const stock = Number(product.stock ?? 0);
  const liked = wishlist.includes(product.id);

  const onAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };
  const onBuyNow = () => router.push({ pathname: '/store/checkout', params: { buyNow: product.id, qty: String(qty) } });

  return (
    <Page testID="product-page">
      <View style={[s.wrap, isWide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={[s.gallery, isWide && { flex: 1 }]}>
          <View style={s.mainImgWrap}>
            {images[active] ? <Image testID="product-main-image" source={{ uri: images[active] }} style={s.mainImg} resizeMode="cover" /> : null}
            <Pressable testID="product-detail-wishlist-toggle" onPress={() => toggleWishlist(product.id)} style={s.heart}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? C.saffron : C.ink} />
            </Pressable>
          </View>
          {images.length > 1 && (
            <View style={s.thumbs}>
              {images.map((uri, i) => (
                <Pressable key={uri} testID={`product-thumb-${i}`} onPress={() => setActive(i)} style={[s.thumb, i === active && s.thumbActive]}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={[s.info, isWide && { flex: 1 }]}>
          {!!product.category && <Text style={s.cat}>{cat(product.category)}</Text>}
          <Text testID="product-name" style={s.name}>{pName(product)}</Text>
          {!!product.review_count && (
            <Text style={s.rating}>★ {product.average_rating} · {product.review_count} {t('reviews')}</Text>
          )}
          <Text testID="product-detail-price" style={s.price}>{money(product.price)}</Text>
          <View style={s.badges}>
            <Text testID="product-stock-status" style={[s.badge, stock > 0 ? s.badgeOk : s.badgeBad]}>
              {stock <= 0 ? t('outOfStock') : stock <= 5 ? t('onlyLeft', { n: stock }) : t('inStock')}
            </Text>
            <Text testID="product-return-policy" style={[s.badge, s.badgeNeutral]}>{product.is_returnable ? t('returnable') : t('nonReturnable')}</Text>
          </View>
          {!!product.shop_name && <Text style={s.meta}>{t('soldBy')}: <Text style={s.metaStrong}>{product.shop_name}</Text></Text>}
          {!!product.weight_grams && <Text style={s.meta}>{t('weight')}: <Text style={s.metaStrong}>{product.weight_grams} g</Text></Text>}

          {stock > 0 && (
            <>
              <Text style={s.meta}>{t('quantity')}</Text>
              <QtyStepper testID="product-qty" value={qty} max={Math.min(stock, 50)} onChange={(n) => setQty(Math.max(1, n))} />
              <View style={s.actions}>
                <Btn testID="product-add-to-cart-button" variant="outline" icon={added ? 'checkmark' : 'cart-outline'} label={added ? t('added') : t('addToCart')} onPress={onAdd} />
                <Btn testID="product-buy-now-button" variant="saffron" icon="flash-outline" label={t('buyNow')} onPress={onBuyNow} />
              </View>
            </>
          )}

          <Card>
            <SectionTitle>{t('description')}</SectionTitle>
            <Text testID="product-description" style={s.desc}>{pDesc(product)}</Text>
          </Card>
        </View>
      </View>

      <Card>
        <SectionTitle>{t('reviews')}</SectionTitle>
        {reviews.length === 0 ? <Text style={s.meta}>{t('noReviews')}</Text> : reviews.map((r) => (
          <View key={r.id} style={s.review}>
            <Text style={s.metaStrong}>{'★'.repeat(Number(r.rating || 0))} {r.customer_name || ''}</Text>
            {!!r.comment && <Text style={s.desc}>{r.comment}</Text>}
          </View>
        ))}
      </Card>
    </Page>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 20 },
  gallery: { gap: 10 },
  mainImgWrap: { width: '100%', aspectRatio: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: C.primaryLight, maxWidth: 560 },
  mainImg: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, padding: 9 },
  thumbs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  thumb: { width: 68, height: 68, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: C.primary },
  info: { gap: 10 },
  cat: { fontSize: 12, fontWeight: '800', color: C.primaryDark, letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 26, fontWeight: '800', color: C.ink, lineHeight: 33 },
  rating: { fontSize: 14, color: C.saffronDark, fontWeight: '700' },
  price: { fontSize: 28, fontWeight: '800', color: C.ink },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  badgeOk: { backgroundColor: C.successBg, color: C.success },
  badgeBad: { backgroundColor: C.dangerBg, color: C.danger },
  badgeNeutral: { backgroundColor: C.bg, color: C.ink, borderWidth: 1, borderColor: C.line },
  meta: { fontSize: 14, color: C.muted },
  metaStrong: { color: C.ink, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginVertical: 6 },
  desc: { fontSize: 15, color: C.ink, lineHeight: 23 },
  review: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 4 },
});
