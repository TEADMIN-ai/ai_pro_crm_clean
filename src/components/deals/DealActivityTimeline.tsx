"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Activity = {
  id: string;
  type: string;
  message: string;
  from?: string | null;
  to?: string | null;
  performedByEmail?: string;
  createdAt?: any;
};

export default function DealActivityTimeline({
  dealId,
}: {
  dealId: string;
}) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      const q = query(
        collection(db, "deals", dealId, "activity"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      setActivity(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Activity, "id">),
        }))
      );
      setLoading(false);
    };

    loadActivity();
  }, [dealId]);

  if (loading) return <p style={{ fontSize: 12 }}>Loading activity…</p>;

  if (activity.length === 0) {
    return <p style={{ fontSize: 12 }}>No activity yet.</p>;
  }

  return (
    <ul style={{ marginTop: 8, paddingLeft: 16 }}>
      {activity.map((a) => (
        <li key={a.id} style={{ fontSize: 12, marginBottom: 6 }}>
          <div>
            <strong>{a.message}</strong>
          </div>
          <div style={{ opacity: 0.7 }}>
            {a.from ?? "Unassigned"} → {a.to ?? "Unassigned"}
          </div>
          <div style={{ opacity: 0.6 }}>
            by {a.performedByEmail}
          </div>
        </li>
      ))}
    </ul>
  );
}

