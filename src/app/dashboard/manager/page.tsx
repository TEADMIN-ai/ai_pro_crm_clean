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
import { resolveSLAForDeal, SLA } from "@/lib/slaRules";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  createdAt?: any;
  sla?: SLA | null;
};

type Activity = {
  id: string;
  type: string;
  from?: string | null;
  to?: string | null;
  actorUid?: string | null;
  createdAt?: any;
};

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<Record<string, Activity[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load users (UID → email)
  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data().email;
      });
      setUsers(map);
    });
  }, []);

  // Load deals
  useEffect(() => {
    const load = async () => {
      const q = query(
        collection(db, "deals"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setDeals(
        snap.docs.map((d) => {
          const data = d.data() as Deal;

          return {
            ...data,
            id: d.id, // ✅ ID LAST — FIXES ERROR
            sla: resolveSLAForDeal(data.status, data.createdAt),
          };
        })
      );

      setLoading(false);
    };

    load();
  }, []);

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
        ...d.data(),
        id: d.id, // ✅ SAFE
      })) as Activity[],
    }));
  };

  if (loading) {
    return <div style={{ padding: 32 }}>Loading manager dashboard…</div>;
  }

  return (
    <RequireRole allow={["admin", "manager"]}>
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
              Assigned to:{" "}
              {deal.assignedTo
                ? users[deal.assignedTo] ?? deal.assignedTo
                : "Unassigned"}
            </div>

            <div>
              SLA:{" "}
              <strong>
                {deal.sla?.label ?? "No SLA"}
              </strong>
            </div>

            <button
              style={{ marginTop: 8 }}
              onClick={() => {
                const next = expanded === deal.id ? null : deal.id;
                setExpanded(next);
                if (next) loadActivity(deal.id);
              }}
            >
              {expanded === deal.id ? "Hide activity" : "View activity"}
            </button>

            {expanded === deal.id && (
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
                        by{" "}
                        {a.actorUid
                          ? users[a.actorUid] || "System"
                          : "System"}
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
