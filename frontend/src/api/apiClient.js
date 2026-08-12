import axios from 'axios';
import { useAuthStore } from '@/store/authStore.js';



// ─── Base URL ─────────────────────────────────────────────────────────────────
// In development the Vite dev server proxies /api → http://localhost:5000
// so we use a relative path and let the proxy do its job.
// In production we read VITE_API_BASE_URL from the environment.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api/v1' : 'https://capitalscale-backend.onrender.com/api/v1');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000,
  withCredentials: true, // Required for httpOnly refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});



// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach access token from the in-memory Zustand store to every request.
apiClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);



// ─── Response Interceptor — Silent Token Refresh ──────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Never attempt auto-refresh for:
    //  - Auth endpoints (login, register, mfa, refresh itself)
    //  - Requests that have already been retried once
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use the SAME base URL so this works in production.
        // The refresh token travels via the httpOnly cookie automatically.
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Clear auth state — the refresh cookie is gone or revoked
        useAuthStore.getState().clearAuth();
        // Redirect to the login portal picker
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
