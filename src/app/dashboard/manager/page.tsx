"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import RequireRole from "@/components/auth/RequireRole";
import { useAuth } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  reference?: string;
  clientName?: string;
  status: string;
  createdAt?: any;
};

const STATUSES = [
  { key: "all", label: "ALL" },
  { key: "draft", label: "DRAFT" },
  { key: "in_review", label: "IN REVIEW" },
  { key: "submitted", label: "SUBMITTED" },
  { key: "awarded", label: "AWARDED" },
  { key: "lost", label: "LOST" },
];

export default function ManagerDashboardPage() {
  const { user } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string>("all");

  useEffect(() => {
    if (!user) return;

    const fetchDeals = async () => {
      setLoading(true);

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

  const filteredDeals =
    activeStatus === "all"
      ? deals
      : deals.filter((d) => d.status === activeStatus);

  const statusCounts = deals.reduce<Record<string, number>>((acc, deal) => {
    acc[deal.status] = (acc[deal.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Manager Dashboard</h1>
        <h3 style={{ marginBottom: 20 }}>Deal status overview</h3>

        {/* STATUS CARDS */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {STATUSES.map((s) => (
            <div
              key={s.key}
              onClick={() => setActiveStatus(s.key)}
              style={{
                cursor: "pointer",
                padding: 16,
                minWidth: 120,
                border: "1px solid #ccc",
                textAlign: "center",
                background:
                  activeStatus === s.key ? "#f5f5f5" : "white",
                fontWeight: activeStatus === s.key ? "bold" : "normal",
              }}
            >
              <div>{s.label}</div>
              <div style={{ fontSize: 20 }}>
                {s.key === "all"
                  ? deals.length
                  : statusCounts[s.key] || 0}
              </div>
            </div>
          ))}
        </div>

        {/* DEAL LIST */}
        <h3 style={{ marginBottom: 12 }}>Deals</h3>

        {loading && <p>Loading deals…</p>}

        {!loading && filteredDeals.length === 0 && (
          <p>No deals for this status.</p>
        )}

        {!loading && filteredDeals.length > 0 && (
          <table
            border={1}
            cellPadding={8}
            style={{ borderCollapse: "collapse", width: "100%" }}
          >
            <thead>
              <tr>
                <th align="left">Title</th>
                <th align="left">Reference</th>
                <th align="left">Client</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.title}</td>
                  <td>{deal.reference || "-"}</td>
                  <td>{deal.clientName || "-"}</td>
                  <td>{deal.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </RequireRole>
  );
}