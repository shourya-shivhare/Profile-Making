import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { notificationApi } from '../api/notification.api';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  const { accessToken, user } = useAuthStore();
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Fetch notifications from REST API
  const fetchNotifications = useCallback(async () => {
    if (!user || !accessToken) return;
    try {
      const [notifsRes, countRes] = await Promise.all([
        notificationApi.getAll({ limit: 50 }),
        notificationApi.getUnreadCount()
      ]);
      if (notifsRes.data?.data) {
        setNotifications(notifsRes.data.data);
      }
      if (countRes.data?.data?.count !== undefined) {
        setUnreadCount(countRes.data.data.count);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }, [user, accessToken]);

  // Connect to SSE for real-time updates
  const connectSSE = useCallback(() => {
    if (!accessToken || !user) return;
    if (eventSourceRef.current) return; // Already connected

    // SSE requires an absolute URL — relative paths don't work with EventSource.
    // In dev we connect directly to the backend (bypassing Vite proxy which
    // doesn't support streaming/SSE well). In production we use the env var.
    const baseURL = import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : 'https://capitalscale-backend.onrender.com/api/v1');
    const url = `${baseURL}/notifications/sse?token=${accessToken}`;
    
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('✅ SSE Connected');
      fetchNotifications(); // Catch up on missed notifications
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const newNotif = data.data;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          console.log(`🔔 New notification: ${newNotif.title}`);
        }
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('⚠️ SSE disconnected, will retry in 5s...');
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      
      // Auto-reconnect with backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, 5000);
    };

    eventSourceRef.current = eventSource;
  }, [accessToken, user, fetchNotifications]);

  // Main effect: when user logs in, fetch notifications + connect SSE + start polling
  useEffect(() => {
    if (user && accessToken) {
      // Immediately fetch from REST API (works even if SSE isn't ready yet)
      fetchNotifications();

      // Connect SSE for real-time push
      connectSSE();

      // Poll every 30s as a fallback (in case SSE drops silently)
      pollIntervalRef.current = setInterval(() => {
        fetchNotifications();
      }, 30000);
    } else {
      // Disconnect on logout
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      setIsConnected(false);
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [user, accessToken, connectSSE, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isConnected,
      markAsRead,
      markAllAsRead,
      refreshNotifications: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
