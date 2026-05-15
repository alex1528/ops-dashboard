import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from './api';

interface UserInfo {
  id: string;
  username: string;
  role: string;
  email: string;
  mfaEnabled: boolean;
}

interface AuthCtx {
  token: string | null;
  user: UserInfo | null;
  login: (username: string, password: string, mfaCode?: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Verify stored token is still valid on app startup
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setIsInitializing(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setIsInitializing(false));
  }, []);

  const login = useCallback(async (username: string, password: string, mfaCode?: string) => {
    const res = await api.post('/auth/login', { username, password, mfaCode });
    // MFA required - return the response so caller can prompt
    if (res.data.mfaRequired) return res.data;
    const t = res.data.access_token;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
