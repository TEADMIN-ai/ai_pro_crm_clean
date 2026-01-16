"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type AuthUser = {
  uid: string;
  email: string | null;
  role: "admin" | "manager" | "staff";
  companyId: string;
};

export type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      try {
        if (!fbUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const ref = doc(db, "users", fbUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // If user logged in but no Firestore profile exists
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            role: "staff",
            companyId: "default",
          });
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          role: (data.role ?? "staff") as AuthUser["role"],
          companyId: (data.companyId ?? "default") as string,
        });

        setLoading(false);
      } catch (e) {
        console.error("AuthProvider error:", e);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within <AuthProvider />");
  return ctx;
}

// ✅ Backwards-compatible alias so older imports don't break or revert types
export const useAuth = useAuthContext;