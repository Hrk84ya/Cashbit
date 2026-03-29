import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import apiClient, { setAccessToken, setLogoutCallback } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOGIN'; payload: { user: User; accessToken: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_TOKEN'; payload: { accessToken: string } }
  | { type: 'SET_LOADING'; payload: boolean };

interface AuthContextValue extends AuthState {
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  setToken: (accessToken: string) => void;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { user: action.payload.user, accessToken: action.payload.accessToken, isAuthenticated: true, isLoading: false };
    case 'LOGOUT':
      return { user: null, accessToken: null, isAuthenticated: false, isLoading: false };
    case 'SET_TOKEN':
      return { ...state, accessToken: action.payload.accessToken };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = useCallback((user: User, accessToken: string) => {
    setAccessToken(accessToken);
    dispatch({ type: 'LOGIN', payload: { user, accessToken } });
  }, []);

  const logout = useCallback(async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    setAccessToken(null);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const setToken = useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    dispatch({ type: 'SET_TOKEN', payload: { accessToken } });
  }, []);

  // Wire up the logout callback for the axios interceptor (SESSION_COMPROMISED)
  useEffect(() => {
    setLogoutCallback(() => {
      setAccessToken(null);
      dispatch({ type: 'LOGOUT' });
    });
  }, []);

  // On mount: try to restore session from refresh token cookie
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const refreshRes = await apiClient.post('/auth/refresh');
        const newToken: string = refreshRes.data.data.accessToken;
        setAccessToken(newToken);

        const meRes = await apiClient.get('/auth/me');
        const user = meRes.data.data;

        if (!cancelled) {
          dispatch({ type: 'LOGIN', payload: { user, accessToken: newToken } });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: 'LOGOUT' });
        }
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(
    () => ({ ...state, login, logout, setToken }),
    [state, login, logout, setToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
