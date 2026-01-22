"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type AuthUser = {
  uid: string;
  email: string | null;
  role: "admin" | "manager" | "staff";
  companyId: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        setUser(null);
        setLoading(false);
        return;
      }

      const data = snap.data() as any;

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: data.role,
        companyId: data.companyId,
      });

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

// Canonical hook
export function useAuthContext() {
  return useContext(AuthContext);
}

// Back-compat (some files still import useAuth)
export function useAuth() {
  return useContext(AuthContext);
}