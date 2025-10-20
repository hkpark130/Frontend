import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://chrome-ext.direa.synology.me";

let accessToken = null;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const setApiAccessToken = (token) => {
  accessToken = token;
};

export default axiosInstance;
