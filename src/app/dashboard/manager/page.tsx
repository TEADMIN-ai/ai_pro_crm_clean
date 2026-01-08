"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuthContext } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string | null;
  companyId: string;
};

type User = {
  uid: string;
  email: string;
};

export default function ManagerPage() {
  const { user } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Load deals
        const dealsQuery = query(
          collection(db, "deals"),
          where("companyId", "==", user.companyId)
        );
        const dealsSnap = await getDocs(dealsQuery);

        const dealsData: Deal[] = dealsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }));

        setDeals(dealsData);

        // Load users
        const usersQuery = query(
          collection(db, "users"),
          where("companyId", "==", user.companyId)
        );
        const usersSnap = await getDocs(usersQuery);

        const usersData: User[] = usersSnap.docs.map((u) => ({
          uid: u.id,
          email: u.data().email,
        }));

        setUsers(usersData);
      } catch (err) {
        console.error("Manager dashboard load error:", err);
      } finally {
        // 🔑 THIS IS THE CRITICAL FIX
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleAssign = async (dealId: string, uid: string | null) => {
    try {
      await updateDoc(doc(db, "deals", dealId), {
        assignedTo: uid,
      });
    } catch (err) {
      console.error("Assignment failed:", err);
      alert("Failed to assign deal");
    }
  };

  if (loading) {
    return <p style={{ padding: 32 }}>Loading...</p>;
  }

  return (
    <RequireRole allow={["manager"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Manager Dashboard</h1>
        <p>Company pipeline overview</p>

        {deals.length === 0 ? (
          <p>No deals found.</p>
        ) : (
          <ul>
            {deals.map((deal) => (
              <li key={deal.id} style={{ marginBottom: 12 }}>
                <strong>{deal.title}</strong>
                <div>Status: {deal.status}</div>

                <label>
                  Assign to:{" "}
                  <select
                    value={deal.assignedTo ?? ""}
                    onChange={(e) =>
                      handleAssign(
                        deal.id,
                        e.target.value || null
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </main>
    </RequireRole>
  );
}