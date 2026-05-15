import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from './api';

interface AuthCtx {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isInitializing, setIsInitializing] = useState(true);

  // Verify stored token is still valid on app startup
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setIsInitializing(false);
      return;
    }
    api.get('/auth/me')
      .catch(() => {
        // Token is invalid or expired — clear it
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setIsInitializing(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    const t = res.data.access_token;
    localStorage.setItem('token', t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
