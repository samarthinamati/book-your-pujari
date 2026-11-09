import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/src/store/StoreContext';
import { Page, SectionTitle } from '@/src/store/components/Page';
import { Btn, Card, Notice, QtyStepper, Row } from '@/src/store/components/ui';
import { C, money, useLayout } from '@/src/store/theme';

export default function CartScreen() {
  const {
    t,
    pName,
    cart,
    setQty,
    cartCount,
    plural,
  } = useStore();

  const { isWide } = useLayout();

  const lines = Object.values(cart);

  const subtotal = lines.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0
  );

  const sellers = new Set(
    lines.map((l) => l.product.seller_id || '')
  );

  const totalItems = lines.reduce(
    (sum, l) => sum + l.quantity,
    0
  );

  const hasStockIssue = lines.some((line) => {
    const stock = Number(line.product.stock ?? 0);
    return stock <= 0 || line.quantity > stock;
  });

  const clearCart = () => {
    lines.forEach(({ product }) => {
      setQty(product.id, 0);
    });
  };

  if (lines.length === 0) {
    return (
      <Page testID="cart-page" title={t('cart')}>
        <Card style={s.emptyCard}>
          <Text testID="cart-empty-message" style={s.empty}>
            {t('emptyCart')}
          </Text>

          <Text style={s.emptySubtext}>
            Add products from the store and they will appear here.
          </Text>

          <Btn
            testID="cart-start-shopping-button"
            label={t('startShopping')}
            onPress={() => router.replace('/store')}
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page testID="cart-page" title={t('cart')}>
      <View style={s.pageActions}>
        <Pressable
          testID="cart-continue-shopping"
          onPress={() => router.push('/store')}
        >
          <Text style={s.continueShopping}>
            ← Continue Shopping
          </Text>
        </Pressable>

        <Pressable
          testID="cart-clear-button"
          onPress={clearCart}
        >
          <Text style={s.clearCart}>
            Clear Cart
          </Text>
        </Pressable>
      </View>

      {hasStockIssue && (
        <Notice
          tone="info"
          text="Some items in your cart have limited or unavailable stock. Please update the quantity before checkout."
          testID="cart-stock-warning"
        />
      )}

      <View
        style={[
          s.layout,
          isWide && {
            flexDirection: 'row',
            alignItems: 'flex-start',
          },
        ]}
      >
        <View
          style={[
            s.itemsColumn,
            isWide && { flex: 2 },
          ]}
        >
          <Card style={s.cartHeader}>
            <View>
              <Text style={s.cartHeaderTitle}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </Text>
              <Text style={s.cartHeaderSubtext}>
                Review your items before checkout
              </Text>
            </View>
          </Card>

          {lines.map(({ product, quantity }) => {
            const stock = Number(product.stock ?? 0);
            const stockLimited =
              stock > 0 && stock <= 5;

            const outOfStock = stock <= 0;

            const quantityExceedsStock =
              stock > 0 && quantity > stock;

            return (
              <Card key={product.id} style={s.line}>
                <Pressable
                  testID={`cart-product-${product.id}`}
                  onPress={() =>
                    router.push({
                      pathname: '/store/product',
                      params: { id: product.id },
                    })
                  }
                  style={s.imageWrap}
                >
                  <Image
                    source={{ uri: product.image_url }}
                    style={s.img}
                  />

                  {outOfStock && (
                    <View style={s.imageBadge}>
                      <Text style={s.imageBadgeText}>
                        Out of stock
                      </Text>
                    </View>
                  )}
                </Pressable>

                <View style={s.productInfo}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/store/product',
                        params: { id: product.id },
                      })
                    }
                  >
                    <Text
                      style={s.name}
                      numberOfLines={2}
                    >
                      {pName(product)}
                    </Text>
                  </Pressable>

                  <Text style={s.price}>
                    {money(product.price)}
                  </Text>

                  {product.seller_id && (
                    <Text style={s.seller}>
                      Sold by: {product.seller_id}
                    </Text>
                  )}

                  {stockLimited && !outOfStock && (
                    <Text style={s.lowStock}>
                      Only {stock} left
                    </Text>
                  )}

                  {quantityExceedsStock && (
                    <Text style={s.stockError}>
                      Only {stock} available
                    </Text>
                  )}

                  <View style={s.lineActions}>
                    <QtyStepper
                      testID={`cart-qty-${product.id}`}
                      value={quantity}
                      max={Math.min(
                        Math.max(stock, 1),
                        50
                      )}
                      onChange={(n) =>
                        setQty(product.id, n)
                      }
                    />

                    <Pressable
                      testID={`cart-remove-${product.id}`}
                      onPress={() =>
                        setQty(product.id, 0)
                      }
                    >
                      <Text style={s.remove}>
                        {t('remove')}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={s.totalWrap}>
                  <Text
                    testID={`cart-line-total-${product.id}`}
                    style={s.lineTotal}
                  >
                    {money(product.price * quantity)}
                  </Text>

                  {quantity > 1 && (
                    <Text style={s.unitPrice}>
                      {money(product.price)} each
                    </Text>
                  )}
                </View>
              </Card>
            );
          })}

          {sellers.size > 1 && (
            <Notice
              tone="info"
              text={t('multiSellerNote', {
                n: sellers.size,
              })}
              testID="cart-multi-seller-note"
            />
          )}

          <Card style={s.shoppingTip}>
            <Text style={s.tipTitle}>
              🛍️ Shopping Tip
            </Text>

            <Text style={s.tipText}>
              You can continue shopping and add more products
              before proceeding to checkout.
            </Text>

            <Pressable
              onPress={() => router.push('/store')}
            >
              <Text style={s.shopMore}>
                Shop More Products →
              </Text>
            </Pressable>
          </Card>
        </View>

        <Card
          style={[
            s.summaryCard,
            isWide && { flex: 1 },
          ]}
        >
          <SectionTitle>
            {t('orderSummary')}
          </SectionTitle>

          <Row
            label={`${t('subtotal')} (${plural(cartCount)})`}
            value={money(subtotal)}
            testID="cart-subtotal"
          />

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.grandTotalLabel}>
              Total
            </Text>

            <Text
              testID="cart-grand-total"
              style={s.grandTotal}
            >
              {money(subtotal)}
            </Text>
          </View>

          {hasStockIssue && (
            <Text style={s.checkoutWarning}>
              Please fix stock quantities before checkout.
            </Text>
          )}

          <Btn
            testID="cart-checkout-button"
            label={t('proceedCheckout')}
            onPress={() =>
              router.push('/store/checkout')
            }
          />

          <Pressable
            style={s.secureNote}
            onPress={() => router.push('/store')}
          >
            <Text style={s.secureNoteText}>
              🔒 Secure checkout • Continue shopping anytime
            </Text>
          </Pressable>
        </Card>
      </View>
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

  pageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },

  continueShopping: {
    color: C.primary,
    fontWeight: '800',
    fontSize: 14,
  },

  clearCart: {
    color: C.danger,
    fontWeight: '800',
    fontSize: 14,
  },

  layout: {
    gap: 16,
  },

  itemsColumn: {
    gap: 10,
  },

  cartHeader: {
    paddingVertical: 14,
  },

  cartHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
  },

  cartHeaderSubtext: {
    fontSize: 13,
    color: C.muted,
    marginTop: 3,
  },

  line: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },

  imageWrap: {
    position: 'relative',
  },

  img: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
  },

  imageBadge: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },

  imageBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },

  productInfo: {
    flex: 1,
    gap: 5,
  },

  name: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },

  price: {
    fontSize: 14,
    color: C.muted,
    fontWeight: '600',
  },

  seller: {
    fontSize: 12,
    color: C.muted,
  },

  lowStock: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '800',
  },

  stockError: {
    fontSize: 12,
    color: C.danger,
    fontWeight: '800',
  },

  lineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    marginTop: 3,
  },

  remove: {
    color: C.danger,
    fontWeight: '800',
    fontSize: 14,
  },

  totalWrap: {
    alignItems: 'flex-end',
    minWidth: 75,
  },

  lineTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: C.ink,
  },

  unitPrice: {
    fontSize: 11,
    color: C.muted,
    marginTop: 3,
  },

  summaryCard: {
    gap: 8,
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 8,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },

  grandTotal: {
    fontSize: 20,
    fontWeight: '900',
    color: C.ink,
  },

  checkoutWarning: {
    fontSize: 12,
    color: C.danger,
    fontWeight: '700',
    marginBottom: 8,
  },

  secureNote: {
    marginTop: 8,
    alignItems: 'center',
  },

  secureNoteText: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
  },

  shoppingTip: {
    paddingVertical: 14,
  },

  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 4,
  },

  tipText: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
    marginBottom: 8,
  },

  shopMore: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
