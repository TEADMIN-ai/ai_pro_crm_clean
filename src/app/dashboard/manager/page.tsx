"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import RequireRole from "@/components/auth/RequireRole";
import { useAuth } from "@/context/AuthContext";

/* ---------------- TYPES ---------------- */

type DealStatus = "draft" | "in_review" | "submitted" | "awarded" | "lost";

type Deal = {
  id: string;
  title: string;
  clientName?: string;
  status: DealStatus;
  value?: number;
  managerId?: string;
  updatedAt?: any;
};

/* ---------------- PAGE ---------------- */

export default function ManagerDashboardPage() {
  const { user } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<DealStatus | "all">("all");

  /* ---------------- FETCH DEALS ---------------- */

  useEffect(() => {
    if (!user?.uid) return;

    const fetchDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          where("managerId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const results: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));

        setDeals(results);
      } catch (err) {
        console.error("Failed to load manager deals", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [user]);

  /* ---------------- STATUS COUNTS ---------------- */

  const statusCounts: Record<DealStatus, number> = {
    draft: 0,
    in_review: 0,
    submitted: 0,
    awarded: 0,
    lost: 0,
  };

  deals.forEach((deal) => {
    statusCounts[deal.status]++;
  });

  /* ---------------- FILTERED DEALS ---------------- */

  const visibleDeals =
    activeStatus === "all"
      ? deals
      : deals.filter((deal) => deal.status === activeStatus);

  /* ---------------- UI ---------------- */

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 40 }}>
        <h1>Manager Dashboard</h1>

        <h3>Deal status overview</h3>

        {/* STATUS CARDS */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {(["all", "draft", "in_review", "submitted", "awarded", "lost"] as const).map(
            (status) => {
              const isActive = activeStatus === status;
              const label =
                status === "all"
                  ? "ALL"
                  : status.replace("_", " ").toUpperCase();

              const count =
                status === "all"
                  ? deals.length
                  : statusCounts[status];

              return (
                <div
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  style={{
                    cursor: "pointer",
                    border: isActive ? "2px solid #000" : "1px solid #ccc",
                    padding: 16,
                    minWidth: 120,
                    textAlign: "center",
                    background: isActive ? "#f5f5f5" : "#fff",
                  }}
                >
                  <strong>{label}</strong>
                  <div>{count}</div>
                </div>
              );
            }
          )}
        </div>

        {/* DEAL TABLE */}
        <h3>
          Deals {activeStatus !== "all" && `(${activeStatus.replace("_", " ")})`}
        </h3>

        {loading && <p>Loading deals…</p>}

        {!loading && visibleDeals.length === 0 && (
          <p>No deals for this status.</p>
        )}

        {!loading && visibleDeals.length > 0 && (
          <table border={1} cellPadding={8} style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Client</th>
                <th>Status</th>
                <th>Value</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.title}</td>
                  <td>{deal.clientName || "-"}</td>
                  <td>{deal.status}</td>
                  <td>{deal.value ?? "-"}</td>
                  <td>
                    {deal.updatedAt?.toDate
                      ? deal.updatedAt.toDate().toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </RequireRole>
  );
}