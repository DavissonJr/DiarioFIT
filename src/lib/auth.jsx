import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken, onSessionExpired } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onSessionExpired(() => setUser(null));
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const enter = useCallback(async (path, body) => {
    const data = await api(path, { method: 'POST', body });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = {
    user,
    loading,
    login: (email, password) => enter('/auth/login', { email, password }),
    register: (name, email, password) => enter('/auth/register', { name, email, password }),
    logout: () => {
      setToken(null);
      setUser(null);
    },
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
