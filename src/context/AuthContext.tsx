"use client";

import {
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
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
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
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

        const data = snap.data();

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: data.role,
          companyId: data.companyId,
        });

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ SINGLE canonical hook
export function useAuthContext() {
  return useContext(AuthContext);
}