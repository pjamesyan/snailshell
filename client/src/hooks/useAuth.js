import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data.user || data);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('encryptionKey');
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials) => {
    const data = await api.login(credentials);
    if (data.requires2FA) {
      return data; // 返回给 Login 组件处理
    }
    localStorage.setItem('token', data.token);
    if (data.encryptionKey) localStorage.setItem('encryptionKey', data.encryptionKey);
    setUser(data.user || { username: credentials.username });
    return data;
  };

  const register = async (credentials) => {
    const data = await api.register(credentials);
    localStorage.setItem('token', data.token);
    if (data.encryptionKey) localStorage.setItem('encryptionKey', data.encryptionKey);
    setUser(data.user || { username: credentials.username });
    return data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('encryptionKey');
    setUser(null);
  }, []);

  // Auto-lock: monitor user activity
  useEffect(() => {
    if (!user) return;
    let timer = null;
    const getSettings = () => {
      try { return JSON.parse(localStorage.getItem('autoLock') || '{}'); } catch { return {}; }
    };
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      const settings = getSettings();
      if (settings.enabled && settings.timeout > 0) {
        timer = setTimeout(() => { logout(); }, settings.timeout * 60 * 1000);
      }
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, logout]);

  return { user, loading, login, register, logout, checkAuth };
}
