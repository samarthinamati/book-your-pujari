
import { storage } from '@/src/utils/storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, '');

if (!BACKEND_URL) {
  console.warn(
    'EXPO_PUBLIC_BACKEND_URL is missing. Check your frontend environment variables.'
  );
}

const API_URL = `${BACKEND_URL}/api`;

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    if (!BACKEND_URL) {
      throw new Error(
        'Backend URL is not configured. Please check the frontend environment variables.'
      );
    }

    const token = await storage.secureGet<string>('auth_token', null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(
      `[API] ${options.method || 'GET'} ${endpoint}`,
      token ? 'AUTH TOKEN PRESENT' : 'NO AUTH TOKEN'
    );

    const cleanEndpoint = endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;

    const response = await fetch(`${API_URL}${cleanEndpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `Request failed with status ${response.status}`,
      }));

      throw new Error(
        error.detail || `Request failed with status ${response.status}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  get(endpoint: string) {
    return this.request(endpoint, {
      method: 'GET',
    });
  },

  post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  },
};
