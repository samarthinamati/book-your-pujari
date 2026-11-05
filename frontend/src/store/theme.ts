import { useWindowDimensions } from 'react-native';

export const C = {
  primary: '#42A5E8',
  primaryDark: '#1E7FC2',
  primaryLight: '#EAF7FF',
  saffron: '#E8772E',
  saffronDark: '#C95F1A',
  saffronLight: '#FFF1E6',
  ink: '#1F2A37',
  muted: '#6B7280',
  line: '#E5E7EB',
  bg: '#F7F9FC',
  white: '#FFFFFF',
  success: '#15803D',
  successBg: '#DCFCE7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  demo: '#92400E',
  demoBg: '#FEF3C7',
};

export const MAX_W = 1200;

export function useLayout() {
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 760 ? 3 : 2;
  return { width, cols, isWide: width >= 900, isTablet: width >= 600 };
}

export const money = (n: number | undefined | null) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: Number(n || 0) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const shortId = (id: string) => `#${String(id || '').slice(-6).toUpperCase()}`;

export const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
