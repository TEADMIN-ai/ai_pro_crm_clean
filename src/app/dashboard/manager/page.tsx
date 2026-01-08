"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import { logDealActivity } from "@/lib/dealActivity";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string | null;
};

type UserOption = {
  uid: string;
  email: string;
};

export default function ManagerDashboardPage() {
  const { user, loading } = useAuthContext();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  // 🔹 Load company deals
  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        where("companyId", "==", user.companyId),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }))
      );

      setLoadingDeals(false);
    };

    loadDeals();
  }, [user]);

  // 🔹 Load company users (admin + manager + staff)
  useEffect(() => {
    if (!user) return;

    const loadUsers = async () => {
      const q = query(
        collection(db, "users"),
        where("companyId", "==", user.companyId)
      );

      const snap = await getDocs(q);
      setUsers(
        snap.docs.map((d) => ({
          uid: d.id,
          email: d.data().email,
        }))
      );
    };

    loadUsers();
  }, [user]);

  // 🔹 Assignment handler + activity logging
  const handleAssign = async (
    dealId: string,
    previousAssignedTo: string | null,
    newAssignedTo: string | null
  ) => {
    if (!user) return;

    await updateDoc(doc(db, "deals", dealId), {
      assignedTo: newAssignedTo,
    });

    await logDealActivity({
      dealId,
      type: "assignment_change",
      message: newAssignedTo ? "Deal assigned" : "Deal unassigned",
      from: previousAssignedTo,
      to: newAssignedTo,
      performedBy: user.uid,
      performedByEmail: user.email ?? "unknown",
    });

    // 🔹 Update local state (no reload)
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, assignedTo: newAssignedTo } : d
      )
    );
  };

  if (loading || loadingDeals) {
    return <div>Loading...</div>;
  }

  return (
    <RequireRole allow={["manager", "admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Manager Dashboard</h1>
        <p>Company pipeline overview</p>

        {deals.length === 0 && <p>No deals found.</p>}

        <ul>
          {deals.map((deal) => (
            <li key={deal.id} style={{ marginBottom: 16 }}>
              <strong>{deal.title}</strong>
              <div>Status: {deal.status}</div>

              <label>
                Assign to:{" "}
                <select
                  value={deal.assignedTo ?? ""}
                  onChange={(e) =>
                    handleAssign(
                      deal.id,
                      deal.assignedTo ?? null,
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
      </main>
    </RequireRole>
  );
}