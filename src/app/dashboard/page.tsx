"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

type UserDoc = {
  role: "admin" | "manager" | "staff";
};

export default function DashboardPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const redirectByRole = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        router.replace("/login");
        return;
      }

      const data = snap.data() as UserDoc;

      if (data.role === "admin") {
        router.replace("/dashboard/admin");
        return;
      }

      if (data.role === "manager") {
        router.replace("/dashboard/manager");
        return;
      }

      if (data.role === "staff") {
        router.replace("/dashboard/staff");
        return;
      }

      router.replace("/login");
    };

    redirectByRole();
  }, [user, loading, router]);

  return <div style={{ padding: 32 }}>Redirecting…</div>;
}