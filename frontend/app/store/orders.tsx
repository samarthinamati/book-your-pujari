import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { useStore } from '@/src/store/StoreContext';
import { statusKey } from '@/src/store/i18n';
import { Page, Loading } from '@/src/store/components/Page';
import { Btn, Card, Notice, StatusChip } from '@/src/store/components/ui';
import { C, formatDate, money, shortId } from '@/src/store/theme';

export default function OrdersScreen() {
  const {
    t,
    plural,
    setQty,
    cart,
  } = useStore();

  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = async () => {
    try {
      setError('');
      setRefreshing(true);

      const response = await apiClient.get('/store/orders/my-orders');
      setOrders(response || []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load orders');
      setOrders([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    const q = search.trim().toLowerCase();

    if (!q) return orders;

    return orders.filter((o) => {
      const orderId = String(o.id || '').toLowerCase();

      const status = String(
        o.order_status || ''
      ).toLowerCase();

      const payment = String(
        o.payment_status || ''
      ).toLowerCase();

      const items = (o.items || [])
        .map((it: any) =>
          String(
            it.product_name ||
              it.name ||
              it.product?.name ||
              ''
          ).toLowerCase()
        )
        .join(' ');

      return (
        orderId.includes(q) ||
        status.includes(q) ||
        payment.includes(q) ||
        items.includes(q)
      );
    });
  }, [orders, search]);

  const buyAgain = async (order: any) => {
    try {
      for (const item of order.items || []) {
        const productId =
          item.product_id ||
          item.product?.id;

        if (!productId) continue;

        const existing = cart[productId];

        const quantity = Number(
          item.quantity || 1
        );

        setQty(
          productId,
          Number(existing?.quantity || 0) +
            quantity
        );
      }

      router.push('/store/cart');
    } catch (e) {
      setError('Unable to add products to cart.');
    }
  };

  return (
    <Page testID="orders-page" title={t('myOrders')}>
      {!!error && (
        <Notice
          tone="error"
          text={error}
          testID="orders-error"
        />
      )}

      {orders === null ? (
        <Loading text={t('loading')} />
      ) : orders.length === 0 ? (
        <Card style={s.emptyCard}>
          <Text
            testID="orders-empty-message"
            style={s.empty}
          >
            {t('noOrders')}
          </Text>

          <Text style={s.emptySubtext}>
            Your placed orders will appear here.
          </Text>

          <Btn
            testID="orders-start-shopping-button"
            label={t('startShopping')}
            onPress={() =>
              router.replace('/store')
            }
          />
        </Card>
      ) : (
        <>
          <View style={s.toolbar}>
            <View style={s.searchBox}>
              <Text style={s.searchIcon}>
                🔎
              </Text>

              <TextInput
                testID="orders-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search orders or products"
                placeholderTextColor={C.muted}
                style={s.searchInput}
              />

              {!!search && (
                <Pressable
                  onPress={() => setSearch('')}
                >
                  <Text style={s.clearSearch}>
                    ×
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              testID="orders-refresh-button"
              onPress={loadOrders}
              disabled={refreshing}
            >
              <Text style={s.refresh}>
                {refreshing ? 'Refreshing...' : '↻ Refresh'}
              </Text>
            </Pressable>
          </View>

          {search.trim() !== '' && (
            <Text style={s.resultText}>
              {filteredOrders.length}{' '}
              {filteredOrders.length === 1
                ? 'order'
                : 'orders'}{' '}
              found
            </Text>
          )}

          {filteredOrders.length === 0 ? (
            <Card style={s.noResults}>
              <Text style={s.noResultsTitle}>
                No orders found
              </Text>

              <Text style={s.noResultsText}>
                Try searching with another order ID,
                product name, or status.
              </Text>

              <Pressable
                onPress={() => setSearch('')}
              >
                <Text style={s.clearFilter}>
                  Clear Search
                </Text>
              </Pressable>
            </Card>
          ) : (
            <View style={s.list}>
              {filteredOrders.map((o) => {
                const items = o.items || [];

                const itemCount = items.reduce(
                  (n: number, it: any) =>
                    n +
                    Number(
                      it.quantity || 0
                    ),
                  0
                );

                const firstItem = items[0];

                const productNames = items
                  .slice(0, 2)
                  .map(
                    (it: any) =>
                      it.product_name ||
                      it.name ||
                      it.product?.name ||
                      'Product'
                  );

                const moreItems =
                  items.length > 2
                    ? items.length - 2
                    : 0;

                return (
                  <Card
                    key={o.id}
                    style={s.orderCard}
                  >
                    <Pressable
                      testID={`order-card-${o.id}`}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/store/order',
                          params: {
                            id: o.id,
                          },
                        })
                      }
                    >
                      <View style={s.top}>
                        <View style={s.orderInfo}>
                          <Text style={s.id}>
                            Order #{shortId(o.id)}
                          </Text>

                          <Text style={s.meta}>
                            {t('orderedOn')}{' '}
                            {formatDate(
                              o.created_at
                            )}
                          </Text>
                        </View>

                        <StatusChip
                          status={
                            o.order_status
                          }
                          label={t(
                            statusKey(
                              o.order_status
                            )
                          )}
                          testID={`order-status-${o.id}`}
                        />
                      </View>

                      <View style={s.productPreview}>
                        <View style={s.thumbs}>
                          {items
                            .slice(0, 4)
                            .map(
                              (
                                it: any,
                                index: number
                              ) => (
                                <Image
                                  key={`${it.product_id || index}-${index}`}
                                  source={{
                                    uri:
                                      it.image_url,
                                  }}
                                  style={
                                    s.thumb
                                  }
                                />
                              )
                            )}

                          {items.length > 4 && (
                            <View
                              style={
                                s.moreThumb
                              }
                            >
                              <Text
                                style={
                                  s.moreThumbText
                                }
                              >
                                +{items.length - 4}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View
                          style={
                            s.productNames
                          }
                        >
                          {productNames.map(
                            (
                              name: string,
                              index: number
                            ) => (
                              <Text
                                key={index}
                                style={
                                  s.productName
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {name}
                              </Text>
                            )
                          )}

                          {moreItems > 0 && (
                            <Text
                              style={
                                s.moreProducts
                              }
                            >
                              +{moreItems} more
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={s.divider} />

                      <View style={s.bottomRow}>
                        <View>
                          <Text style={s.itemCount}>
                            {itemCount}{' '}
                            {itemCount === 1
                              ? 'item'
                              : 'items'}
                          </Text>

                          <Text style={s.payment}>
                            {t('payment')}:{' '}
                            {o.payment_status ===
                            'paid'
                              ? t('paid')
                              : o.payment_method ===
                                'cod'
                              ? t(
                                  'codPending'
                                )
                              : t(
                                  'pending'
                                )}
                          </Text>
                        </View>

                        <Text
                          testID={`order-total-${o.id}`}
                          style={s.total}
                        >
                          {money(
                            o.total_amount
                          )}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={s.actions}>
                      <Pressable
                        testID={`order-buy-again-${o.id}`}
                        onPress={() =>
                          buyAgain(o)
                        }
                        style={s.actionButton}
                      >
                        <Text
                          style={
                            s.actionText
                          }
                        >
                          🔁 Buy Again
                        </Text>
                      </Pressable>

                      <Pressable
                        testID={`order-view-${o.id}`}
                        onPress={() =>
                          router.push({
                            pathname:
                              '/store/order',
                            params: {
                              id: o.id,
                            },
                          })
                        }
                        style={
                          s.actionButton
                        }
                      >
                        <Text
                          style={
                            s.actionText
                          }
                        >
                          View Order →
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          <Card style={s.shopMoreCard}>
            <Text style={s.shopMoreTitle}>
              Looking for something else?
            </Text>

            <Text style={s.shopMoreText}>
              Explore more products from the
              PujariGo store.
            </Text>

            <Pressable
              onPress={() =>
                router.push('/store')
              }
            >
              <Text style={s.shopMoreLink}>
                Continue Shopping →
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
    gap: 10,
    marginBottom: 10,
  },

  searchBox: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    minHeight: 42,
    color: C.ink,
    fontSize: 14,
  },

  clearSearch: {
    fontSize: 24,
    color: C.muted,
    fontWeight: '400',
    paddingHorizontal: 4,
  },

  refresh: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  resultText: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 10,
  },

  list: {
    gap: 10,
  },

  orderCard: {
    gap: 12,
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },

  orderInfo: {
    flex: 1,
    minWidth: 150,
  },

  id: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },

  meta: {
    fontSize: 13,
    color: C.muted,
  },

  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },

  thumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  thumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
  },

  moreThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreThumbText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.primary,
  },

  productNames: {
    flex: 1,
    gap: 3,
  },

  productName: {
    fontSize: 13,
    color: C.ink,
    fontWeight: '600',
  },

  moreProducts: {
    fontSize: 12,
    color: C.muted,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  itemCount: {
    fontSize: 13,
    color: C.ink,
    fontWeight: '700',
  },

  payment: {
    fontSize: 12,
    color: C.muted,
    marginTop: 3,
  },

  total: {
    fontSize: 17,
    fontWeight: '900',
    color: C.ink,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },

  actionButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  actionText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  noResults: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },

  noResultsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 5,
  },

  noResultsText: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 10,
  },

  clearFilter: {
    color: C.primary,
    fontWeight: '800',
    fontSize: 13,
  },

  shopMoreCard: {
    marginTop: 14,
    paddingVertical: 16,
  },

  shopMoreTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },

  shopMoreText: {
    fontSize: 13,
    color: C.muted,
    marginTop: 4,
    marginBottom: 8,
  },

  shopMoreLink: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
