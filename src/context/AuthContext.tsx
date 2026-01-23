"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export type AppRole = "admin" | "manager" | "staff" | null;

export type AuthContextType = {
  user: User | null;
  loading: boolean;

  /** Role is NOT part of Firebase User by default. */
  role: AppRole;

  /** Keep both names so older/newer code keeps compiling */
  login: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;

  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      // ✅ TEMP SAFE ROLE STRATEGY:
      // If you later store role in Firestore/claims, replace this logic here.
      const inferredRole =
        (firebaseUser as any)?.role ||
        (firebaseUser?.email?.includes("admin") ? "admin" : null);

      setRole((inferredRole as AppRole) ?? null);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // ✅ Alias so both `login()` and `signIn()` exist
  const signIn = login;

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextType>(
    () => ({ user, role, loading, login, signIn, logout }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Primary hook */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** ✅ Backwards-compatible alias (your components expect this name) */
export const useAuthContext = useAuth;