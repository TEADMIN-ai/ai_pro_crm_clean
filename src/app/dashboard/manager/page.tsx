"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";

type Deal = {
  title: string;
  status: string;
  assignedTo: string | null;
  createdAt?: any;
};

type DealWithId = Deal & { id: string };

type DealActivity = {
  type: string;
  from?: string | null;
  to?: string | null;
  by: string;
  createdAt?: any;
};

type DealActivityWithId = DealActivity & { id: string };

type UserMap = Record<string, string>;

const MAX_ACTIVE_DEALS = 3;

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<DealWithId[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Record<string, DealActivityWithId[]>>(
    {}
  );

  /* ------------------ LOAD DATA ------------------ */

  useEffect(() => {
    const loadData = async () => {
      const dealsSnap = await getDocs(
        query(collection(db, "deals"), orderBy("createdAt", "desc"))
      );

      setDeals(
        dealsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Deal),
        }))
      );

      const usersSnap = await getDocs(collection(db, "users"));
      const map: UserMap = {};
      usersSnap.forEach((u) => {
        map[u.id] = u.data().email;
      });
      setUsers(map);

      setLoading(false);
    };

    loadData();
  }, []);

  /* ------------------ LOAD ACTIVITY ------------------ */

  const loadActivity = async (dealId: string) => {
    if (activity[dealId]) return;

    const snap = await getDocs(
      query(
        collection(db, "deals", dealId, "activity"),
        orderBy("createdAt", "desc")
      )
    );

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

  /* ------------------ WORKLOAD MAP ------------------ */

  const workload: Record<string, number> = {};
  deals.forEach((deal) => {
    if (!deal.assignedTo) return;
    workload[deal.assignedTo] = (workload[deal.assignedTo] || 0) + 1;
  });

  /* ------------------ BADGE ------------------ */

  const workloadBadge = (uid: string | null) => {
    if (!uid) return { label: "Unassigned", color: "#999" };

    const count = workload[uid] || 0;

    if (count > MAX_ACTIVE_DEALS)
      return { label: "Overloaded", color: "#c0392b" };

    if (count === MAX_ACTIVE_DEALS)
      return { label: "High load", color: "#e67e22" };

    return { label: "Normal", color: "#27ae60" };
  };

  /* ------------------ AI-LITE SUGGESTION ------------------ */

  const suggestReassignment = (currentUid: string | null) => {
    if (!currentUid) return null;

    const currentLoad = workload[currentUid] || 0;
    if (currentLoad <= MAX_ACTIVE_DEALS) return null;

    const candidates = Object.keys(users)
      .filter((uid) => uid !== currentUid)
      .map((uid) => ({
        uid,
        load: workload[uid] || 0,
      }))
      .sort((a, b) => a.load - b.load);

    return candidates[0] || null;
  };

  /* ------------------ RENDER ------------------ */

  return (
    <RequireRole allow={["manager", "admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />
        <h1>Manager Dashboard</h1>

        {deals.map((deal) => {
          const badge = workloadBadge(deal.assignedTo);
          const suggestion = suggestReassignment(deal.assignedTo);

          return (
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
                Assigned to:{" "}
                {deal.assignedTo
                  ? users[deal.assignedTo] || deal.assignedTo
                  : "Unassigned"}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: badge.color,
                }}
              >
                ● {badge.label}
              </div>

              {suggestion && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#2980b9" }}>
                  💡 Suggested reassignment:{" "}
                  <strong>{users[suggestion.uid]}</strong> (
                  {suggestion.load} active deals)
                </div>
              )}

              <button
                style={{ marginTop: 10 }}
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
                      <div key={a.id} style={{ marginBottom: 8 }}>
                        <strong>{a.type}</strong>
                        {a.from !== undefined && (
                          <div>
                            {(a.from && users[a.from]) || "Unassigned"} →{" "}
                            {(a.to && users[a.to]) || "Unassigned"}
                          </div>
                        )}
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                          by {users[a.by] || "System"}
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
          );
        })}
      </main>
    </RequireRole>
  );
}