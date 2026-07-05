"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on first mount.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api.me();
        if (!cancelled) setUser(user);
      } catch {
        // Token invalid/expired — clear it silently.
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user } = await api.login({ email, password });
    tokenStore.set(token);
    setUser(user);
  };

  const register = async (email: string, password: string, name: string) => {
    const { token, user } = await api.register({ email, password, name });
    tokenStore.set(token);
    setUser(user);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const updateProfile = async (data: { name?: string; email?: string }) => {
    const { user: updated } = await api.updateMe(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
