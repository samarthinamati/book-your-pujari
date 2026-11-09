import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { storage } from '@/src/utils/storage';
import { openRazorpayCheckout } from '@/src/utils/razorpay';
import { CartLine, useStore } from '@/src/store/StoreContext';
import { Page, Loading, SectionTitle } from '@/src/store/components/Page';
import { Btn, Card, Field, Notice, Row } from '@/src/store/components/ui';
import { C, money, useLayout } from '@/src/store/theme';

type Address = {
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
};

export default function CheckoutScreen() {
  const { buyNow, qty } =
    useLocalSearchParams<{ buyNow?: string; qty?: string }>();

  const {
    t,
    pName,
    cart,
    clearCart,
    config,
    ready,
  } = useStore();

  const { user } = useAuth();
  const { isWide } = useLayout();

  const [lines, setLines] =
    useState<CartLine[] | null>(null);

  const [addr, setAddr] = useState<Address>({
    name: user?.name || '',
    phone: user?.phone || '',
    address: '',
    city: '',
    pincode: '',
  });

  const [payMethod, setPayMethod] =
    useState<'online' | 'cod'>('online');

  const [shipping, setShipping] = useState<{
    fee: number;
    isDemo: boolean;
  } | null>(null);

  const [shipError, setShipError] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{
    code: string;
    discount: number;
  } | null>(null);

  const [couponError, setCouponError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingOrder, setPendingOrder] =
    useState<any>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (buyNow) {
      apiClient
        .get(`/store/products/${buyNow}`)
        .then((p) => {
          setLines([
            {
              product: p,
              quantity: Math.max(
                1,
                Math.min(
                  Number(qty || 1),
                  Number(p.stock || 1)
                )
              ),
            },
          ]);
        })
        .catch((e) => {
          setError(e.message);
          setLines([]);
        });
    } else if (ready) {
      setLines(Object.values(cart));
    }
  }, [buyNow, ready]);

  useEffect(() => {
    if (user) {
      setAddr((a) => ({
        ...a,
        name: a.name || user.name || '',
        phone: a.phone || user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    storage.getItem('store_address', '').then((raw) => {
      if (typeof raw === 'string' && raw) {
        try {
          setAddr((a) => ({
            ...a,
            ...JSON.parse(raw),
          }));
        } catch {
          // Ignore invalid saved address.
        }
      }
    });
  }, []);

  const items = useMemo(
    () =>
      (lines || []).map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
      })),
    [lines]
  );

  const pinValid = /^\d{6}$/.test(addr.pincode);

  useEffect(() => {
    setShipping(null);
    setShipError('');

    if (!pinValid || items.length === 0) return;

    apiClient
      .post('/store/shipping/estimate', {
        items,
        delivery_pincode: addr.pincode,
        payment_method: payMethod,
      })
      .then((r) =>
        setShipping({
          fee: Number(r.shipping_fee || 0),
          isDemo: !!r.is_demo,
        })
      )
      .catch((e) => setShipError(e.message));
  }, [addr.pincode, items, payMethod]);

  const subtotal = (lines || []).reduce(
    (s, l) =>
      s + l.product.price * l.quantity,
    0
  );

  const discount = coupon
    ? Math.min(coupon.discount, subtotal)
    : 0;

  const discounted = Math.max(
    0,
    subtotal - discount
  );

  const platformFee =
    Math.round(
      discounted *
        (config?.platform_fee_percent ?? 2)
    ) / 100;

  const codFee =
    payMethod === 'cod' ? 10 : 0;

  const total = Math.round(
    (
      discounted +
      platformFee +
      (shipping?.fee || 0) +
      codFee
    ) * 100
  ) / 100;

  const itemCount = (lines || []).reduce(
    (sum, l) => sum + l.quantity,
    0
  );

  const sellerCount = new Set(
    (lines || []).map(
      (l) => l.product.seller_id || ''
    )
  ).size;

  const valid =
    addr.name.trim().length >= 2 &&
    /^\d{10}$/.test(addr.phone) &&
    addr.address.trim().length >= 5 &&
    addr.city.trim().length >= 2 &&
    pinValid;

  const applyCoupon = async () => {
    setCouponError('');

    try {
      const r = await apiClient.post(
        '/store/coupons/validate',
        {
          code: couponInput
            .trim()
            .toUpperCase(),
          subtotal,
        }
      );

      setCoupon({
        code:
          r.coupon?.code ||
          couponInput.trim().toUpperCase(),
        discount: Number(
          r.discount_amount || 0
        ),
      });
    } catch (e: any) {
      setCoupon(null);
      setCouponError(e.message);
    }
  };

  const payOnline = async (order: any) => {
    const pay = await apiClient.post(
      '/store/payment/create-order',
      {
        store_order_id: order.id,
      }
    );

    let rz;

    try {
      rz = await openRazorpayCheckout({
        key: pay.key_id,
        amount: String(pay.amount),
        currency: pay.currency || 'INR',
        name: 'PujariGo Samagri',
        description: `Order ${String(order.id)
          .slice(-6)
          .toUpperCase()}`,
        order_id: pay.razorpay_order_id,
        prefill: {
          name: addr.name,
          contact: `+91${addr.phone}`,
        },
        theme: {
          color: C.primary,
        },
      });
    } catch {
      setPendingOrder(order);
      setError(t('paymentCancelled'));
      return false;
    }

    await apiClient.post(
      '/store/payment/verify',
      {
        store_order_id: order.id,
        razorpay_order_id:
          rz.razorpay_order_id,
        razorpay_payment_id:
          rz.razorpay_payment_id,
        razorpay_signature:
          rz.razorpay_signature,
      }
    );

    return true;
  };

  const finish = (orderId: string) => {
    if (!buyNow) clearCart();

    router.replace({
      pathname: '/store/order',
      params: {
        id: orderId,
        placed: '1',
      },
    });
  };

  const placeOrder = async () => {
    setError('');

    if (!valid) {
      setShowErrors(true);
      setError(t('fixErrors'));
      return;
    }

    if (
      payMethod === 'online' &&
      config &&
      !config.online_payments_enabled
    ) {
      setError(t('paymentsUnavailable'));
      return;
    }

    setBusy(true);

    try {
      await storage.setItem(
        'store_address',
        JSON.stringify(addr)
      );

      let order = pendingOrder;

      if (!order) {
        order = await apiClient.post(
          '/store/orders',
          {
            items,
            customer_name: addr.name.trim(),
            customer_phone: addr.phone,
            delivery_address:
              addr.address.trim(),
            city: addr.city.trim(),
            pincode: addr.pincode,
            payment_method: payMethod,
            coupon_code:
              coupon?.code || null,
          }
        );
      }

      if (order.payment_method === 'cod') {
        return finish(order.id);
      }

      if (await payOnline(order)) {
        finish(order.id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (lines === null) {
    return (
      <Page
        testID="checkout-page"
        title={t('checkout')}
      >
        <Loading text={t('loading')} />
      </Page>
    );
  }

  if (lines.length === 0) {
    return (
      <Page
        testID="checkout-page"
        title={t('checkout')}
      >
        {!!error && (
          <Notice
            tone="error"
            text={error}
          />
        )}

        <Notice
          text={t('emptyCart')}
          testID="checkout-empty"
        />

        <Btn
          testID="checkout-start-shopping"
          label={t('startShopping')}
          onPress={() =>
            router.replace('/store')
          }
        />
      </Page>
    );
  }

  const set =
    (k: keyof Address) =>
    (v: string) =>
      setAddr((a) => ({
        ...a,
        [k]:
          k === 'phone' ||
          k === 'pincode'
            ? v.replace(/\D/g, '')
            : v,
      }));

  const locked = !!pendingOrder;

  return (
    <Page
      testID="checkout-page"
      title={t('checkout')}
    >
      <View
        style={[
          s.page,
          isWide && s.pageWide,
        ]}
      >
        <View
          style={[
            s.leftColumn,
            isWide && s.leftWide,
          ]}
        >
          {/* Checkout progress */}
          <Card>
            <View style={s.progress}>
              <ProgressStep
                number="1"
                label="Delivery"
                active
              />
              <View style={s.progressLine} />
              <ProgressStep
                number="2"
                label="Payment"
                active
              />
              <View style={s.progressLine} />
              <ProgressStep
                number="3"
                label="Confirmation"
              />
            </View>
          </Card>

          {/* Delivery address */}
          <Card>
            <SectionTitle>
              {t('deliveryAddress')}
            </SectionTitle>

            <Text style={s.sectionHint}>
              Your order will be delivered to
              this address.
            </Text>

            <View style={s.fields}>
              <Field
                testID="checkout-name-input"
                label={t('fullName')}
                value={addr.name}
                onChangeText={set('name')}
                editable={!locked}
                error={
                  showErrors &&
                  addr.name.trim()
                    .length < 2
                }
              />

              <Field
                testID="checkout-phone-input"
                label={t('phone')}
                value={addr.phone}
                onChangeText={set('phone')}
                maxLength={10}
                keyboardType="phone-pad"
                editable={!locked}
                error={
                  showErrors &&
                  !/^\d{10}$/.test(
                    addr.phone
                  )
                }
              />
            </View>

            <Field
              testID="checkout-address-input"
              label={t('address')}
              value={addr.address}
              onChangeText={set('address')}
              multiline
              editable={!locked}
              error={
                showErrors &&
                addr.address.trim()
                  .length < 5
              }
              style={{
                minHeight: 70,
              }}
            />

            <View style={s.fields}>
              <Field
                testID="checkout-city-input"
                label={t('city')}
                value={addr.city}
                onChangeText={set('city')}
                editable={!locked}
                error={
                  showErrors &&
                  addr.city.trim()
                    .length < 2
                }
              />

              <Field
                testID="checkout-pincode-input"
                label={t('pincode')}
                value={addr.pincode}
                onChangeText={set('pincode')}
                maxLength={6}
                keyboardType="number-pad"
                editable={!locked}
                error={
                  showErrors &&
                  !pinValid
                }
              />
            </View>

            {addr.pincode.length > 0 &&
              !pinValid && (
                <Text style={s.validationText}>
                  Enter a valid 6-digit
                  pincode.
                </Text>
              )}

            <Text style={s.savedText}>
              ✓ Address is saved for your
              next checkout.
            </Text>
          </Card>

          {/* Shipping */}
          <Card>
            <SectionTitle>
              {t('shippingEstimate')}
            </SectionTitle>

            {!pinValid ? (
              <View style={s.shippingWaiting}>
                <Ionicons
                  name="location-outline"
                  size={22}
                  color={C.primary}
                />

                <Text style={s.muted}>
                  {t('enterPin')}
                </Text>
              </View>
            ) : shipError ? (
              <Notice
                tone="error"
                text={shipError}
                testID="checkout-shipping-error"
              />
            ) : !shipping ? (
              <View style={s.shippingWaiting}>
                <Ionicons
                  name="calculator-outline"
                  size={22}
                  color={C.primary}
                />

                <Text style={s.muted}>
                  {t('loading')}
                </Text>
              </View>
            ) : (
              <View style={s.shippingBox}>
                <View style={s.shippingIcon}>
                  <Ionicons
                    name="cube-outline"
                    size={24}
                    color={C.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.shippingTitle}>
                    Delivery available
                  </Text>

                  <Text style={s.muted}>
                    Estimated shipping charge
                  </Text>
                </View>

                <Text style={s.shippingPrice}>
                  {money(shipping.fee)}
                </Text>
              </View>
            )}

            {shipping?.isDemo && (
              <Notice
                tone="demo"
                text={t('demoShippingNote')}
                testID="checkout-demo-shipping-note"
              />
            )}
          </Card>

          {/* Payment */}
          <Card>
            <SectionTitle>
              {t('paymentMethod')}
            </SectionTitle>

            <PayOption
              testID="checkout-pay-online"
              active={
                payMethod === 'online'
              }
              disabled={locked}
              title={t('payOnline')}
              note={t('payOnlineNote')}
              onPress={() =>
                setPayMethod('online')
              }
            />

            <View style={{ height: 10 }} />

            <PayOption
              testID="checkout-pay-cod"
              active={payMethod === 'cod'}
              title={t('cod')}
              note={`+ ${money(10)}`}
              onPress={() => {
                setPendingOrder(null);
                setError('');
                setPayMethod('cod');
              }}
            />

            {payMethod === 'online' && (
              <View style={s.secureBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={C.success}
                />

                <Text style={s.secureText}>
                  Secure payment powered by
                  Razorpay.
                </Text>
              </View>
            )}

            {payMethod === 'cod' && (
              <View style={s.codBox}>
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={C.primary}
                />

                <Text style={s.codText}>
                  Cash on Delivery includes
                  an additional ₹10 COD fee.
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Order summary */}
        <Card
          style={[
            s.summary,
            isWide && s.summaryWide,
          ]}
        >
          <View style={s.summaryHeader}>
            <View>
              <SectionTitle>
                {t('orderSummary')}
              </SectionTitle>

              <Text style={s.summaryMeta}>
                {itemCount}{' '}
                {itemCount === 1
                  ? 'item'
                  : 'items'}
                {sellerCount > 1
                  ? ` · ${sellerCount} sellers`
                  : ''}
              </Text>
            </View>

            {!buyNow && (
              <Pressable
                testID="checkout-edit-cart"
                onPress={() =>
                  router.push('/store/cart')
                }
              >
                <Text style={s.editCart}>
                  Edit cart
                </Text>
              </Pressable>
            )}
          </View>

          {/* Products */}
          <View style={s.products}>
            {lines.map((l) => {
              const stock = Number(
                l.product.stock ?? 0
              );

              return (
                <View
                  key={l.product.id}
                  style={s.item}
                >
                  <Image
                    source={{
                      uri:
                        l.product.image_url,
                    }}
                    style={s.thumb}
                  />

                  <View
                    style={s.itemMiddle}
                  >
                    <Text
                      style={s.itemName}
                      numberOfLines={2}
                    >
                      {pName(
                        l.product
                      )}
                    </Text>

                    <Text
                      style={s.quantity}
                    >
                      Qty: {l.quantity}
                    </Text>

                    {stock > 0 &&
                      stock <= 5 && (
                        <Text
                          style={
                            s.lowStock
                          }
                        >
                          Only {stock}{' '}
                          left
                        </Text>
                      )}
                  </View>

                  <Text
                    style={
                      s.itemPrice
                    }
                  >
                    {money(
                      l.product.price *
                        l.quantity
                    )}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Coupon */}
          <View style={s.couponSection}>
            <Text style={s.couponTitle}>
              Have a coupon?
            </Text>

            <View
              style={s.couponRow}
            >
              <View
                style={{ flex: 1 }}
              >
                <Field
                  testID="checkout-coupon-input"
                  label={t('coupon')}
                  value={
                    couponInput
                  }
                  onChangeText={
                    setCouponInput
                  }
                  autoCapitalize="characters"
                  editable={!locked}
                />
              </View>

              <Pressable
                testID="checkout-apply-coupon"
                disabled={
                  !couponInput.trim() ||
                  locked
                }
                onPress={
                  applyCoupon
                }
                style={[
                  s.applyBtn,
                  (!couponInput.trim() ||
                    locked) &&
                    s.applyDisabled,
                ]}
              >
                <Text
                  style={
                    s.applyText
                  }
                >
                  {t('apply')}
                </Text>
              </Pressable>
            </View>

            {!!couponError && (
              <Text
                style={s.err}
              >
                {couponError}
              </Text>
            )}

            {!!coupon && (
              <View
                style={
                  s.couponSuccess
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={17}
                  color={C.success}
                />

                <Text
                  testID="checkout-coupon-applied"
                  style={s.ok}
                >
                  {t(
                    'couponApplied'
                  )}
                  : {coupon.code}
                </Text>
              </View>
            )}
          </View>

          {/* Price breakdown */}
          <View style={s.priceSection}>
            <Row
              label={t('subtotal')}
              value={money(subtotal)}
              testID="checkout-subtotal"
            />

            {discount > 0 && (
              <Row
                label={t('discount')}
                value={`− ${money(
                  discount
                )}`}
                testID="checkout-discount"
              />
            )}

            <Row
              label={t('platformFee')}
              value={money(
                platformFee
              )}
              testID="checkout-platform-fee"
            />

            <Row
              label={t('shipping')}
              value={
                shipping
                  ? money(
                      shipping.fee
                    )
                  : '—'
              }
              tag={
                shipping?.isDemo
                  ? 'DEMO'
                  : undefined
              }
            />

            {codFee > 0 && (
              <Row
                label={t('codFee')}
                value={money(
                  codFee
                )}
              />
            )}

            <View
              style={
                s.divider
              }
            />

            <Row
              bold
              label={t('total')}
              value={money(
                pendingOrder
                  ? pendingOrder.total_amount
                  : total
              )}
              testID="checkout-total"
            />

            <Text
              style={s.small}
            >
              {t(
                'serverTotalNote'
              )}
            </Text>
          </View>

          {!!error && (
            <Notice
              tone="error"
              text={error}
              testID="checkout-error"
            />
          )}

          {/* Final action */}
          <Btn
            testID="checkout-place-order-button"
            variant="saffron"
            icon={
              payMethod === 'online'
                ? 'lock-closed-outline'
                : 'checkmark-circle-outline'
            }
            loading={busy}
            disabled={
              valid &&
              !shipping &&
              !pendingOrder
            }
            label={
              pendingOrder
                ? `${t(
                    'retryPayment'
                  )} ${money(
                    pendingOrder.total_amount
                  )}`
                : payMethod ===
                    'online'
                  ? `${t(
                      'payNow'
                    )} ${money(
                      total
                    )}`
                  : t(
                      'placeOrder'
                    )
            }
            onPress={
              placeOrder
            }
          />

          <View style={s.trustRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color={C.success}
            />

            <Text
              style={s.trustText}
            >
              Secure checkout · Your
              details are protected
            </Text>
          </View>
        </Card>
      </View>
    </Page>
  );
}

function ProgressStep({
  number,
  label,
  active,
}: {
  number: string;
  label: string;
  active?: boolean;
}) {
  return (
    <View style={s.progressStep}>
      <View
        style={[
          s.progressCircle,
          active &&
            s.progressCircleActive,
        ]}
      >
        <Text
          style={[
            s.progressNumber,
            active &&
              s.progressNumberActive,
          ]}
        >
          {number}
        </Text>
      </View>

      <Text
        style={[
          s.progressLabel,
          active &&
            s.progressLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function PayOption({
  active,
  title,
  note,
  onPress,
  testID,
  disabled,
}: {
  active: boolean;
  title: string;
  note: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.pay,
        active && s.payActive,
        disabled &&
          s.payDisabled,
      ]}
    >
      <Ionicons
        name={
          active
            ? 'radio-button-on'
            : 'radio-button-off'
        }
        size={20}
        color={
          active
            ? C.primary
            : C.muted
        }
      />

      <View style={{ flex: 1 }}>
        <Text style={s.payTitle}>
          {title}
        </Text>

        <Text style={s.muted}>
          {note}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: {
    gap: 16,
  },

  pageWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  leftColumn: {
    gap: 16,
  },

  leftWide: {
    flex: 3,
  },

  summary: {
    gap: 12,
  },

  summaryWide: {
    flex: 2,
  },

  fields: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },

  muted: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
  },

  sectionHint: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 12,
  },

  validationText: {
    color: C.danger,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 8,
  },

  savedText: {
    color: C.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressStep: {
    alignItems: 'center',
    gap: 5,
  },

  progressCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressCircleActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },

  progressNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: C.muted,
  },

  progressNumberActive: {
    color: C.white,
  },

  progressLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },

  progressLabelActive: {
    color: C.ink,
    fontWeight: '800',
  },

  progressLine: {
    width: 35,
    height: 1,
    backgroundColor: C.line,
    marginHorizontal: 8,
    marginBottom: 18,
  },

  shippingWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
  },

  shippingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 13,
    backgroundColor: C.primaryLight,
  },

  shippingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },

  shippingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },

  shippingPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: C.ink,
  },

  pay: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
  },

  payActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },

  payDisabled: {
    opacity: 0.65,
  },

  payTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },

  secureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
  },

  secureText: {
    flex: 1,
    fontSize: 12,
    color: C.muted,
  },

  codBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
  },

  codText: {
    flex: 1,
    fontSize: 12,
    color: C.muted,
  },

  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  summaryMeta: {
    fontSize: 12,
    color: C.muted,
    marginTop: -8,
  },

  editCart: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  products: {
    gap: 10,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  thumb: {
    width: 54,
    height: 54,
    borderRadius: 11,
    backgroundColor: C.primaryLight,
  },

  itemMiddle: {
    flex: 1,
    gap: 2,
  },

  itemName: {
    fontSize: 14,
    color: C.ink,
    fontWeight: '600',
  },

  quantity: {
    fontSize: 12,
    color: C.muted,
  },

  lowStock: {
    fontSize: 11,
    color: C.danger,
    fontWeight: '700',
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },

  couponSection: {
    gap: 6,
    paddingTop: 4,
  },

  couponTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
  },

  couponRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },

  applyBtn: {
    backgroundColor: C.ink,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
  },

  applyDisabled: {
    opacity: 0.45,
  },

  applyText: {
    color: C.white,
    fontWeight: '700',
  },

  couponSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  err: {
    color: C.danger,
    fontSize: 13,
  },

  ok: {
    color: C.success,
    fontSize: 13,
    fontWeight: '700',
  },

  priceSection: {
    gap: 4,
  },

  divider: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 5,
  },

  small: {
    fontSize: 12,
    color: C.muted,
  },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },

  trustText: {
    fontSize: 11,
    color: C.muted,
  },
});
