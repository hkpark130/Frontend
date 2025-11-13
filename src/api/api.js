import axios from "axios";
import { OIDC_STORAGE_KEY } from "@/auth/oidcConfig";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const API_AUTH_ERROR_EVENT = "api-auth-error";

const readStoredAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage;
  if (!storage) {
    return null;
  }

  try {
    const serializedUser = storage.getItem(OIDC_STORAGE_KEY);
    if (!serializedUser) {
      return null;
    }

    const parsed = JSON.parse(serializedUser);
    const token = parsed?.access_token;
    const expiresAt = parsed?.expires_at;
    if (expiresAt) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (Number.isFinite(Number(expiresAt)) && Number(expiresAt) <= nowSec) {
        try {
          storage.removeItem(OIDC_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return null;
      }
    }

    if (token && token.trim().length > 0) {
      return token;
    }
  } catch (error) {
    console.warn("Failed to parse stored OIDC user for access token.", error);
  }

  return null;
};

let accessToken = readStoredAccessToken();

const emitAuthError = (status, sourceUrl) => {
  if (typeof window === "undefined") {
    return;
  }
  const detail = { status, sourceUrl };
  const event = new CustomEvent(API_AUTH_ERROR_EVENT, { detail });
  window.dispatchEvent(event);
};

// Create axios instance without credentials by default.
// We'll enable credentials and Authorization header only when we have an access token.
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

axiosInstance.interceptors.request.use(
  (config) => {
    // If an access token exists, send it and allow cookies (credentials).
    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
      config.withCredentials = true;
    } else {
      // Ensure we do not send cookies when there's no token
      config.withCredentials = false;
      if (config.headers) {
        delete config.headers.Authorization;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      if (status === 401) {
        accessToken = null;
      }
      const sourceUrl = error?.config?.url;
      emitAuthError(status, sourceUrl);
    }
    return Promise.reject(error);
  },
);

export const setApiAccessToken = (token) => {
  accessToken = token;
};

export default axiosInstance;
