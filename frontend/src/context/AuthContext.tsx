import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { storage } from '@/src/utils/storage';

type UserRole = 'customer' | 'saint' | 'admin' | null;

type AuthContextType = {
  userToken: string | null;
  userRole: UserRole;
  user: any | null;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  userToken: null,
  userRole: null,
  user: null,
  login: async () => {},
  logout: async () => {},
  isLoading: true,
});

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const token = await storage.secureGet('auth_token', null);

        if (token) {
          setUserToken(token);

          const response = await fetch(
            `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.ok) {
            const currentUser = await response.json();

            setUser(currentUser);
            setUserRole(currentUser.role ?? null);
          } else {
            await storage.secureRemove('auth_token');
            setUserToken(null);
            setUser(null);
            setUserRole(null);
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!userToken && !inAuthGroup) {
      router.replace('/auth/login');
      return;
    }

    if (userToken && inAuthGroup) {
      if (userRole === 'admin') {
        router.replace('/admin/dashboard');
      } else if (userRole === 'saint') {
        router.replace('/saint/dashboard');
      } else {
        router.replace('/customer/dashboard');
      }
    }
  }, [userToken, userRole, segments, isLoading]);

  const login = async (token: string, loggedInUser: any) => {
    const role: UserRole = loggedInUser?.role ?? null;

    setUserToken(token);
    setUserRole(role);
    setUser(loggedInUser ?? null);

    await storage.secureSet('auth_token', token);

    if (role === 'admin') {
      router.replace('/admin/dashboard');
    } else if (role === 'saint') {
      router.replace('/saint/dashboard');
    } else {
      router.replace('/customer/dashboard');
    }
  };

  const logout = async () => {
    setUserToken(null);
    setUserRole(null);
    setUser(null);

    await storage.secureRemove('auth_token');

    router.replace('/auth/login');
  };

  return (
    <AuthContext.Provider
      value={{
        userToken,
        userRole,
        user,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
