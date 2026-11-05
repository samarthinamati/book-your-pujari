import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../StoreContext';
import { C, MAX_W, useLayout } from '../theme';

type Props = { title?: string; showBack?: boolean };

export function StoreHeader({ title, showBack = true }: Props) {
  const { t, lang, setLang, cartCount, wishlist } = useStore();
  const { isTablet } = useLayout();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/store'));

  return (
    <View style={s.bar}>
      <View style={s.inner}>
        <View style={s.left}>
          {showBack ? (
            <Pressable testID="store-back-button" onPress={goBack} style={s.iconBtn} accessibilityLabel={t('back')}>
              <Ionicons name="arrow-back" size={22} color={C.ink} />
            </Pressable>
          ) : (
            <Pressable testID="store-home-dashboard-button" onPress={() => router.replace('/customer/dashboard')} style={s.iconBtn} accessibilityLabel={t('home')}>
              <Ionicons name="home-outline" size={21} color={C.ink} />
            </Pressable>
          )}
          <Pressable testID="store-logo-link" onPress={() => router.replace('/store')} style={{ flexShrink: 1 }}>
            <Text style={s.brand} numberOfLines={1}>{title || (isTablet ? t('storeName') : t('storeShort'))}</Text>
          </Pressable>
        </View>
        <View style={s.right}>
          <View style={s.langWrap}>
            {(['en', 'kn'] as const).map((l) => (
              <Pressable key={l} testID={`store-lang-${l}`} onPress={() => setLang(l)} style={[s.langBtn, lang === l && s.langActive]}>
                <Text style={[s.langText, lang === l && s.langTextActive]}>{l === 'en' ? 'EN' : isTablet ? 'ಕನ್ನಡ' : 'ಕ'}</Text>
              </Pressable>
            ))}
          </View>
          <HeaderIcon testID="store-orders-link" icon="receipt-outline" label={isTablet ? t('myOrders') : ''} onPress={() => router.push('/store/orders')} />
          <HeaderIcon testID="store-wishlist-link" icon="heart-outline" badge={wishlist.length} onPress={() => router.push('/store/wishlist')} />
          <HeaderIcon testID="store-cart-link" icon="cart-outline" badge={cartCount} onPress={() => router.push('/store/cart')} />
        </View>
      </View>
    </View>
  );
}

function HeaderIcon({ icon, badge, label, onPress, testID }: { icon: any; badge?: number; label?: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={s.iconBtn}>
      <Ionicons name={icon} size={22} color={C.ink} />
      {!!label && <Text style={s.iconLabel}>{label}</Text>}
      {!!badge && badge > 0 && (
        <View style={s.badge}><Text testID={`${testID}-badge`} style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 12, paddingVertical: 10 },
  inner: { width: '100%', maxWidth: MAX_W, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brand: { fontSize: 17, fontWeight: '800', color: C.primaryDark, letterSpacing: 0.2 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, gap: 6 },
  iconLabel: { fontSize: 14, color: C.ink, fontWeight: '600' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.saffron, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: C.white, fontSize: 11, fontWeight: '700' },
  langWrap: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 999, padding: 3, borderWidth: 1, borderColor: C.line, marginRight: 4 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  langActive: { backgroundColor: C.primary },
  langText: { fontSize: 12, fontWeight: '700', color: C.muted },
  langTextActive: { color: C.white },
});
