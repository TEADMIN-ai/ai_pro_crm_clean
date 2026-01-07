"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import RequireRole from "@/components/auth/RequireRole";

type DealStatus =
  | "draft"
  | "in_review"
  | "submitted"
  | "awarded"
  | "lost";

type Deal = {
  id: string;
  title: string;
  reference?: string;
  clientName?: string;
  status: DealStatus;
  createdAt?: any;
};

const STATUSES: { label: string; value: DealStatus | "all" }[] = [
  { label: "ALL", value: "all" },
  { label: "DRAFT", value: "draft" },
  { label: "IN REVIEW", value: "in_review" },
  { label: "SUBMITTED", value: "submitted" },
  { label: "AWARDED", value: "awarded" },
  { label: "LOST", value: "lost" },
];

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DealStatus | "all">("all");

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        const results: Deal[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));

        setDeals(results);
      } catch (err) {
        console.error("Failed to load deals", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  const filteredDeals =
    statusFilter === "all"
      ? deals
      : deals.filter((d) => d.status === statusFilter);

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 40 }}>
        <h1>Deals</h1>

        {/* Status Filter */}
        <div style={{ marginBottom: 20 }}>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              style={{
                marginRight: 8,
                padding: "6px 12px",
                border:
                  statusFilter === s.value
                    ? "2px solid black"
                    : "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
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
                <th>Title</th>
                <th>Reference</th>
                <th>Client</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => (
                <tr key={deal.id}>
                  <td>{deal.title}</td>
                  <td>{deal.reference ?? "-"}</td>
                  <td>{deal.clientName ?? "-"}</td>
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