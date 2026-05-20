import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from './api';
import type { UserPermission } from './types';

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
  permissions: UserPermission[];
  login: (username: string, password: string, mfaCode?: string) => Promise<any>;
  register: (username: string, password: string, email?: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
  isInitializing: boolean;
  /** Check if current user can access a resource (by id, group, and ownerId) */
  hasResourceAccess: (resourceId: string, group: string, ownerId?: string | null) => boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // Verify stored token is still valid on app startup
  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setIsInitializing(false);
      return;
    }
    Promise.all([
      api.get('/auth/me'),
      api.get('/auth/me/permissions'),
    ])
      .then(([meRes, permRes]) => {
        setUser(meRes.data);
        if (permRes.data.role !== 'admin') {
          setPermissions(permRes.data.permissions || []);
        } else {
          setPermissions([]); // admin has full access, no filtering
        }
      })
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
    // Fetch permissions after login
    try {
      const permRes = await api.get('/auth/me/permissions');
      if (permRes.data.role !== 'admin') {
        setPermissions(permRes.data.permissions || []);
      } else {
        setPermissions([]);
      }
    } catch { /* ignore */ }
    return res.data;
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const res = await api.post('/auth/register', { username, password, email });
    const t = res.data.access_token;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(res.data.user);
    try {
      const permRes = await api.get('/auth/me/permissions');
      if (permRes.data.role !== 'admin') {
        setPermissions(permRes.data.permissions || []);
      } else {
        setPermissions([]);
      }
    } catch { /* ignore */ }
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  const hasResourceAccess = useCallback((resourceId: string, group: string, ownerId?: string | null): boolean => {
    // Not logged in: no access
    if (!user) return false;
    // Admin: always full access
    if (user.role === 'admin') return true;
    // Owner always has access
    if (ownerId && ownerId === user.id) return true;
    // User with no permissions configured: no access (must be explicitly authorized)
    if (permissions.length === 0) return false;
    // Check direct resource permission
    if (permissions.some((p) => p.type === 'resource' && p.target === resourceId)) return true;
    // Check group permission
    if (permissions.some((p) => p.type === 'group' && p.target === group)) return true;
    return false;
  }, [user, permissions]);

  return (
    <AuthContext.Provider value={{ token, user, permissions, login, register, logout, isAuthenticated: !!token, isInitializing, hasResourceAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
