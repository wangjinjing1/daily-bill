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

    if (error.code === "ERR_NETWORK") {
      return "鏃犳硶杩炴帴鏈嶅姟鍣紝璇锋鏌ユ帴鍙ｅ湴鍧€銆佸悗绔湇鍔″拰璇佷功閰嶇疆";
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

    if (nativeError.code === "ERR_NETWORK") {
      return "鏃犳硶杩炴帴鏈嶅姟鍣紝璇锋鏌ユ帴鍙ｅ湴鍧€銆佸悗绔湇鍔″拰璇佷功閰嶇疆";
    }

    if (nativeError.message) {
      return nativeError.message;
    }
  }

  return "鎿嶄綔澶辫触";
}
