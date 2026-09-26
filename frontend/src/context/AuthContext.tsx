import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
  userToken: string | null;
  userRole: 'customer' | 'saint' | 'admin' | null;
  login: (token: string, role: 'customer' | 'saint' | 'admin') => void;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  userToken: null,
  userRole: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'saint' | 'admin' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Check if user is already logged in (e.g., check local storage or SecureStore)
    // For now, we simulate checking saved storage on startup
    const checkUserSession = async () => {
      // const token = await SecureStore.getItemAsync('userToken');
      // const role = await SecureStore.getItemAsync('userRole');
      
      // Simulated state check:
      setIsLoading(false);
    };

    checkUserSession();
  }, []);

  // Handle automatic routing protection based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!userToken && !inAuthGroup) {
      // If not logged in and not in auth screens, redirect to login
      router.replace('/auth/login');
    } else if (userToken && inAuthGroup) {
      // If logged in and trying to access login/register, redirect to appropriate dashboard
      if (userRole === 'saint') router.replace('/saint/dashboard');
      else router.replace('/customer/dashboard');
    }
  }, [userToken, segments, isLoading]);

  const login = (token: string, role: 'customer' | 'saint' | 'admin') => {
    setUserToken(token);
    setUserRole(role);
    // Save to SecureStore here if needed
    if (role === 'saint') router.replace('/saint/dashboard');
    else router.replace('/customer/dashboard');
  };

  const logout = () => {
    setUserToken(null);
    setUserRole(null);
    // Clear SecureStore here if needed
    router.replace('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ userToken, userRole, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
