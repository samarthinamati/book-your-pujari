import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async getItem<T = any>(key: string, fallback: T | null = null): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return fallback;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.warn(`[storage] getItem(${key}) failed`, error);
      return fallback;
    }
  },

  async setItem<T = any>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[storage] setItem(${key}) failed`, error);
      return false;
    }
  },

  async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`[storage] removeItem(${key}) failed`, error);
      return false;
    }
  },

  async secureGet<T = any>(key: string, fallback: T | null = null): Promise<T | null> {
    return this.getItem<T>(key, fallback);
  },

  async secureSet<T = any>(key: string, value: T): Promise<boolean> {
    return this.setItem<T>(key, value);
  },

  async secureRemove(key: string): Promise<boolean> {
    return this.removeItem(key);
  },
};
