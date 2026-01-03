"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

type AuthContextType = {
  user: User | null;
  role: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        console.warn("No authenticated user");
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          console.warn("User doc missing — creating one");

          // 🔥 AUTO-CREATE USER DOC
          const defaultRole =
            firebaseUser.email === "ckaraniete.za@gmail.com"
              ? "admin"
              : "user";

          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: defaultRole,
            companyId: "torque-empire",
            createdAt: serverTimestamp(),
          });

          console.log("Firestore role:", defaultRole);
          setRole(defaultRole);
        } else {
          const data = snap.data();
          console.log("Firestore role:", data.role);
          setRole(data.role);
        }
      } catch (err) {
        console.error("Failed to load or create user role", err);
        setRole("user");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}