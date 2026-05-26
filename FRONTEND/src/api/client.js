/**
 * src/api/client.js
 *
 * Axios instance that:
 *  - attaches the JWT access token to every request
 *  - silently refreshes the token on 401 and retries once
 *  - redirects to login if refresh also fails
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL:         `${BASE_URL}/api`,
  withCredentials: true,          // sends the HttpOnly refresh-token cookie
  headers:         { "Content-Type": "application/json" },
});

// -- Attach access token to every outgoing request ---------------------------
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// -- Auto-refresh on 401 ------------------------------------------------------
let _refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Don't attempt refresh if:
    // - Not a 401
    // - Already retried
    // - The failing request IS the refresh or logout endpoint
    // - There is no stored token at all (user is not logged in)
    const isAuthEndpoint = original.url?.includes("/auth/refresh") ||
                           original.url?.includes("/auth/logout");
    const hasToken = !!localStorage.getItem("access_token");

    if (
      err.response?.status !== 401 ||
      original._retry ||
      isAuthEndpoint ||
      !hasToken
    ) {
      return Promise.reject(err);
    }

    original._retry = true;

    // Deduplicate: if a refresh is already in-flight, wait for it
    if (!_refreshPromise) {
      _refreshPromise = axios
        .post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
        .then((r) => {
          localStorage.setItem("access_token", r.data.access_token);
          return r.data.access_token;
        })
        .catch((refreshErr) => {
          // Refresh failed - clear token and force re-login
          localStorage.removeItem("access_token");
          window.dispatchEvent(new Event("auth:logout"));
          return Promise.reject(refreshErr);
        })
        .finally(() => {
          _refreshPromise = null;
        });
    }

    try {
      const newToken = await _refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (e) {
      return Promise.reject(e);
    }
  }
);

export default api;
