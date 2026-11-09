import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/src/api/client';
import { Product, useStore } from '@/src/store/StoreContext';
import { Page, Loading } from '@/src/store/components/Page';
import { ProductCard } from '@/src/store/components/ProductCard';
import { Notice } from '@/src/store/components/ui';
import { C, useLayout } from '@/src/store/theme';
import { router } from 'expo-router';

type SortOption = 'default' | 'price_low' | 'price_high' | 'rating';

export default function StoreCatalog() {
  const { t, cat } = useStore();
  const { cols, isWide } = useLayout();

  const [products, setProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortOption>('default');
  const [stockOnly, setStockOnly] = useState(false);

  useEffect(() => {
    loadProducts();
    loadRecentlyViewed();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const rows = await apiClient.get('/store/products');
      setProducts(rows || []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentlyViewed = async () => {
    try {
      setRecentLoading(true);

      const rows = await apiClient.get('/store/recently-viewed');
      setRecentlyViewed(rows || []);
    } catch {
      // Recently viewed is optional.
      // Do not block the main store if this endpoint is unavailable.
      setRecentlyViewed([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          products
            .map((p) => p.category)
            .filter(Boolean) as string[]
        )
      ),
    ],
    [products]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = products.filter((p) => {
      if (category !== 'All' && p.category !== category) {
        return false;
      }

      if (stockOnly && (!p.stock || p.stock <= 0)) {
        return false;
      }

      if (!q) {
        return true;
      }

      return [
        p.name,
        p.name_kn,
        p.category,
        p.description,
        p.shop_name,
      ].some((v) =>
        (v || '').toLowerCase().includes(q)
      );
    });

    if (sort === 'price_low') {
      result = [...result].sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0)
      );
    }

    if (sort === 'price_high') {
      result = [...result].sort(
        (a, b) => Number(b.price || 0) - Number(a.price || 0)
      );
    }

    if (sort === 'rating') {
      result = [...result].sort(
        (a, b) =>
          Number(b.average_rating || 0) -
          Number(a.average_rating || 0)
      );
    }

    return result;
  }, [
    products,
    search,
    category,
    sort,
    stockOnly,
  ]);

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setSort('default');
    setStockOnly(false);
  };

  const hasFilters =
    !!search ||
    category !== 'All' ||
    sort !== 'default' ||
    stockOnly;

  const sortLabel = () => {
    if (sort === 'price_low') return 'Price: Low to High';
    if (sort === 'price_high') return 'Price: High to Low';
    if (sort === 'rating') return 'Top Rated';
    return 'Sort';
  };

  const renderQuickAction = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle: string,
    onPress: () => void
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.quickAction,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={s.quickIcon}>
        <Ionicons name={icon} size={20} color={C.ink} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.quickTitle}>{title}</Text>
        <Text style={s.quickSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={C.muted}
      />
    </Pressable>
  );

  return (
    <Page testID="store-catalog-page" showBack={false}>
      <View
        style={[
          s.hero,
          isWide && {
            paddingVertical: 36,
            paddingHorizontal: 32,
          },
        ]}
      >
        <Text style={s.heroKicker}>
          {t('storeName')}
        </Text>

        <Text
          testID="store-hero-title"
          style={[
            s.heroTitle,
            isWide && { fontSize: 34 },
          ]}
        >
          {t('heroTitle')}
        </Text>

        <Text style={s.heroSub}>
          {t('heroSubtitle')}
        </Text>

        <View style={s.searchBox}>
          <Ionicons
            name="search"
            size={18}
            color={C.muted}
          />

          <TextInput
            testID="store-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder={t('search')}
            placeholderTextColor="#9CA3AF"
            style={s.searchInput}
          />

          {!!search && (
            <Pressable
              testID="store-search-clear"
              onPress={() => setSearch('')}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={C.muted}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Marketplace shortcuts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.quickActionsRow}
      >
        {renderQuickAction(
          'heart-outline',
          'Wishlist',
          'Saved products',
          () => router.push('/store/wishlist')
        )}

        {renderQuickAction(
          'cart-outline',
          'Cart',
          'View your cart',
          () => router.push('/store/cart')
        )}

        {renderQuickAction(
          'receipt-outline',
          'My Orders',
          'Track your orders',
          () => router.push('/store/orders')
        )}
      </ScrollView>

      {/* Recently viewed */}
      {!recentLoading && recentlyViewed.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>
                Recently Viewed
              </Text>

              <Text style={s.sectionSubtitle}>
                Continue shopping from where you stopped
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.recentRow}
          >
            {recentlyViewed.slice(0, 8).map((p) => (
              <View
                key={p.id}
                style={s.recentCard}
              >
                <ProductCard
                  product={p}
                  width={220}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Categories */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>
              Categories
            </Text>

            <Text style={s.sectionSubtitle}>
              Find products quickly
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryRow}
        >
          {categories.map((c) => (
            <Pressable
              key={c}
              testID={`category-chip-${c
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')}`}
              onPress={() => setCategory(c)}
              style={[
                s.chip,
                category === c && s.chipActive,
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  category === c &&
                    s.chipTextActive,
                ]}
              >
                {c === 'All' ? t('all') : cat(c)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Filters */}
      <View style={s.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterScroll}
        >
          <Pressable
            onPress={() => {
              setSort(
                sort === 'default'
                  ? 'price_low'
                  : sort === 'price_low'
                    ? 'price_high'
                    : sort === 'price_high'
                      ? 'rating'
                      : 'default'
              );
            }}
            style={s.filterButton}
          >
            <Ionicons
              name="swap-vertical"
              size={17}
              color={C.ink}
            />

            <Text style={s.filterText}>
              {sortLabel()}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setStockOnly((v) => !v)
            }
            style={[
              s.filterButton,
              stockOnly && s.filterButtonActive,
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={17}
              color={
                stockOnly ? C.white : C.ink
              }
            />

            <Text
              style={[
                s.filterText,
                stockOnly &&
                  s.filterTextActive,
              ]}
            >
              In Stock
            </Text>
          </Pressable>

          {hasFilters && (
            <Pressable
              onPress={clearFilters}
              style={s.clearButton}
            >
              <Ionicons
                name="close"
                size={16}
                color={C.saffronDark}
              />

              <Text style={s.clearText}>
                Clear
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {loading ? (
        <Loading text={t('loading')} />
      ) : error ? (
        <Notice
          tone="error"
          text={error}
          testID="store-catalog-error"
        />
      ) : (
        <>
          <View style={s.resultHeader}>
            <View>
              <Text
                testID="store-result-count"
                style={s.count}
              >
                {visible.length}{' '}
                {visible.length === 1
                  ? t('product')
                  : t('products')}
              </Text>

              {hasFilters && (
                <Text style={s.activeFilterText}>
                  Filters applied
                </Text>
              )}
            </View>

            <Pressable
              onPress={loadProducts}
              style={s.refreshButton}
            >
              <Ionicons
                name="refresh"
                size={17}
                color={C.ink}
              />

              <Text style={s.refreshText}>
                Refresh
              </Text>
            </Pressable>
          </View>

          {visible.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name="search-outline"
                  size={32}
                  color={C.muted}
                />
              </View>

              <Text style={s.emptyTitle}>
                {t('noProducts')}
              </Text>

              <Text style={s.emptySubtitle}>
                Try another search or category.
              </Text>

              {hasFilters && (
                <Pressable
                  onPress={clearFilters}
                  style={s.emptyButton}
                >
                  <Text
                    style={s.emptyButtonText}
                  >
                    Clear Filters
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={s.grid}>
              {visible.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  width={`${100 / cols}%`}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: C.primaryLight,
    borderRadius: 22,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D3ECFB',
  },

  heroKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: C.saffronDark,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.ink,
    lineHeight: 34,
  },

  heroSub: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 22,
    maxWidth: 620,
  },

  searchBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.line,
    maxWidth: 620,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: C.ink,
    outlineStyle: 'none',
  } as any,

  quickActionsRow: {
    gap: 10,
    paddingVertical: 14,
  },

  quickAction: {
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
  },

  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },

  quickSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: C.muted,
  },

  section: {
    marginTop: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
  },

  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },

  recentRow: {
    gap: 12,
    paddingBottom: 8,
  },

  recentCard: {
    width: 220,
  },

  categoryRow: {
    gap: 8,
    paddingBottom: 6,
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },

  chipActive: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },

  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },

  chipTextActive: {
    color: C.white,
  },

  filterBar: {
    marginTop: 8,
    marginBottom: 8,
  },

  filterScroll: {
    gap: 8,
  },

  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },

  filterButtonActive: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },

  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },

  filterTextActive: {
    color: C.white,
  },

  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },

  clearText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.saffronDark,
  },

  resultHeader: {
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  count: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '700',
  },

  activeFilterText: {
    marginTop: 2,
    fontSize: 11,
    color: C.saffronDark,
    fontWeight: '700',
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },

  refreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -7,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 55,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
  },

  emptySubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  emptyButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '800',
  },
});
