import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth as authApi } from '../services/api';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem('isdabi_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(token, user) {
  localStorage.setItem('isdabi_token', token);
  localStorage.setItem('isdabi_user', JSON.stringify(user));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('isdabi_token');

    if (!token) {
      setLoading(false);
      return;
    }

    authApi.me()
      .then(({ data }) => {
        const nextUser = data?.user || data?.data?.user || null;

        if (!nextUser) {
          throw new Error('User session could not be restored.');
        }

        setUser(nextUser);
        localStorage.setItem('isdabi_user', JSON.stringify(nextUser));
      })
      .catch(() => {
        localStorage.removeItem('isdabi_token');
        localStorage.removeItem('isdabi_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password);
    const nextUser = data?.user || data?.data?.user;
    const token = data?.token || data?.data?.token;

    if (!token || !nextUser) {
      throw new Error('Login response is incomplete.');
    }

    storeSession(token, nextUser);
    setUser(nextUser);

    return data;
  }, []);

  const register = useCallback(async (name, email, password, role) => {
    const { data } = await authApi.register(name, email, password, role);
    const nextUser = data?.user || data?.data?.user;
    const token = data?.token || data?.data?.token;

    if (!token || !nextUser) {
      throw new Error('Registration response is incomplete.');
    }

    storeSession(token, nextUser);
    setUser(nextUser);

    return data;
  }, []);

  const googleLogin = useCallback(async (credential, role) => {
    const { data } = await authApi.google(credential, role);
    const nextUser = data?.user || data?.data?.user;
    const token = data?.token || data?.data?.token;

    if (token && nextUser) {
      storeSession(token, nextUser);
      setUser(nextUser);
    }

    return data;
  }, []);

  const deleteAccount = useCallback(async () => {
    const currentUser = user;
    const { data } = await authApi.deleteAccount();

    if (
      currentUser?.email &&
      currentUser?.authProvider === 'google' &&
      window.google?.accounts?.id?.revoke
    ) {
      try {
        window.google.accounts.id.revoke(currentUser.email, () => {});
      } catch {
        // Local account deletion is already complete.
      }
    }

    localStorage.removeItem('isdabi_token');
    localStorage.removeItem('isdabi_user');
    setUser(null);

    return data;
  }, [user]);

  const logout = useCallback(() => {
    localStorage.removeItem('isdabi_token');
    localStorage.removeItem('isdabi_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        googleLogin,
        deleteAccount,
        logout,
        isAuthenticated: Boolean(user)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
