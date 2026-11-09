import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { Product, useStore } from '@/src/store/StoreContext';
import { Page, Loading } from '@/src/store/components/Page';
import { ProductCard } from '@/src/store/components/ProductCard';
import { Btn, Card, Notice } from '@/src/store/components/ui';
import { C, money, useLayout } from '@/src/store/theme';

export default function WishlistScreen() {
  const {
    t,
    wishlist,
    toggleWishlist,
    cart,
    setQty,
  } = useStore();

  const { cols } = useLayout();

  const [products, setProducts] =
    useState<Product[] | null>(null);

  const [search, setSearch] =
    useState('');

  useEffect(() => {
    apiClient
      .get('/store/favourites')
      .then((r) => setProducts(r || []))
      .catch(() => setProducts([]));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (products || [])
      .filter((p) => wishlist.includes(p.id))
      .filter((p) => {
        if (!q) return true;

        return (
          String(p.name || '')
            .toLowerCase()
            .includes(q) ||
          String(p.category || '')
            .toLowerCase()
            .includes(q)
        );
      });
  }, [products, wishlist, search]);

  const addToCart = (product: Product) => {
    const current = cart[product.id];

    setQty(
      product.id,
      Number(current?.quantity || 0) + 1
    );
  };

  const removeFromWishlist = async (
    product: Product
  ) => {
    toggleWishlist(product.id);

    try {
      await apiClient.delete(
        `/store/favourites/${product.id}`
      );
    } catch {
      // Keep existing wishlist behavior working.
    }
  };

  return (
    <Page
      testID="wishlist-page"
      title={t('wishlist')}
    >
      {products === null ? (
        <Loading text={t('loading')} />
      ) : visible.length === 0 ? (
        <Card style={s.emptyCard}>
          <Text
            testID="wishlist-empty-message"
            style={s.empty}
          >
            {search
              ? 'No wishlist products found'
              : t('emptyWishlist')}
          </Text>

          <Text style={s.emptySubtext}>
            {search
              ? 'Try another search.'
              : 'Save products here to find them quickly later.'}
          </Text>

          <Btn
            testID="wishlist-start-shopping-button"
            label={t('startShopping')}
            onPress={() =>
              router.replace('/store')
            }
          />
        </Card>
      ) : (
        <>
          <View style={s.toolbar}>
            <View style={s.countBox}>
              <Text style={s.count}>
                {visible.length}
              </Text>

              <Text style={s.countLabel}>
                {visible.length === 1
                  ? 'saved product'
                  : 'saved products'}
              </Text>
            </View>

            <Pressable
              testID="wishlist-continue-shopping"
              onPress={() =>
                router.push('/store')
              }
            >
              <Text style={s.shopLink}>
                Continue Shopping →
              </Text>
            </Pressable>
          </View>

          {visible.length > 0 && (
            <View style={s.infoRow}>
              <Text style={s.infoText}>
                ❤️ Your saved products
              </Text>

              <Text style={s.infoText}>
                {visible.filter(
                  (p) =>
                    Number(p.stock ?? 0) > 0
                ).length}{' '}
                available
              </Text>
            </View>
          )}

          <View style={s.grid}>
            {visible.map((p) => (
              <View
                key={p.id}
                style={{
                  width: `${100 / cols}%`,
                }}
              >
                <ProductCard
                  product={p}
                  width="100%"
                />

                <Card style={s.quickActions}>
                  <View style={s.quickTop}>
                    <View style={s.productMini}>
                      <Image
                        source={{
                          uri: p.image_url,
                        }}
                        style={s.miniImage}
                      />

                      <View
                        style={
                          s.miniInfo
                        }
                      >
                        <Text
                          style={
                            s.miniName
                          }
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>

                        <Text
                          style={
                            s.miniPrice
                          }
                        >
                          {money(
                            p.price
                          )}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      testID={`wishlist-remove-${p.id}`}
                      onPress={() =>
                        removeFromWishlist(
                          p
                        )
                      }
                    >
                      <Text
                        style={
                          s.remove
                        }
                      >
                        ♥
                      </Text>
                    </Pressable>
                  </View>

                  {Number(
                    p.stock ?? 0
                  ) <= 0 ? (
                    <View
                      style={
                        s.outOfStock
                      }
                    >
                      <Text
                        style={
                          s.outOfStockText
                        }
                      >
                        Out of stock
                      </Text>
                    </View>
                  ) : (
                    <Btn
                      testID={`wishlist-add-cart-${p.id}`}
                      label={
                        cart[p.id]
                          ? `Add More · ${cart[p.id].quantity}`
                          : 'Add to Cart'
                      }
                      onPress={() =>
                        addToCart(
                          p
                        )
                      }
                    />
                  )}
                </Card>
              </View>
            ))}
          </View>

          <Card style={s.bottomCard}>
            <Text style={s.bottomTitle}>
              Keep shopping
            </Text>

            <Text style={s.bottomText}>
              Discover more products and save
              your favourites for later.
            </Text>

            <Pressable
              onPress={() =>
                router.push('/store')
              }
            >
              <Text
                style={
                  s.shopLink
                }
              >
                Explore Store →
              </Text>
            </Pressable>
          </Card>
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },

  empty: {
    fontSize: 17,
    color: C.muted,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },

  emptySubtext: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 18,
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },

  countBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },

  count: {
    fontSize: 18,
    fontWeight: '900',
    color: C.ink,
  },

  countLabel: {
    fontSize: 13,
    color: C.muted,
  },

  shopLink: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },

  infoText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -7,
  },

  quickActions: {
    marginTop: -4,
    gap: 9,
  },

  quickTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  productMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  miniImage: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: C.primaryLight,
  },

  miniInfo: {
    flex: 1,
  },

  miniName: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },

  miniPrice: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },

  remove: {
    color: C.danger,
    fontSize: 20,
    fontWeight: '800',
  },

  outOfStock: {
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
  },

  outOfStockText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '800',
  },

  bottomCard: {
    marginTop: 14,
    paddingVertical: 16,
  },

  bottomTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },

  bottomText: {
    fontSize: 13,
    color: C.muted,
    marginTop: 4,
    marginBottom: 8,
  },
});
