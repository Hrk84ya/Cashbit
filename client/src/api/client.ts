import axios from 'axios';

/**
 * Shared mutable token store — kept in module scope (memory only, never persisted).
 * AuthContext writes here via setAccessToken; the interceptor reads from it.
 */
let accessToken: string | null = null;
let logoutCallback: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly refresh cookie
});

// Attach Bearer token on every request
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handle 401 → attempt refresh, retry once; SESSION_COMPROMISED → full logout
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Don't intercept auth endpoints themselves to avoid loops
    if (original?.url?.startsWith('/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      // SESSION_COMPROMISED → clear everything, redirect
      if (error.response.data?.code === 'SESSION_COMPROMISED') {
        accessToken = null;
        logoutCallback?.();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      original._retry = true;

      // Deduplicate concurrent refresh calls
      if (!refreshPromise) {
        refreshPromise = apiClient
          .post('/auth/refresh')
          .then((res) => {
            const newToken: string = res.data.data.accessToken;
            accessToken = newToken;
            return newToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        accessToken = null;
        logoutCallback?.();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
