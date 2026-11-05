import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Product, useStore } from '../StoreContext';
import { C, money } from '../theme';

export function ProductCard({ product, width }: { product: Product; width: string }) {
  const { t, pName, cat, addToCart, wishlist, toggleWishlist } = useStore();
  const [added, setAdded] = useState(false);
  const stock = Number(product.stock ?? 0);
  const liked = wishlist.includes(product.id);

  const onAdd = () => {
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <View style={[s.cell, { width: width as any }]}>
      <Pressable testID={`product-card-${product.id}`} style={s.card} onPress={() => router.push({ pathname: '/store/product', params: { id: product.id } })}>
        <View style={s.imgWrap}>
          {product.image_url ? <Image source={{ uri: product.image_url }} style={s.img} resizeMode="cover" /> : <View style={[s.img, s.imgEmpty]} />}
          <Pressable testID={`product-wishlist-toggle-${product.id}`} onPress={() => toggleWishlist(product.id)} style={s.heart} hitSlop={8}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? C.saffron : C.ink} />
          </Pressable>
          {stock > 0 && stock <= 5 && <Text style={s.lowStock}>{t('onlyLeft', { n: stock })}</Text>}
        </View>
        <View style={s.body}>
          {!!product.category && <Text style={s.cat} numberOfLines={1}>{cat(product.category)}</Text>}
          <Text style={s.name} numberOfLines={2}>{pName(product)}</Text>
          <Text testID={`product-price-${product.id}`} style={s.price}>{money(product.price)}</Text>
        </View>
      <Pressable
        testID={`product-add-to-cart-${product.id}`}
        disabled={stock <= 0}
        onPress={onAdd}
        style={({ pressed }) => [s.addBtn, stock <= 0 && s.addDisabled, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name={added ? 'checkmark' : 'cart-outline'} size={16} color={C.white} />
        <Text style={s.addText}>{stock <= 0 ? t('outOfStock') : added ? t('added') : t('addToCart')}</Text>
      </Pressable>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  cell: { padding: 7 },
  card: { flex: 1, backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  imgWrap: { width: '100%', aspectRatio: 1, backgroundColor: C.primaryLight },
  img: { width: '100%', height: '100%' },
  imgEmpty: { backgroundColor: C.primaryLight },
  heart: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: 7 },
  lowStock: { position: 'absolute', bottom: 8, left: 8, backgroundColor: C.saffronLight, color: C.saffronDark, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  body: { padding: 12, gap: 4, minHeight: 104, flexGrow: 1 },
  cat: { fontSize: 11, color: C.primaryDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontSize: 15, color: C.ink, fontWeight: '600', lineHeight: 20 },
  price: { fontSize: 17, color: C.ink, fontWeight: '800', marginTop: 2 },
  addBtn: { margin: 12, marginTop: 0, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 12, paddingVertical: 10 },
  addDisabled: { backgroundColor: '#9CA3AF' },
  addText: { color: C.white, fontWeight: '700', fontSize: 14 },
});
