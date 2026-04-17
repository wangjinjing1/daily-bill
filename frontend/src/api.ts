import axios from "axios";

const tokenKey = "daily-bill-token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(tokenKey, token);
  } else {
    localStorage.removeItem(tokenKey);
  }
}

export function getToken() {
  return localStorage.getItem(tokenKey);
}

