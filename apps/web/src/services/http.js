import axios from "axios";
import { clearAuthState, getAuthState, setAuthState } from "../store/authStore";
import { getStoredAuth } from "../utils/storage";
import { errorLogger } from "../utils/errorLogger";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshPromise = null;

function redirectToLogin() {
  clearAuthState();
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login?expired=true";
  }
}

async function tryRefreshToken() {
  const auth = getAuthState();
  const refreshToken = auth?.refreshToken;

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${import.meta.env.VITE_API_BASE_URL || "/api"}/auth/refresh`,
        { refreshToken },
        { timeout: 15000, headers: { "Content-Type": "application/json" } }
      )
      .then((response) => {
        const payload = response?.data?.data || response?.data;
        const accessToken = payload?.accessToken || "";
        const nextRefreshToken = payload?.refreshToken || refreshToken;
        const user = payload?.user || auth.user;

        if (!accessToken) {
          throw new Error("Refresh response is invalid");
        }

        setAuthState({
          accessToken,
          refreshToken: nextRefreshToken,
          user
        });

        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

httpClient.interceptors.request.use((config) => {
  const auth = getStoredAuth();

  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // 1. Refresh Token handling for 401 Unauthorized
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        const accessToken = await tryRefreshToken();

        if (!accessToken) {
          redirectToLogin();
          return Promise.reject(error);
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return httpClient(originalRequest);
      } catch (_refreshError) {
        redirectToLogin();
        return Promise.reject(error);
      }
    }

    // 2. Network Retry Logic for transient network errors, timeouts, or 5xx Gateway errors on safe GET requests
    const isNetworkOrTimeoutError = !error.response || [502, 503, 504].includes(status) || error.code === "ECONNABORTED" || error.code === "ERR_NETWORK";
    const isSafeMethod = ["get", "head", "options"].includes(String(originalRequest?.method || "get").toLowerCase());

    if (isNetworkOrTimeoutError && isSafeMethod && originalRequest && (originalRequest._retryCount || 0) < 2) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const backoffMs = originalRequest._retryCount * 800;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return httpClient(originalRequest);
    }

    if (!status || status >= 500) {
      errorLogger.captureError(error, {
        url: originalRequest?.url,
        method: originalRequest?.method,
        status: status || 0
      });
    }

    return Promise.reject(error);
  }
);
