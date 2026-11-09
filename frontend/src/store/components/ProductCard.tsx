import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Product, useStore } from '../StoreContext';
import { C, money } from '../theme';

export function ProductCard({ product, width }: { product: Product; width: string }) {
  const { t, pName, cat, addToCart, wishlist, toggleWishlist } = useStore();

  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const stock = Number(product.stock ?? 0);
  const liked = wishlist.includes(product.id);

  const rating = Number(product.rating ?? 0);
  const reviewCount = Number(product.review_count ?? product.reviews_count ?? 0);

  const isLowStock = stock > 0 && stock <= 5;
  const isOutOfStock = stock <= 0;
  const isPopular = rating >= 4.5 && reviewCount >= 3;

  const onAdd = () => {
    if (stock <= 0) return;

    addToCart(product, 1);
    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1200);
  };

  const openProduct = () => {
    router.push({
      pathname: '/store/product',
      params: { id: product.id },
    });
  };

  return (
    <View style={[s.cell, { width: width as any }]}>
      <View style={s.card}>
        <Pressable
          testID={`product-card-${product.id}`}
          style={({ pressed }) => [
            s.productArea,
            pressed && { opacity: 0.96 },
          ]}
          onPress={openProduct}
        >
          {/* Product image */}
          <View style={s.imgWrap}>
            {product.image_url && !imageFailed ? (
              <Image
                source={{ uri: product.image_url }}
                style={s.img}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <View style={[s.img, s.imgEmpty]}>
                <Ionicons
                  name="image-outline"
                  size={34}
                  color={C.primaryDark}
                />
                <Text style={s.imagePlaceholder}>No image</Text>
              </View>
            )}

            {/* Wishlist */}
            <Pressable
              testID={`product-wishlist-toggle-${product.id}`}
              onPress={() => toggleWishlist(product.id)}
              style={({ pressed }) => [
                s.heart,
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              hitSlop={8}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={19}
                color={liked ? C.saffron : C.ink}
              />
            </Pressable>

            {/* Popular badge */}
            {isPopular && (
              <View style={s.popularBadge}>
                <Ionicons name="flame" size={12} color={C.saffronDark} />
                <Text style={s.popularText}>Popular</Text>
              </View>
            )}

            {/* Stock badge */}
            {isLowStock && (
              <Text style={s.lowStock}>
                {t('onlyLeft', { n: stock })}
              </Text>
            )}

            {isOutOfStock && (
              <View style={s.outBadge}>
                <Text style={s.outBadgeText}>{t('outOfStock')}</Text>
              </View>
            )}
          </View>

          {/* Product information */}
          <View style={s.body}>
            {!!product.category && (
              <Text style={s.cat} numberOfLines={1}>
                {cat(product.category)}
              </Text>
            )}

            <Text style={s.name} numberOfLines={2}>
              {pName(product)}
            </Text>

            {/* Rating */}
            {rating > 0 && (
              <View style={s.ratingRow}>
                <View style={s.ratingBadge}>
                  <Ionicons name="star" size={11} color={C.white} />
                  <Text style={s.ratingText}>
                    {rating.toFixed(1)}
                  </Text>
                </View>

                {reviewCount > 0 && (
                  <Text style={s.reviewText}>
                    ({reviewCount})
                  </Text>
                )}
              </View>
            )}

            {/* Seller */}
            {!!product.seller_name && (
              <Text style={s.seller} numberOfLines={1}>
                Sold by {product.seller_name}
              </Text>
            )}

            <Text
              testID={`product-price-${product.id}`}
              style={s.price}
            >
              {money(product.price)}
            </Text>

            {product.weight_grams != null && Number(product.weight_grams) > 0 && (
              <Text style={s.weight}>
                {Number(product.weight_grams) >= 1000
                  ? `${(Number(product.weight_grams) / 1000).toFixed(2)} kg`
                  : `${Number(product.weight_grams)} g`}
              </Text>
            )}
          </View>
        </Pressable>

        {/* Add to cart */}
        <Pressable
          testID={`product-add-to-cart-${product.id}`}
          disabled={isOutOfStock}
          onPress={onAdd}
          style={({ pressed }) => [
            s.addBtn,
            isOutOfStock && s.addDisabled,
            added && s.addedBtn,
            pressed && !isOutOfStock && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name={
              isOutOfStock
                ? 'close-circle-outline'
                : added
                  ? 'checkmark-circle'
                  : 'cart-outline'
            }
            size={17}
            color={C.white}
          />

          <Text style={s.addText}>
            {isOutOfStock
              ? t('outOfStock')
              : added
                ? t('added')
                : t('addToCart')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cell: {
    padding: 7,
  },

  card: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
  },

  productArea: {
    flex: 1,
  },

  imgWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: C.primaryLight,
    position: 'relative',
  },

  img: {
    width: '100%',
    height: '100%',
  },

  imgEmpty: {
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  imagePlaceholder: {
    marginTop: 4,
    fontSize: 11,
    color: C.primaryDark,
    fontWeight: '600',
  },

  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    padding: 8,
    elevation: 2,
  },

  popularBadge: {
    position: 'absolute',
    top: 9,
    left: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.saffronLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  popularText: {
    color: C.saffronDark,
    fontSize: 10,
    fontWeight: '800',
  },

  lowStock: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: C.saffronLight,
    color: C.saffronDark,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  outBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(17,24,39,0.88)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  outBadgeText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '800',
  },

  body: {
    padding: 12,
    gap: 4,
    minHeight: 138,
    flexGrow: 1,
  },

  cat: {
    fontSize: 10,
    color: C.primaryDark,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  name: {
    fontSize: 15,
    color: C.ink,
    fontWeight: '600',
    lineHeight: 20,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#16803C',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },

  ratingText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '800',
  },

  reviewText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  seller: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '500',
  },

  price: {
    fontSize: 18,
    color: C.ink,
    fontWeight: '900',
    marginTop: 2,
  },

  weight: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '600',
  },

  addBtn: {
    margin: 12,
    marginTop: 0,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },

  addedBtn: {
    backgroundColor: '#16803C',
  },

  addDisabled: {
    backgroundColor: '#9CA3AF',
  },

  addText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 13,
  },
});
