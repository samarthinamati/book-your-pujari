import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { apiClient } from '@/src/api/client';
import { Product, useStore } from '@/src/store/StoreContext';
import {
  Page,
  Loading,
  SectionTitle,
} from '@/src/store/components/Page';
import {
  Btn,
  Card,
  Notice,
  QtyStepper,
} from '@/src/store/components/ui';
import { ProductCard } from '@/src/store/components/ProductCard';
import { C, money, useLayout } from '@/src/store/theme';

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    t,
    pName,
    pDesc,
    cat,
    addToCart,
    wishlist,
    toggleWishlist,
  } = useStore();

  const { isWide } = useLayout();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Product not found.');
      return;
    }

    setProduct(null);
    setError('');
    setActive(0);
    setQty(1);
    setRecommended([]);
    setRecentlyViewed([]);

    // Load product
    apiClient
      .get(`/store/products/${id}`)
      .then((data) => {
        if (!data) {
          setError('Product not found.');
          return;
        }

        setProduct(data);
      })
      .catch((e) => {
        setError(
          e?.message || 'Unable to load product.'
        );
      });

    // Load reviews
    apiClient
      .get(`/store/products/${id}/reviews`)
      .then((r) =>
        setReviews(Array.isArray(r) ? r : [])
      )
      .catch(() => setReviews([]));

    // Save recently viewed
    apiClient
      .post('/store/recently-viewed', {
        product_id: id,
      })
      .catch(() => {});

    // Load recently viewed
    apiClient
      .get('/store/recently-viewed')
      .then((r) => {
        if (Array.isArray(r)) {
          setRecentlyViewed(
            r
              .filter((p: Product) => String(p.id) !== String(id))
              .slice(0, 10)
          );
        }
      })
      .catch(() => {
        setRecentlyViewed([]);
      });

    // Load products for recommendations
    apiClient
      .get('/store/products')
      .then((r) => {
        if (Array.isArray(r)) {
          setRecommended(
            r.filter(
              (p: Product) =>
                String(p.id) !== String(id)
            )
          );
        }
      })
      .catch(() => {
        setRecommended([]);
      });
  }, [id]);

  const similarProducts = useMemo(() => {
    if (!product) return [];

    const sameCategory = recommended.filter(
      (p) =>
        p.category &&
        product.category &&
        String(p.category).toLowerCase() ===
          String(product.category).toLowerCase()
    );

    return sameCategory.slice(0, 10);
  }, [product, recommended]);

  const popularProducts = useMemo(() => {
    return [...recommended]
      .filter(
        (p) =>
          Number(p.average_rating ?? 0) >= 4
      )
      .sort(
        (a, b) =>
          Number(b.average_rating ?? 0) -
          Number(a.average_rating ?? 0)
      )
      .slice(0, 10);
  }, [recommended]);

  if (error) {
    return (
      <Page testID="product-page">
        <Notice
          tone="error"
          text={error}
          testID="product-error"
        />

        <View style={s.errorActions}>
          <Btn
            label="Back to Store"
            icon="arrow-back"
            onPress={() =>
              router.replace('/store')
            }
          />
        </View>
      </Page>
    );
  }

  if (!product) {
    return (
      <Page testID="product-page">
        <Loading text={t('loading')} />
      </Page>
    );
  }

  const images =
    Array.isArray(product.images) &&
    product.images.length > 0
      ? product.images
      : product.image_url
        ? [product.image_url]
        : [];

  const stock = Number(product.stock ?? 0);

  const liked = wishlist.includes(product.id);

  const rating = Number(
    product.average_rating ?? 0
  );

  const reviewCount = Number(
    product.review_count ?? 0
  );

  const isPopular =
    rating >= 4.5 &&
    reviewCount >= 3;

  const isLowStock =
    stock > 0 && stock <= 5;

  const onAdd = () => {
    if (stock <= 0) return;

    addToCart(product, qty);
    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1500);
  };

  const onBuyNow = () => {
    if (stock <= 0) return;

    router.push({
      pathname: '/store/checkout',
      params: {
        buyNow: product.id,
        qty: String(qty),
      },
    });
  };

  const openCart = () => {
    router.push('/store/cart');
  };

  return (
    <Page testID="product-page">
      <View
        style={[
          s.wrap,
          isWide && {
            flexDirection: 'row',
            alignItems: 'flex-start',
          },
        ]}
      >
        {/* PRODUCT GALLERY */}
        <View
          style={[
            s.gallery,
            isWide && { flex: 1 },
          ]}
        >
          <View style={s.mainImgWrap}>
            {images[active] ? (
              <Image
                testID="product-main-image"
                source={{
                  uri: images[active],
                }}
                style={s.mainImg}
                resizeMode="cover"
              />
            ) : (
              <View style={s.imagePlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={48}
                  color={C.muted}
                />

                <Text style={s.placeholderText}>
                  No image available
                </Text>
              </View>
            )}

            <Pressable
              testID="product-detail-wishlist-toggle"
              onPress={() =>
                toggleWishlist(product.id)
              }
              style={s.heart}
            >
              <Ionicons
                name={
                  liked
                    ? 'heart'
                    : 'heart-outline'
                }
                size={22}
                color={
                  liked
                    ? C.saffron
                    : C.ink
                }
              />
            </Pressable>

            {isPopular && (
              <View style={s.popularBadge}>
                <Ionicons
                  name="flame"
                  size={14}
                  color={C.white}
                />

                <Text style={s.popularText}>
                  Popular
                </Text>
              </View>
            )}
          </View>

          {images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.thumbs}
            >
              {images.map((uri, i) => (
                <Pressable
                  key={`${uri}-${i}`}
                  testID={`product-thumb-${i}`}
                  onPress={() =>
                    setActive(i)
                  }
                  style={[
                    s.thumb,
                    i === active &&
                      s.thumbActive,
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={s.thumbImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* PRODUCT INFORMATION */}
        <View
          style={[
            s.info,
            isWide && { flex: 1 },
          ]}
        >
          {!!product.category && (
            <Text style={s.cat}>
              {cat(product.category)}
            </Text>
          )}

          <Text
            testID="product-name"
            style={s.name}
          >
            {pName(product)}
          </Text>

          {reviewCount > 0 && (
            <View style={s.ratingRow}>
              <View style={s.ratingBadge}>
                <Text style={s.ratingBadgeText}>
                  ★ {rating.toFixed(1)}
                </Text>
              </View>

              <Text style={s.ratingCount}>
                {reviewCount} {t('reviews')}
              </Text>
            </View>
          )}

          <Text
            testID="product-detail-price"
            style={s.price}
          >
            {money(product.price)}
          </Text>

          {/* STOCK + RETURN */}
          <View style={s.badges}>
            <Text
              testID="product-stock-status"
              style={[
                s.badge,
                stock > 0
                  ? s.badgeOk
                  : s.badgeBad,
              ]}
            >
              {stock <= 0
                ? t('outOfStock')
                : isLowStock
                  ? t('onlyLeft', {
                      n: stock,
                    })
                  : t('inStock')}
            </Text>

            <Text
              testID="product-return-policy"
              style={[
                s.badge,
                s.badgeNeutral,
              ]}
            >
              {product.is_returnable
                ? t('returnable')
                : t('nonReturnable')}
            </Text>
          </View>

          {/* SELLER */}
          {!!product.shop_name && (
            <View style={s.infoLine}>
              <Ionicons
                name="storefront-outline"
                size={17}
                color={C.muted}
              />

              <Text style={s.meta}>
                {t('soldBy')}:{' '}
                <Text style={s.metaStrong}>
                  {product.shop_name}
                </Text>
              </Text>
            </View>
          )}

          {/* WEIGHT */}
          {!!product.weight_grams && (
            <View style={s.infoLine}>
              <Ionicons
                name="cube-outline"
                size={17}
                color={C.muted}
              />

              <Text style={s.meta}>
                {t('weight')}:{' '}
                <Text style={s.metaStrong}>
                  {product.weight_grams} g
                </Text>
              </Text>
            </View>
          )}

          {/* QUANTITY + ACTIONS */}
          {stock > 0 && (
            <>
              <Text style={s.meta}>
                {t('quantity')}
              </Text>

              <QtyStepper
                testID="product-qty"
                value={qty}
                max={Math.min(
                  stock,
                  50
                )}
                onChange={(n) =>
                  setQty(
                    Math.max(1, n)
                  )
                }
              />

              <View style={s.actions}>
                <Btn
                  testID="product-add-to-cart-button"
                  variant="outline"
                  icon={
                    added
                      ? 'checkmark'
                      : 'cart-outline'
                  }
                  label={
                    added
                      ? t('added')
                      : t('addToCart')
                  }
                  onPress={onAdd}
                />

                <Btn
                  testID="product-buy-now-button"
                  variant="saffron"
                  icon="flash-outline"
                  label={t('buyNow')}
                  onPress={onBuyNow}
                />
              </View>

              {added && (
                <Pressable
                  onPress={openCart}
                  style={s.viewCart}
                >
                  <Ionicons
                    name="cart-outline"
                    size={18}
                    color={C.ink}
                  />

                  <Text style={s.viewCartText}>
                    Added to cart · View Cart
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={C.ink}
                  />
                </Pressable>
              )}
            </>
          )}

          {/* OUT OF STOCK */}
          {stock <= 0 && (
            <View style={s.outStockBox}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={C.danger}
              />

              <View style={{ flex: 1 }}>
                <Text style={s.outStockTitle}>
                  {t('outOfStock')}
                </Text>

                <Text style={s.outStockText}>
                  This product is currently unavailable.
                </Text>
              </View>
            </View>
          )}

          {/* DESCRIPTION */}
          <Card>
            <SectionTitle>
              {t('description')}
            </SectionTitle>

            <Text
              testID="product-description"
              style={s.desc}
            >
              {pDesc(product)}
            </Text>
          </Card>

          {/* PRODUCT INFORMATION */}
          <Card>
            <SectionTitle>
              Product Information
            </SectionTitle>

            {!!product.category && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>
                  Category
                </Text>

                <Text style={s.detailValue}>
                  {cat(product.category)}
                </Text>
              </View>
            )}

            {!!product.shop_name && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>
                  Seller
                </Text>

                <Text style={s.detailValue}>
                  {product.shop_name}
                </Text>
              </View>
            )}

            {!!product.weight_grams && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>
                  Weight
                </Text>

                <Text style={s.detailValue}>
                  {product.weight_grams} g
                </Text>
              </View>
            )}

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>
                Availability
              </Text>

              <Text style={s.detailValue}>
                {stock > 0
                  ? 'Available'
                  : 'Out of stock'}
              </Text>
            </View>

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>
                Returns
              </Text>

              <Text style={s.detailValue}>
                {product.is_returnable
                  ? 'Eligible'
                  : 'Not eligible'}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      {/* REVIEWS */}
      <Card>
        <View style={s.reviewHeader}>
          <SectionTitle>
            {t('reviews')}
          </SectionTitle>

          {reviewCount > 0 && (
            <View style={s.reviewSummary}>
              <Text style={s.reviewBig}>
                {rating.toFixed(1)}
              </Text>

              <Text style={s.reviewStars}>
                ★★★★★
              </Text>

              <Text style={s.reviewSmall}>
                {reviewCount} {t('reviews')}
              </Text>
            </View>
          )}
        </View>

        {reviews.length === 0 ? (
          <Text style={s.meta}>
            {t('noReviews')}
          </Text>
        ) : (
          reviews.map((r, index) => {
            const reviewRating =
              Math.max(
                0,
                Math.min(
                  5,
                  Number(
                    r.rating ?? 0
                  )
                )
              );

            return (
              <View
                key={
                  r.id ??
                  `review-${index}`
                }
                style={s.review}
              >
                <Text
                  style={s.metaStrong}
                >
                  {'★'.repeat(
                    reviewRating
                  )}{' '}
                  {r.customer_name ||
                    ''}
                </Text>

                {!!r.comment && (
                  <Text style={s.desc}>
                    {r.comment}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </Card>

      {/* RECENTLY VIEWED */}
      {recentlyViewed.length > 0 && (
        <View style={s.recommendSection}>
          <SectionTitle>
            Recently Viewed
          </SectionTitle>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              s.productRow
            }
          >
            {recentlyViewed.map(
              (p) => (
                <View
                  key={p.id}
                  style={s.recommendCard}
                >
                  <ProductCard
                    product={p}
                    width="100%"
                  />
                </View>
              )
            )}
          </ScrollView>
        </View>
      )}

      {/* SIMILAR PRODUCTS */}
      {similarProducts.length > 0 && (
        <View style={s.recommendSection}>
          <SectionTitle>
            Similar Products
          </SectionTitle>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              s.productRow
            }
          >
            {similarProducts.map(
              (p) => (
                <View
                  key={p.id}
                  style={s.recommendCard}
                >
                  <ProductCard
                    product={p}
                    width="100%"
                  />
                </View>
              )
            )}
          </ScrollView>
        </View>
      )}

      {/* POPULAR PRODUCTS */}
      {popularProducts.length > 0 && (
        <View style={s.recommendSection}>
          <SectionTitle>
            Popular Products
          </SectionTitle>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              s.productRow
            }
          >
            {popularProducts.map(
              (p) => (
                <View
                  key={p.id}
                  style={s.recommendCard}
                >
                  <ProductCard
                    product={p}
                    width="100%"
                  />
                </View>
              )
            )}
          </ScrollView>
        </View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 20,
  },

  gallery: {
    gap: 10,
  },

  mainImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor:
      C.primaryLight,
    maxWidth: 560,
  },

  mainImg: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    marginTop: 8,
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },

  heart: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor:
      'rgba(255,255,255,0.95)',
    borderRadius: 999,
    padding: 9,
  },

  popularBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor:
      C.saffronDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  popularText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '800',
  },

  thumbs: {
    flexDirection: 'row',
    gap: 8,
  },

  thumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor:
      'transparent',
  },

  thumbActive: {
    borderColor: C.primary,
  },

  thumbImage: {
    width: '100%',
    height: '100%',
  },

  info: {
    gap: 10,
  },

  cat: {
    fontSize: 12,
    fontWeight: '800',
    color: C.primaryDark,
    letterSpacing: 1,
    textTransform:
      'uppercase',
  },

  name: {
    fontSize: 26,
    fontWeight: '800',
    color: C.ink,
    lineHeight: 33,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  ratingBadge: {
    backgroundColor:
      C.success,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  ratingBadgeText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '800',
  },

  ratingCount: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '600',
  },

  price: {
    fontSize: 28,
    fontWeight: '800',
    color: C.ink,
  },

  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },

  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },

  badgeOk: {
    backgroundColor:
      C.successBg,
    color: C.success,
  },

  badgeBad: {
    backgroundColor:
      C.dangerBg,
    color: C.danger,
  },

  badgeNeutral: {
    backgroundColor: C.bg,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.line,
  },

  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  meta: {
    fontSize: 14,
    color: C.muted,
  },

  metaStrong: {
    color: C.ink,
    fontWeight: '700',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginVertical: 6,
  },

  viewCart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor:
      C.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D3ECFB',
  },

  viewCartText: {
    flex: 1,
    color: C.ink,
    fontSize: 13,
    fontWeight: '800',
  },

  outStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor:
      C.dangerBg,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  outStockTitle: {
    color: C.danger,
    fontWeight: '800',
    fontSize: 14,
  },

  outStockText: {
    marginTop: 2,
    color: C.muted,
    fontSize: 12,
  },

  desc: {
    fontSize: 15,
    color: C.ink,
    lineHeight: 23,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },

  detailLabel: {
    fontSize: 13,
    color: C.muted,
  },

  detailValue: {
    fontSize: 13,
    color: C.ink,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },

  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 15,
  },

  reviewSummary: {
    alignItems: 'flex-end',
  },

  reviewBig: {
    fontSize: 22,
    fontWeight: '800',
    color: C.ink,
  },

  reviewStars: {
    fontSize: 13,
    color: C.saffron,
    letterSpacing: 1,
  },

  reviewSmall: {
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },

  review: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    marginTop: 10,
    gap: 4,
  },

  recommendSection: {
    marginTop: 8,
  },

  productRow: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 8,
  },

  recommendCard: {
    width: 190,
  },

  errorActions: {
    marginTop: 15,
  },
});
