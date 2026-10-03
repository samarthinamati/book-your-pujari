import { storage } from '@/src/utils/storage';

const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
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

    // IMPORTANT: send JWT token to backend
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(
      `[API] ${options.method || 'GET'} ${endpoint}`,
      token ? 'AUTH TOKEN PRESENT' : 'NO AUTH TOKEN'
    );

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({
          detail: `Request failed with status ${response.status}`,
        }));

      throw new Error(
        error.detail || `Request failed with status ${response.status}`
      );
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
    
