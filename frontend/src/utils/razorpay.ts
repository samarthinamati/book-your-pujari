// frontend/src/utils/razorpay.ts
import { Platform } from 'react-native';

interface RazorpayOptions {
  key: string;
  amount: string;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  prefill: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(false); return; }
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const openRazorpayCheckout = async (options: RazorpayOptions): Promise<RazorpayResponse> => {
  if (Platform.OS === 'web') {
    const loaded = await loadRazorpayScript();
    if (!loaded) throw new Error('Failed to load Razorpay SDK');
    return new Promise((resolve, reject) => {
      const rzpOptions = {
        ...options,
        handler: (response: RazorpayResponse) => resolve(response),
        modal: {
          ondismiss: () => reject({ code: 'PAYMENT_CANCELLED', description: 'Payment cancelled by user' }),
        },
      };
      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.on('payment.failed', (response: any) => {
        reject({
          code: response.error?.code || 'PAYMENT_FAILED',
          description: response.error?.description || 'Payment failed',
        });
      });
      rzp.open();
    });
  }
  const RazorpayCheckout = require('react-native-razorpay').default;
  return RazorpayCheckout.open(options);
};
