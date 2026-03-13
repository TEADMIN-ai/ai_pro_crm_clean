"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type Activity = {
  id: string;
  type: string;
  message: string;
  from?: string | null;
  to?: string | null;
  performedByEmail?: string;
  createdAt?: string;
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
      const response = await authFetch(API_ROUTES.DEAL_ACTIVITY(dealId));
      if (!response.ok) {
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as { activity?: Activity[] };
      setActivity(Array.isArray(payload.activity) ? payload.activity : []);
      setLoading(false);
    };

    void loadActivity();
  }, [dealId]);

  if (loading) return <p style={{ fontSize: 12 }}>Loading activity...</p>;

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
            {a.from ?? "Unassigned"} to {a.to ?? "Unassigned"}
          </div>
          <div style={{ opacity: 0.6 }}>
            by {a.performedByEmail}
          </div>
        </li>
      ))}
    </ul>
  );
}
