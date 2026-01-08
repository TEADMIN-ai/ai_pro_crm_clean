"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
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
  companyId: string;
  createdAt?: any;
  updatedAt?: any;
};

type Activity = {
  id: string;
  type: string;
  actorUid?: string;
  from?: string | null;
  to?: string | null;
  createdAt?: any;
};

type UserMap = Record<string, string>; // uid -> email

export default function DealDetailsPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const router = useRouter();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [users, setUsers] = useState<UserMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // 🔹 Load users
      const usersSnap = await getDocs(collection(db, "users"));
      const map: UserMap = {};
      usersSnap.forEach((u) => {
        const data = u.data();
        if (data.email) {
          map[u.id] = data.email;
        }
      });
      setUsers(map);

      // 🔹 Load deal
      const dealRef = doc(db, "deals", dealId);
      const dealSnap = await getDoc(dealRef);

      if (!dealSnap.exists()) {
        router.push("/dashboard/manager");
        return;
      }

      setDeal(dealSnap.data() as Deal);

      // 🔹 Load activity
      const activityQuery = query(
        collection(db, "deals", dealId, "activity"),
        orderBy("createdAt", "desc")
      );

      const activitySnap = await getDocs(activityQuery);
      setActivity(
        activitySnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Activity),
        }))
      );

      setLoading(false);
    };

    loadData();
  }, [dealId, router]);

  if (loading || !deal) {
    return <div style={{ padding: 32 }}>Loading deal…</div>;
  }

  const assignedLabel =
    deal.assignedTo && users[deal.assignedTo]
      ? users[deal.assignedTo]
      : "Unassigned";

  return (
    <RequireRole allow={["manager", "admin"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <button onClick={() => router.back()} style={{ marginBottom: 16 }}>
          ← Back
        </button>

        <h1>Deal Details</h1>

        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 6,
            marginBottom: 24,
          }}
        >
          <h2>{deal.title}</h2>
          <div>Status: {deal.status}</div>
          <div>Assigned to: {assignedLabel}</div>
          <div>Company: {deal.companyId}</div>
          <div>
            Created:{" "}
            {deal.createdAt?.toDate
              ? deal.createdAt.toDate().toLocaleString()
              : "—"}
          </div>
          <div>
            Updated:{" "}
            {deal.updatedAt?.toDate
              ? deal.updatedAt.toDate().toLocaleString()
              : "—"}
          </div>
        </div>

        <h2>Activity Timeline</h2>

        {activity.length === 0 && (
          <div style={{ opacity: 0.6 }}>No activity recorded.</div>
        )}

        {activity.map((a, index) => {
          const actor =
            a.actorUid && users[a.actorUid]
              ? users[a.actorUid]
              : "Unknown";

          return (
            <div
              key={a.id}
              style={{
                padding: 12,
                borderLeft: "3px solid #eee",
                marginBottom: 12,
              }}
            >
              <strong>
                {index + 1}. {a.type}
              </strong>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {a.from !== undefined && (
                  <div>
                    {a.from || "Unassigned"} → {a.to || "Unassigned"}
                  </div>
                )}
                <div>by {actor}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {a.createdAt?.toDate
                    ? a.createdAt.toDate().toLocaleString()
                    : ""}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </RequireRole>
  );
}