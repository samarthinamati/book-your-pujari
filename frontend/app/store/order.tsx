import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/src/api/client';
import { useStore } from '@/src/store/StoreContext';
import { statusKey } from '@/src/store/i18n';
import { Page, Loading, SectionTitle } from '@/src/store/components/Page';
import { Btn, Card, Notice, Row, StatusChip } from '@/src/store/components/ui';
import { C, formatDate, money, shortId, useLayout } from '@/src/store/theme';

const STEPS = [
  'Order Placed',
  'Preparing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export default function OrderDetails() {
  const { id, placed } = useLocalSearchParams<{
    id: string;
    placed?: string;
  }>();

  const { t } = useStore();
  const { isWide } = useLayout();

  const [order, setOrder] = useState<any>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [trackMsg, setTrackMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');

      const result = await apiClient.get(
        `/store/orders/${id}`
      );

      setOrder(result);

      try {
        const resultReturns =
          await apiClient.get('/store/customer/returns');

        setReturns(
          (resultReturns || []).filter(
            (x: any) => x.order_id === id
          )
        );
      } catch {
        // Keep order page working even if returns fail to load.
      }
    } catch (e: any) {
      setError(
        e?.message || 'Unable to load order.'
      );
    }
  }, [id]);

  const refreshOrder = async () => {
    setRefreshing(true);

    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const refreshTracking = async () => {
    setRefreshing(true);
    setTrackMsg('');

    try {
      await apiClient.get(
        `/store/orders/${id}/delhivery-tracking`
      );

      await load();
    } catch {
      setTrackMsg(
        t('trackingUnavailable')
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id, load]);

  if (error) {
    return (
      <Page
        testID="order-page"
        title={t('orderDetails')}
      >
        <Notice
          tone="error"
          text={error}
          testID="order-error"
        />

        <Btn
          label="Try Again"
          onPress={load}
        />
      </Page>
    );
  }

  if (!order) {
    return (
      <Page
        testID="order-page"
        title={t('orderDetails')}
      >
        <Loading text={t('loading')} />
      </Page>
    );
  }

  const cancelled =
    order.order_status === 'Cancelled';

  const stepIndex = Math.max(
    0,
    STEPS.indexOf(order.order_status)
  );

  const deliveredAt = order.delivered_at
    ? new Date(
        order.delivered_at.endsWith('Z')
          ? order.delivered_at
          : `${order.delivered_at}Z`
      )
    : null;

  const returnOpen =
    order.order_status === 'Delivered' &&
    !!deliveredAt &&
    Date.now() - deliveredAt.getTime() <=
      7 * 86400000;

  const items = order.items || [];

  const totalQuantity = items.reduce(
    (sum: number, item: any) =>
      sum + Number(item.quantity || 0),
    0
  );

  const shipmentList =
    (order.shipments || []).filter(
      (sh: any) => sh.tracking_number
    );

  const hasTracking =
    shipmentList.length > 0;

  const paymentText =
    order.payment_status === 'paid'
      ? `${t('paid')} · Razorpay`
      : order.payment_method === 'cod'
        ? t('codPending')
        : t('pending');

  return (
    <Page
      testID="order-page"
      title={t('orderDetails')}
    >
      {placed === '1' && (
        <Notice
          tone="success"
          testID="order-success-banner"
          text={`${t('orderPlaced')}${
            order.payment_status === 'paid'
              ? ` · ${t('paymentVerified')}`
              : ''
          }`}
        />
      )}

      {order.refund_status ===
        'pending_admin_action' && (
        <Notice
          tone="demo"
          testID="order-refund-pending"
          text={`${t('refundPending')} (${money(
            order.refund_due_amount
          )})`}
        />
      )}

      {order.refund_status ===
        'refunded' && (
        <Notice
          tone="success"
          testID="order-refunded"
          text={`${t('refunded')} (${money(
            order.refund_due_amount
          )})`}
        />
      )}

      <Card style={s.heroCard}>
        <View style={s.top}>
          <View style={s.orderHeading}>
            <Text
              testID="order-id"
              style={s.id}
            >
              Order #{shortId(order.id)}
            </Text>

            <Text style={s.muted}>
              {t('orderedOn')}{' '}
              {formatDate(order.created_at)}
            </Text>
          </View>

          <StatusChip
            status={order.order_status}
            label={t(
              statusKey(
                order.order_status
              )
            )}
            testID="order-detail-status"
          />
        </View>

        <View style={s.quickStats}>
          <View style={s.stat}>
            <Text style={s.statValue}>
              {totalQuantity}
            </Text>
            <Text style={s.statLabel}>
              {totalQuantity === 1
                ? 'Item'
                : 'Items'}
            </Text>
          </View>

          <View style={s.stat}>
            <Text style={s.statValue}>
              {money(order.total_amount)}
            </Text>
            <Text style={s.statLabel}>
              Total
            </Text>
          </View>

          <View style={s.stat}>
            <Text style={s.statValue}>
              {order.payment_status ===
              'paid'
                ? 'Paid'
                : 'Pending'}
            </Text>
            <Text style={s.statLabel}>
              Payment
            </Text>
          </View>
        </View>

        {!cancelled && (
          <View
            style={[
              s.timeline,
              isWide &&
                s.timelineWide,
            ]}
          >
            {STEPS.map((step, i) => {
              const done =
                i <= stepIndex;

              return (
                <View
                  key={step}
                  testID={`order-step-${i}`}
                  style={[
                    s.step,
                    isWide &&
                      s.stepWide,
                  ]}
                >
                  <View
                    style={[
                      s.dot,
                      done &&
                        s.dotDone,
                    ]}
                  >
                    {done && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={C.white}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      s.stepText,
                      done &&
                        s.stepTextDone,
                    ]}
                  >
                    {t(
                      statusKey(step)
                    )}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {cancelled && (
          <View style={s.cancelledBox}>
            <Ionicons
              name="close-circle-outline"
              size={20}
              color={C.danger}
            />

            <Text style={s.cancelledText}>
              This order has been cancelled.
            </Text>
          </View>
        )}
      </Card>

      <View
        style={[
          s.mainLayout,
          isWide &&
            s.mainLayoutWide,
        ]}
      >
        <View
          style={[
            s.leftColumn,
            isWide && s.leftWide,
          ]}
        >
          <Card>
            <View style={s.sectionHeader}>
              <SectionTitle>
                {t('orderItems')}
              </SectionTitle>

              <Text style={s.itemCountText}>
                {totalQuantity}{' '}
                {totalQuantity === 1
                  ? 'item'
                  : 'items'}
              </Text>
            </View>

            <View style={s.itemsList}>
              {items.map((item: any) => (
                <OrderItem
                  key={item.product_id}
                  item={item}
                  orderId={order.id}
                  returnOpen={returnOpen}
                  existingReturn={returns.find(
                    (r) =>
                      r.product_id ===
                      item.product_id
                  )}
                  onReturned={load}
                />
              ))}
            </View>

            {order.order_status ===
              'Delivered' &&
              !returnOpen && (
                <Notice
                  tone="info"
                  text={t(
                    'returnClosed'
                  )}
                />
              )}

            {order.order_status !==
              'Delivered' && (
              <Text style={s.muted}>
                {t('returnWindow')}
              </Text>
            )}
          </Card>

          <Card>
            <View style={s.sectionHeader}>
              <SectionTitle>
                {t('tracking')}
              </SectionTitle>

              {hasTracking && (
                <Pressable
                  testID="order-refresh-tracking"
                  onPress={
                    refreshTracking
                  }
                >
                  <Text style={s.link}>
                    {refreshing
                      ? t('loading')
                      : t(
                          'refreshTracking'
                        )}
                  </Text>
                </Pressable>
              )}
            </View>

            {!!trackMsg && (
              <Text style={s.muted}>
                {trackMsg}
              </Text>
            )}

            {!hasTracking && (
              <View style={s.pendingTracking}>
                <Ionicons
                  name="cube-outline"
                  size={28}
                  color={C.primary}
                />

                <Text
                  testID="order-tracking-pending"
                  style={
                    s.pendingTitle
                  }
                >
                  {t(
                    'trackingPending'
                  )}
                </Text>

                <Text style={s.muted}>
                  Tracking information
                  will appear here when
                  available.
                </Text>
              </View>
            )}

            {shipmentList.map(
              (sh: any) => (
                <View
                  key={sh.seller_id}
                  testID={`order-shipment-${sh.seller_id}`}
                  style={
                    s.shipment
                  }
                >
                  <View
                    style={
                      s.shipmentHeader
                    }
                  >
                    <View
                      style={
                        s.shipmentTitleWrap
                      }
                    >
                      <Text
                        style={
                          s.shipmentTitle
                        }
                      >
                        {t(
                          'shipmentFrom'
                        )}
                        :{' '}
                        {sh.shop_name}
                      </Text>

                      <Text
                        style={
                          s.muted
                        }
                      >
                        {sh.courier ||
                          'Courier'}
                      </Text>
                    </View>

                    {sh.shipment_status && (
                      <StatusChip
                        status={
                          sh.shipment_status
                        }
                        label={t(
                          statusKey(
                            sh.shipment_status
                          )
                        )}
                      />
                    )}
                  </View>

                  <Row
                    label={t(
                      'awb'
                    )}
                    value={
                      sh.tracking_number
                    }
                    testID="order-tracking-number"
                  />

                  {!!sh.shipment_status && (
                    <Row
                      label={t(
                        'status'
                      )}
                      value={t(
                        statusKey(
                          sh.shipment_status
                        )
                      )}
                    />
                  )}

                  {!!sh.scans?.length && (
                    <View
                      style={
                        s.scanList
                      }
                    >
                      <Text
                        style={
                          s.scanHeading
                        }
                      >
                        Recent Updates
                      </Text>

                      {sh.scans
                        .slice()
                        .reverse()
                        .slice(0, 6)
                        .map(
                          (
                            sc: any,
                            i: number
                          ) => (
                            <View
                              key={
                                i
                              }
                              style={
                                s.scanRow
                              }
                            >
                              <View
                                style={
                                  s.scanDot
                                }
                              />

                              <View
                                style={
                                  s.scanContent
                                }
                              >
                                <Text
                                  style={
                                    s.scanStatus
                                  }
                                >
                                  {
                                    sc.status
                                  }
                                </Text>

                                <Text
                                  style={
                                    s.muted
                                  }
                                >
                                  {[
                                    sc.location,
                                    sc.time
                                      ? formatDate(
                                          sc.time
                                        )
                                      : '',
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      ' · '
                                    )}
                                </Text>
                              </View>
                            </View>
                          )
                        )}
                    </View>
                  )}

                  {!!sh.tracking_url && (
                    <Btn
                      testID="order-open-tracking"
                      variant="outline"
                      icon="open-outline"
                      label={t(
                        'openTracking'
                      )}
                      onPress={() =>
                        Linking.openURL(
                          sh.tracking_url
                        )
                      }
                    />
                  )}
                </View>
              )
            )}
          </Card>
        </View>

        <View
          style={[
            s.rightColumn,
            isWide && s.rightWide,
          ]}
        >
          <Card>
            <SectionTitle>
              {t('orderSummary')}
            </SectionTitle>

            <View style={s.summaryList}>
              <Row
                label={t(
                  'subtotal'
                )}
                value={money(
                  order.product_subtotal
                )}
              />

              {order.discount_amount >
                0 && (
                <Row
                  label={t(
                    'discount'
                  )}
                  value={`− ${money(
                    order.discount_amount
                  )}`}
                />
              )}

              <Row
                label={t(
                  'platformFee'
                )}
                value={money(
                  order.platform_fee
                )}
              />

              <Row
                label={t(
                  'shipping'
                )}
                value={money(
                  order.shipping_fee
                )}
                tag={
                  order.shipping_is_demo
                    ? 'DEMO'
                    : undefined
                }
              />

              {order.cod_fee > 0 && (
                <Row
                  label={t(
                    'codFee'
                  )}
                  value={money(
                    order.cod_fee
                  )}
                />
              )}

              <View
                style={
                  s.summaryDivider
                }
              />

              <Row
                bold
                label={t('total')}
                value={money(
                  order.total_amount
                )}
                testID="order-detail-total"
              />

              <Row
                label={t(
                  'payment'
                )}
                testID="order-payment-status"
                value={
                  paymentText
                }
              />
            </View>
          </Card>

          <Card>
            <SectionTitle>
              {t('deliverTo')}
            </SectionTitle>

            <View
              style={
                s.addressHeader
              }
            >
              <Ionicons
                name="location-outline"
                size={20}
                color={C.primary}
              />

              <Text
                style={
                  s.addressName
                }
              >
                {order.customer_name}
              </Text>
            </View>

            <Text
              style={
                s.addressPhone
              }
            >
              {order.customer_phone}
            </Text>

            <Text style={s.address}>
              {order.delivery_address},{' '}
              {order.city} -{' '}
              {order.pincode}
            </Text>
          </Card>

          <Card>
            <SectionTitle>
              Need help?
            </SectionTitle>

            <Text style={s.muted}>
              If you have a problem with
              this order, keep your order
              number ready when contacting
              support.
            </Text>

            <View
              style={
                s.helpOrder
              }
            >
              <Text
                style={
                  s.helpOrderLabel
                }
              >
                Order
              </Text>

              <Text
                style={
                  s.helpOrderId
                }
              >
                #{shortId(order.id)}
              </Text>
            </View>
          </Card>
        </View>
      </View>
    </Page>
  );
}

function OrderItem({
  item,
  orderId,
  returnOpen,
  existingReturn,
  onReturned,
}: any) {
  const { t } = useStore();

  const [open, setOpen] =
    useState(false);
  const [reason, setReason] =
    useState('');
  const [busy, setBusy] =
    useState(false);
  const [err, setErr] =
    useState('');

  const submit = async () => {
    setErr('');
    setBusy(true);

    try {
      await apiClient.post(
        '/store/returns/request',
        {
          order_id: orderId,
          product_id:
            item.product_id,
          quantity:
            item.quantity,
          reason:
            reason.trim(),
        }
      );

      setOpen(false);
      setReason('');
      onReturned();
    } catch (e: any) {
      setErr(
        e?.message ||
          'Unable to submit return request.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.item}>
      <View style={s.itemRow}>
        <Image
          source={{
            uri: item.image_url,
          }}
          style={s.itemImage}
        />

        <View
          style={s.itemInfo}
        >
          <Text
            style={s.itemName}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          <Text style={s.itemMeta}>
            {money(
              item.unit_price
            )}{' '}
            × {item.quantity}
          </Text>

          <Text style={s.itemMeta}>
            {item.is_returnable
              ? t(
                  'returnable'
                )
              : t(
                  'nonReturnable'
                )}
          </Text>

          {!!item.shop_name && (
            <Text
              style={
                s.itemMeta
              }
            >
              {t('soldBy')}:{' '}
              {item.shop_name}
            </Text>
          )}
        </View>

        <View
          style={
            s.itemPriceWrap
          }
        >
          <Text
            style={
              s.itemPrice
            }
          >
            {money(
              item.line_total
            )}
          </Text>
        </View>
      </View>

      {existingReturn ? (
        <View
          style={
            s.returnStatusBox
          }
        >
          <Text
            testID={`order-return-status-${item.product_id}`}
            style={
              s.returnTag
            }
          >
            {t(
              'returnRequested'
            )}
          </Text>

          <Text
            style={
              s.returnStatusText
            }
          >
            {existingReturn.status}
          </Text>
        </View>
      ) : returnOpen &&
        item.is_returnable ? (
        open ? (
          <View
            style={
              s.returnForm
            }
          >
            <Text
              style={
                s.returnFormTitle
              }
            >
              Return this item
            </Text>

            <TextInput
              testID={`order-return-reason-${item.product_id}`}
              value={reason}
              onChangeText={
                setReason
              }
              placeholder={t(
                'returnReason'
              )}
              placeholderTextColor="#9CA3AF"
              multiline
              style={
                s.input
              }
            />

            {!!err && (
              <Text
                style={
                  s.formError
                }
              >
                {err}
              </Text>
            )}

            <View
              style={
                s.formButtons
              }
            >
              <Btn
                testID={`order-return-submit-${item.product_id}`}
                label={t(
                  'submitReturn'
                )}
                loading={
                  busy
                }
                disabled={
                  reason.trim()
                    .length < 5
                }
                onPress={
                  submit
                }
              />

              <Btn
                testID={`order-return-cancel-${item.product_id}`}
                variant="outline"
                label={t(
                  'cancel'
                )}
                onPress={() =>
                  setOpen(
                    false
                  )
                }
              />
            </View>
          </View>
        ) : (
          <Pressable
            testID={`order-request-return-${item.product_id}`}
            onPress={() =>
              setOpen(true)
            }
            style={
              s.returnButton
            }
          >
            <Text
              style={
                s.link
              }
            >
              {t(
                'requestReturn'
              )}
            </Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  heroCard: {
    gap: 14,
  },

  top: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },

  orderHeading: {
    flex: 1,
    minWidth: 180,
  },

  id: {
    fontSize: 20,
    fontWeight: '900',
    color: C.ink,
  },

  muted: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
  },

  quickStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    gap: 8,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'center',
  },

  statLabel: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },

  timeline: {
    gap: 10,
    marginTop: 4,
  },

  timelineWide: {
    flexDirection: 'row',
  },

  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  stepWide: {
    flex: 1,
  },

  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },

  dotDone: {
    backgroundColor: C.success,
    borderColor: C.success,
  },

  stepText: {
    fontSize: 13,
    color: C.muted,
    flexShrink: 1,
  },

  stepTextDone: {
    color: C.ink,
    fontWeight: '700',
  },

  cancelledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },

  cancelledText: {
    color: C.danger,
    fontSize: 13,
    fontWeight: '700',
  },

  mainLayout: {
    gap: 16,
    marginTop: 16,
  },

  mainLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  leftColumn: {
    gap: 16,
  },

  leftWide: {
    flex: 3,
  },

  rightColumn: {
    gap: 16,
  },

  rightWide: {
    flex: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 10,
  },

  itemCountText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '700',
  },

  itemsList: {
    gap: 0,
  },

  item: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 12,
    marginTop: 12,
    gap: 9,
  },

  itemRow: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },

  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 11,
    backgroundColor:
      C.primaryLight,
  },

  itemInfo: {
    flex: 1,
    gap: 2,
  },

  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },

  itemMeta: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
  },

  itemPriceWrap: {
    minWidth: 70,
    alignItems: 'flex-end',
  },

  itemPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: C.ink,
  },

  trackingPending: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 5,
  },

  pendingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },

  shipment: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: 12,
    paddingTop: 12,
    gap: 7,
  },

  shipmentHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 10,
  },

  shipmentTitleWrap: {
    flex: 1,
  },

  shipmentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },

  scanList: {
    marginTop: 5,
    gap: 8,
  },

  scanHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: C.ink,
  },

  scanRow: {
    flexDirection: 'row',
    gap: 8,
  },

  scanDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.primary,
    marginTop: 6,
  },

  scanContent: {
    flex: 1,
  },

  scanStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },

  summaryList: {
    gap: 3,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 7,
  },

  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 3,
  },

  addressName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },

  addressPhone: {
    fontSize: 13,
    color: C.muted,
    marginLeft: 27,
    marginBottom: 5,
  },

  address: {
    fontSize: 14,
    color: C.ink,
    lineHeight: 21,
  },

  helpOrder: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },

  helpOrderLabel: {
    fontSize: 12,
    color: C.muted,
  },

  helpOrderId: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
  },

  link: {
    color: C.primaryDark,
    fontWeight: '800',
    fontSize: 14,
  },

  returnStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  returnTag: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: C.demo,
    backgroundColor: C.demoBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  returnStatusText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },

  returnForm: {
    gap: 8,
  },

  returnFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
  },

  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    minHeight: 70,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.white,
    textAlignVertical: 'top',
  },

  formError: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '600',
  },

  formButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },

  returnButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
});
