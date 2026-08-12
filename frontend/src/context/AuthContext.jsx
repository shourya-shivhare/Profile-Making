import { createContext, useContext, useCallback, useEffect, useState } from 'react';

import { authApi } from '@/api/auth.api.js';
import { useAuthStore } from '@/store/authStore.js';




const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, accessToken, setAuth, clearAuth, setLoading, isLoading, hasRole, getRoleLabel } =
    useAuthStore();

  const [isInitializing, setIsInitializing] = useState(true);


  // ─── Session Hydration on Mount ────────────────────────────────────────────
  // On every page load we optimistically call /auth/refresh.
  //
  // WHY: The access token is intentionally NOT persisted to localStorage
  // (only `user` is, so the UI can pre-render before the network call).
  // The httpOnly refresh-token cookie IS sent automatically by the browser,
  // so if a valid session exists the refresh will succeed and restore the
  // in-memory access token without the user having to log in again.
  //
  // We wait a minimal 50 ms to let the Zustand store fully rehydrate from
  // localStorage (the persist middleware runs synchronously but we need to
  // yield one tick to avoid reading stale state).
  useEffect(() => {
    const tryRefresh = async () => {
      await new Promise((r) => setTimeout(r, 50));

      const { accessToken: currentToken } = useAuthStore.getState();

      // If we somehow already have a valid in-memory token (e.g. HMR in dev)
      // skip the network call.
      if (currentToken) {
        setIsInitializing(false);
        return;
      }

      // Always attempt refresh — the cookie will be sent automatically.
      // If no cookie exists the server will return 401 which is fine.
      try {
        const { data } = await authApi.refresh();
        useAuthStore.getState().setAccessToken(data.data.accessToken);
      } catch (err) {
        const status = err?.response?.status;
        // 401 / 403 = no valid session. Clear any stale user data.
        if (status === 401 || status === 403) {
          clearAuth();
        }
        // For network errors (offline, server down) we keep the cached user
        // so the UI can show a degraded state instead of logging out.
      } finally {
        setIsInitializing(false);
      }
    };

    tryRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run exactly once on mount


  // ─── Auth Actions ──────────────────────────────────────────────────────────

  const loginSME = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const { data } = await authApi.smeLogin(credentials);
      setAuth({ user: data.data.user, accessToken: data.data.accessToken });
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading]);


  const registerSME = useCallback(async (formData) => {
    setLoading(true);
    try {
      const { data } = await authApi.smeRegister(formData);
      if (data.data.mfaRequired) {
        return { mfaRequired: true, tempToken: data.data.tempToken, user: data.data.user };
      }
      setAuth({ user: data.data.user, accessToken: data.data.accessToken });
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading]);


  const loginBank = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const { data } = await authApi.bankLogin(credentials);
      setAuth({ user: data.data.user, accessToken: data.data.accessToken });
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading]);


  const registerBank = useCallback(async (formData) => {
    setLoading(true);
    try {
      const { data } = await authApi.bankRegister(formData);
      if (data.data.mfaRequired) {
        return { mfaRequired: true, tempToken: data.data.tempToken, user: data.data.user };
      }
      setAuth({ user: data.data.user, accessToken: data.data.accessToken });
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading]);


  const verifyMfa = useCallback(async (tempToken, code) => {
    setLoading(true);
    try {
      const { data } = await authApi.mfaVerify(tempToken, code);
      setAuth({ user: data.data.user, accessToken: data.data.accessToken });
      return data.data.user;
    } finally {
      setLoading(false);
    }
  }, [setAuth, setLoading]);


  // Resend OTP — calls the backend which validates the temp token,
  // rate-limits, deletes the old OTP and sends a fresh one.
  // Returns a new tempToken with a reset 5-minute expiry.
  const resendOtp = useCallback(async (tempToken) => {
    setLoading(true);
    try {
      const { data } = await authApi.mfaResend(tempToken);
      return { tempToken: data.data.tempToken };
    } finally {
      setLoading(false);
    }
  }, [setLoading]);


  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Even if the server call fails (e.g. expired token), clear local state
      console.error('Logout API call failed:', err);
    } finally {
      clearAuth();
    }
  }, [clearAuth]);


  const isAuthenticated = !!(user && accessToken);

  const value = {
    user,
    accessToken,
    isLoading,
    isInitializing,
    isAuthenticated,
    loginSME,
    loginBank,
    registerSME,
    registerBank,
    verifyMfa,
    resendOtp,
    logout,
    hasRole: (...roles) => hasRole(...roles),
    getRoleLabel,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
