import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import { User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type TokenPayload = {
  userId?: number;
  username?: string;
  role?: User["role"];
};

function getResponseStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status === "number"
  ) {
    return (error as { response: { status: number } }).response.status;
  }
  return undefined;
}

function getUserFromStoredToken(): User | null {
  const token = getToken();
  const payloadPart = token?.split(".")[1];
  if (!payloadPart) {
    return null;
  }

  try {
    const normalizedPayload = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(paddedPayload)) as TokenPayload;
    if (!payload.userId || !payload.username || (payload.role !== "SUPER_ADMIN" && payload.role !== "USER")) {
      return null;
    }
    return {
      id: payload.userId,
      username: payload.username,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get<User>("/me");
      setUser(response.data);
    } catch (error: unknown) {
      const status = getResponseStatus(error);
      if (status === 401 || status === 403) {
        setToken(null);
        setUser(null);
      } else {
        setUser((currentUser) => currentUser ?? getUserFromStoredToken());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>("/auth/login", { username, password });
    setToken(response.data.token);
    setUser(response.data.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

