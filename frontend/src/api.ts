import axios from "axios";
import { CapacitorHttp, type HttpOptions, type HttpResponseType } from "@capacitor/core";
import { isNativeApp } from "./native";

const tokenKey = "daily-bill-token";
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

type ApiRequestConfig = {
  params?: Record<string, string | number | undefined>;
  responseType?: "blob";
};

type ApiResponse<T> = {
  data: T;
  status?: number;
  headers?: Record<string, string>;
};

type ApiErrorShape = Error & {
  code?: string;
  response?: {
    status?: number;
    data?: unknown;
  };
};

const NETWORK_ERROR_MESSAGE =
  "\u65e0\u6cd5\u8fde\u63a5\u5230\u670d\u52a1\u5668\uff0c\u8bf7\u786e\u8ba4\u540e\u7aef\u670d\u52a1\u5df2\u542f\u52a8\u5e76\u91cd\u8bd5";
const UNKNOWN_ERROR_MESSAGE = "\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";

function buildHeaders() {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem(tokenKey);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function normalizeHeaders(headers: Record<string, unknown> | undefined) {
  if (!headers) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (/^https?:\/\//i.test(baseURL)) {
    return new URL(path.replace(/^\//, ""), `${baseURL.replace(/\/+$/, "")}/`).toString();
  }

  return path;
}

function decodeBase64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function toNativeError(error: unknown): ApiErrorShape {
  if (error instanceof Error) {
    const nativeError = error as ApiErrorShape;
    if (!nativeError.code) {
      nativeError.code = "ERR_NETWORK";
    }
    return nativeError;
  }

  const nativeError = new Error("Network Error") as ApiErrorShape;
  nativeError.code = "ERR_NETWORK";
  return nativeError;
}

function createHttpError(status: number, data: unknown) {
  const error = new Error(`Request failed with status code ${status}`) as ApiErrorShape;
  error.response = { status, data };
  return error;
}

async function nativeRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  data?: unknown,
  config?: ApiRequestConfig
): Promise<ApiResponse<T>> {
  const responseType: HttpResponseType = config?.responseType === "blob" ? "blob" : "json";
  const options: HttpOptions = {
    url: buildUrl(path),
    method,
    headers: buildHeaders(),
    params: config?.params
      ? Object.fromEntries(
          Object.entries(config.params)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)])
        )
      : undefined,
    responseType
  };

  if (data !== undefined) {
    options.data = data;
    options.headers = {
      ...options.headers,
      "Content-Type": "application/json"
    };
  }

  try {
    const response = await CapacitorHttp.request(options);
    if (response.status >= 400) {
      throw createHttpError(response.status, response.data);
    }

    if (config?.responseType === "blob") {
      const mimeType = response.headers["content-type"] || "application/octet-stream";
      return {
        data: decodeBase64ToBlob(String(response.data), mimeType) as T,
        status: response.status,
        headers: response.headers
      };
    }

    return {
      data: response.data as T,
      status: response.status,
      headers: normalizeHeaders(response.headers)
    };
  } catch (error) {
    throw toNativeError(error);
  }
}

const webApi = axios.create({ baseURL });

webApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  get<T>(path: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    if (isNativeApp()) {
      return nativeRequest<T>("GET", path, undefined, config);
    }
    return webApi.get<T>(path, config).then((response) => ({
      data: response.data,
      status: response.status,
      headers: normalizeHeaders(response.headers as Record<string, unknown>)
    }));
  },
  post<T>(path: string, data?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    if (isNativeApp()) {
      return nativeRequest<T>("POST", path, data, config);
    }
    return webApi.post<T>(path, data, config).then((response) => ({
      data: response.data,
      status: response.status,
      headers: normalizeHeaders(response.headers as Record<string, unknown>)
    }));
  },
  put<T>(path: string, data?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    if (isNativeApp()) {
      return nativeRequest<T>("PUT", path, data, config);
    }
    return webApi.put<T>(path, data, config).then((response) => ({
      data: response.data,
      status: response.status,
      headers: normalizeHeaders(response.headers as Record<string, unknown>)
    }));
  },
  delete<T>(path: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    if (isNativeApp()) {
      return nativeRequest<T>("DELETE", path, undefined, config);
    }
    return webApi.delete<T>(path, config).then((response) => ({
      data: response.data,
      status: response.status,
      headers: normalizeHeaders(response.headers as Record<string, unknown>)
    }));
  }
};

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

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      return NETWORK_ERROR_MESSAGE;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    const nativeError = error as ApiErrorShape;
    const responseMessage = (nativeError.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (nativeError.code === "ERR_NETWORK" || nativeError.message === "Network Error") {
      return NETWORK_ERROR_MESSAGE;
    }

    if (nativeError.message) {
      return nativeError.message;
    }
  }

  return UNKNOWN_ERROR_MESSAGE;
}
