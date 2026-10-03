import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('google_id_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const res = await api.get('/auth');
          setUser(res.data.user);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          logout();
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, [token]);

  const loginWithCredential = async (credential) => {
    localStorage.setItem('google_id_token', credential);
    setToken(credential);
    try {
      const res = await api.get('/auth', {
        headers: { Authorization: `Bearer ${credential}` },
      });
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      console.error('Google token verification failed', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('google_id_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithCredential, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
