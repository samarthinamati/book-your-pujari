import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '@/src/utils/storage';
import { apiClient } from '@/src/api/client';
import { CATEGORY_KN, STRINGS, StoreKey, StoreLang } from './i18n';

export type Product = {
  id: string;
  name: string;
  name_kn?: string;
  description?: string;
  description_kn?: string;
  category?: string;
  price: number;
  image_url?: string;
  images?: string[];
  stock?: number;
  is_returnable?: boolean;
  weight_grams?: number;
  seller_id?: string;
  shop_name?: string;
  average_rating?: number;
  review_count?: number;
};

export type CartLine = { product: Product; quantity: number };

export type StoreConfig = {
  shipping_is_demo: boolean;
  demo_shipping_fee: number;
  platform_fee_percent: number;
  online_payments_enabled: boolean;
  return_window_days: number;
};

type StoreCtx = {
  lang: StoreLang;
  setLang: (l: StoreLang) => void;
  t: (k: StoreKey, vars?: Record<string, string | number>) => string;
  pName: (p: Product) => string;
  pDesc: (p: Product) => string;
  cat: (c?: string) => string;
  plural: (n: number) => string;
  cart: Record<string, CartLine>;
  cartCount: number;
  addToCart: (p: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  wishlist: string[];
  toggleWishlist: (id: string) => Promise<void>;
  config: StoreConfig | null;
  ready: boolean;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<StoreLang>('en');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const savedLang = await storage.getItem('store_lang', 'en');
      if (savedLang === 'kn' || savedLang === 'en') setLangState(savedLang);
      const rawCart = await storage.getItem('store_cart', '');
      if (typeof rawCart === 'string' && rawCart) {
        try {
          const parsed = JSON.parse(rawCart) || {};
          const clean: Record<string, CartLine> = {};
          Object.entries(parsed).forEach(([id, line]: [string, any]) => {
            if (line?.product?.id && typeof line.product.price === 'number' && Number(line.quantity) > 0) clean[id] = line;
          });
          setCart(clean);
        } catch { /* ignore corrupt cart */ }
      }
      setReady(true);
    })();
    apiClient.get('/store/config').then(setConfig).catch(() => setConfig(null));
    apiClient.get('/store/favourites')
      .then((rows: Product[]) => setWishlist((rows || []).map((p) => p.id)))
      .catch(() => setWishlist([]));
  }, []);

  useEffect(() => {
    if (ready) storage.setItem('store_cart', JSON.stringify(cart));
  }, [cart, ready]);

  const setLang = useCallback((l: StoreLang) => {
    setLangState(l);
    storage.setItem('store_lang', l);
  }, []);

  const t = useCallback((k: StoreKey, vars?: Record<string, string | number>) => {
    let s = STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
    if (vars) Object.entries(vars).forEach(([key, v]) => { s = s.replace(`{${key}}`, String(v)); });
    return s;
  }, [lang]);

  const pName = useCallback((p: Product) => (lang === 'kn' && p.name_kn ? p.name_kn : p.name), [lang]);
  const pDesc = useCallback((p: Product) => (lang === 'kn' && p.description_kn ? p.description_kn : p.description || ''), [lang]);

  const cat = useCallback((c?: string) => (lang === 'kn' && c && CATEGORY_KN[c]) || c || '', [lang]);
  const plural = useCallback((n: number) => `${n} ${n === 1 ? STRINGS[lang].item : STRINGS[lang].items}`, [lang]);

  const addToCart = useCallback((p: Product, qty = 1) => {
    setCart((c) => {
      const current = c[p.id]?.quantity || 0;
      const max = Math.min(Number(p.stock ?? 50), 50);
      return { ...c, [p.id]: { product: p, quantity: Math.min(current + qty, max) } };
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((c) => {
      if (qty <= 0) {
        const { [id]: _removed, ...rest } = c;
        return rest;
      }
      const line = c[id];
      if (!line) return c;
      return { ...c, [id]: { ...line, quantity: Math.min(qty, Number(line.product.stock ?? 50), 50) } };
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const toggleWishlist = useCallback(async (id: string) => {
    const has = wishlist.includes(id);
    setWishlist((w) => (has ? w.filter((x) => x !== id) : [id, ...w]));
    try {
      if (has) await apiClient.delete(`/store/favourites/${id}`);
      else await apiClient.post(`/store/favourites/${id}`, {});
    } catch {
      setWishlist((w) => (has ? [id, ...w] : w.filter((x) => x !== id)));
    }
  }, [wishlist]);

  const cartCount = useMemo(() => Object.values(cart).reduce((s, l) => s + l.quantity, 0), [cart]);

  const value = { lang, setLang, t, pName, pDesc, cat, plural, cart, cartCount, addToCart, setQty, clearCart, wishlist, toggleWishlist, config, ready };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
