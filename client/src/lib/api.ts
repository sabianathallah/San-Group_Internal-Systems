import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

// Handle 401 → try refresh → retry or redirect to /login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    const url = String(original?.url ?? '');
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/register') ||
      url.includes('/auth/logout');

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch(Promise.reject.bind(Promise));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post('/auth/refresh');
      const newToken = data.data.accessToken as string;
      localStorage.setItem('access_token', newToken);
      processQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Clear auth state completely — prevents AuthLayout from redirecting back to dashboard
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
