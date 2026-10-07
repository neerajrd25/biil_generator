import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'google_id_token';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

// Google ID tokens are JWTs; read `exp` (ms epoch) so we can log out when it lapses. Non-JWT tokens (dev bypass) have none.
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState(null);

  const logout = useCallback((reason = null) => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSessionMessage(typeof reason === 'string' ? reason : null);
  }, []);

  // Validate the stored token on load / token change.
  useEffect(() => {
    async function checkAuth() {
      if (token) {
        const exp = getTokenExpiry(token);
        if (exp && exp <= Date.now()) {
          logout('Your session has expired. Please sign in again.');
        } else {
          try {
            const res = await api.get('/auth');
            setUser(res.data.user);
          } catch (err) {
            console.warn('Session expired or invalid token:', err);
            logout('Your session has expired. Please sign in again.');
          }
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, [token, logout]);

  // Auto logout when the token expires.
  useEffect(() => {
    const exp = token && getTokenExpiry(token);
    if (!exp) return undefined;
    const timer = setTimeout(
      () => logout('Your session has expired. Please sign in again.'),
      Math.max(0, exp - Date.now())
    );
    return () => clearTimeout(timer);
  }, [token, logout]);

  // Auto logout after inactivity.
  useEffect(() => {
    if (!token) return undefined;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout('You were signed out due to inactivity.'), IDLE_TIMEOUT_MS);
    };
    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [token, logout]);

  // Any 401 from the API ends the session.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
          logout('Your session has expired. Please sign in again.');
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [logout]);

  // Keep tabs in sync: logging out (or in) in one tab applies to the others.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY) {
        if (!e.newValue) { setToken(null); setUser(null); } else setToken(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loginWithCredential = async (credential) => {
    localStorage.setItem(TOKEN_KEY, credential);
    setSessionMessage(null);
    try {
      const res = await api.get('/auth', {
        headers: { Authorization: `Bearer ${credential}` },
      });
      setUser(res.data.user);
      setToken(credential);
      return res.data.user;
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      console.error('Google token verification failed', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, sessionMessage, loginWithCredential, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
