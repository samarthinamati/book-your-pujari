import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import { Product, useStore } from '@/src/store/StoreContext';
import { Page, Loading } from '@/src/store/components/Page';
import { ProductCard } from '@/src/store/components/ProductCard';
import { Notice } from '@/src/store/components/ui';
import { C, useLayout } from '@/src/store/theme';

export default function StoreCatalog() {
  const { t, cat } = useStore();
  const { cols, isWide } = useLayout();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    apiClient.get('/store/products')
      .then((rows) => setProducts(rows || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[]))],
    [products]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (!q) return true;
      return [p.name, p.name_kn, p.category, p.description, p.shop_name].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [products, search, category]);

  return (
    <Page testID="store-catalog-page" showBack={false}>
      <View style={[s.hero, isWide && { paddingVertical: 36, paddingHorizontal: 32 }]}>
        <Text style={s.heroKicker}>{t('storeName')}</Text>
        <Text testID="store-hero-title" style={[s.heroTitle, isWide && { fontSize: 34 }]}>{t('heroTitle')}</Text>
        <Text style={s.heroSub}>{t('heroSubtitle')}</Text>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            testID="store-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder={t('search')}
            placeholderTextColor="#9CA3AF"
            style={s.searchInput}
          />
          {!!search && (
            <Pressable testID="store-search-clear" onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {categories.map((c) => (
          <Pressable key={c} testID={`category-chip-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} onPress={() => setCategory(c)} style={[s.chip, category === c && s.chipActive]}>
            <Text style={[s.chipText, category === c && s.chipTextActive]}>{c === 'All' ? t('all') : cat(c)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <Loading text={t('loading')} /> : error ? <Notice tone="error" text={error} testID="store-catalog-error" /> : (
        <>
          <Text testID="store-result-count" style={s.count}>{visible.length} {visible.length === 1 ? t('product') : t('products')}</Text>
          {visible.length === 0 ? (
            <Notice text={t('noProducts')} testID="store-no-products" />
          ) : (
            <View style={s.grid}>
              {visible.map((p) => <ProductCard key={p.id} product={p} width={`${100 / cols}%`} />)}
            </View>
          )}
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.primaryLight, borderRadius: 22, padding: 20, gap: 8, borderWidth: 1, borderColor: '#D3ECFB' },
  heroKicker: { fontSize: 12, fontWeight: '800', color: C.saffronDark, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: C.ink, lineHeight: 34 },
  heroSub: { fontSize: 15, color: C.muted, lineHeight: 22, maxWidth: 620 },
  searchBox: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, maxWidth: 620 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.ink, outlineStyle: 'none' } as any,
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, fontWeight: '600', color: C.ink },
  chipTextActive: { color: C.white },
  count: { fontSize: 13, color: C.muted, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7 },
});
