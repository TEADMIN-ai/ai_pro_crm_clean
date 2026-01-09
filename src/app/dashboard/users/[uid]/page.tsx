"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";

type UserProfile = {
  uid: string;
  email: string;
  role: string;
  companyId: string;
};

type Deal = {
  id: string;
  status: string;
};

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserAndDeals = async () => {
      try {
        // 🔹 Load user profile
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) {
          router.push("/dashboard");
          return;
        }

        const userData = userSnap.data() as UserProfile;
        setUser({ ...userData, uid });

        // 🔹 Load deals assigned to this user
        const dealsQuery = query(
          collection(db, "deals"),
          where("assignedTo", "==", uid)
        );

        const dealsSnap = await getDocs(dealsQuery);

        setDeals(
          dealsSnap.docs.map((d) => ({
            id: d.id,
            status: d.data().status,
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    loadUserAndDeals();
  }, [uid, router]);

  if (loading) {
    return <div style={{ padding: 32 }}>Loading user profile…</div>;
  }

  if (!user) {
    return null;
  }

  // 🔹 Workload calculations
  const totalDeals = deals.length;

  const statusCounts = deals.reduce<Record<string, number>>((acc, deal) => {
    acc[deal.status] = (acc[deal.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <button onClick={() => router.back()} style={{ marginBottom: 16 }}>
          ← Back
        </button>

        <h1>User Profile</h1>

        {/* 🔹 User details */}
        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 6,
            marginBottom: 24,
            maxWidth: 500,
          }}
        >
          <div>
            <strong>Email:</strong> {user.email}
          </div>
          <div>
            <strong>Role:</strong> {user.role}
          </div>
          <div>
            <strong>Company:</strong> {user.companyId}
          </div>
          <div>
            <strong>UID:</strong> {user.uid}
          </div>
        </div>

        {/* 🔹 Workload summary */}
        <h2>Workload Summary</h2>

        <div
          style={{
            border: "1px solid #eee",
            padding: 16,
            borderRadius: 6,
            maxWidth: 500,
          }}
        >
          <div>
            <strong>Total assigned deals:</strong> {totalDeals}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Status breakdown:</strong>
            <ul>
              {Object.entries(statusCounts).map(([status, count]) => (
                <li key={status}>
                  {status}: {count}
                </li>
              ))}
              {totalDeals === 0 && <li>No assigned deals</li>}
            </ul>
          </div>
        </div>
      </main>
    </RequireRole>
  );
}