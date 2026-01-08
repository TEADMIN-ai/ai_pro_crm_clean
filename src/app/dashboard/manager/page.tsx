"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  createdAt?: any;
};

type DealActivity = {
  id: string;
  type: string;
  from?: string | null;
  to?: string | null;
  by: string;
  createdAt?: any;
};

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Record<string, DealActivity[]>>({});

  // 🔹 Load manager deals
  useEffect(() => {
    const loadDeals = async () => {
      const q = query(
        collection(db, "deals"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Deal),
        }))
      );
      setLoading(false);
    };

    loadDeals();
  }, []);

  // 🔹 Load activity for a deal (only when expanded)
  const loadActivity = async (dealId: string) => {
    if (activity[dealId]) return;

    const q = query(
      collection(db, "deals", dealId, "activity"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    setActivity((prev) => ({
      ...prev,
      [dealId]: snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DealActivity),
      })),
    }));
  };

  if (loading) {
    return <div style={{ padding: 32 }}>Loading manager dashboard…</div>;
  }

  return (
    <RequireRole allow={["manager", "admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1>Manager Dashboard</h1>

        {deals.map((deal) => (
          <div
            key={deal.id}
            style={{
              border: "1px solid #ddd",
              padding: 16,
              marginBottom: 16,
              borderRadius: 6,
            }}
          >
            <strong>{deal.title}</strong>
            <div>Status: {deal.status}</div>
            <div>
              Assigned to: {deal.assignedTo || "Unassigned"}
            </div>

            {/* 🔽 Toggle activity */}
            <button
              style={{ marginTop: 8 }}
              onClick={() => {
                const next =
                  expandedDealId === deal.id ? null : deal.id;
                setExpandedDealId(next);
                if (next) loadActivity(deal.id);
              }}
            >
              {expandedDealId === deal.id
                ? "Hide activity"
                : "View activity"}
            </button>

            {/* 🔹 Activity timeline */}
            {expandedDealId === deal.id && (
              <div
                style={{
                  marginTop: 12,
                  paddingLeft: 12,
                  borderLeft: "3px solid #eee",
                }}
              >
                {activity[deal.id]?.length ? (
                  activity[deal.id].map((a) => (
                    <div
                      key={a.id}
                      style={{
                        fontSize: 14,
                        marginBottom: 8,
                        opacity: 0.9,
                      }}
                    >
                      <div>
                        <strong>{a.type}</strong>
                      </div>
                      {a.from !== undefined && (
                        <div>
                          {a.from || "Unassigned"} →{" "}
                          {a.to || "Unassigned"}
                        </div>
                      )}
                      <div style={{ fontSize: 12, opacity: 0.6 }}>
                        by {a.by}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ opacity: 0.6 }}>
                    No activity recorded.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </main>
    </RequireRole>
  );
}