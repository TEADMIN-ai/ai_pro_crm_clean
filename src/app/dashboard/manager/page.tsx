"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import RequireRole from "@/components/auth/RequireRole";

type Deal = {
  id: string;
  title?: string;
  status?: string;
  createdAt?: any;
};

export default function ManagerDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snap = await getDocs(collection(db, "deals"));
        const data: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));
        setDeals(data);
      } catch (err) {
        console.error("Failed to load deals", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  const totalDeals = deals.length;

  const statusCounts = deals.reduce<Record<string, number>>((acc, deal) => {
    const status = deal.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <RequireRole role="manager">
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>
          Manager Overview
        </h1>

        {loading ? (
          <p>Loading deals…</p>
        ) : (
          <>
            {/* Summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              <div style={cardStyle}>
                <h3>Total Deals</h3>
                <strong style={countStyle}>{totalDeals}</strong>
              </div>

              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} style={cardStyle}>
                  <h3>{status}</h3>
                  <strong style={countStyle}>{count}</strong>
                </div>
              ))}
            </div>

            {/* Recent deals */}
            <h2 style={{ marginBottom: 12 }}>Recent Deals</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Title</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.slice(0, 10).map((deal) => (
                  <tr key={deal.id}>
                    <td style={td}>{deal.title || "Untitled"}</td>
                    <td style={td}>{deal.status || "unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </RequireRole>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#0b1a2a",
  padding: 16,
  borderRadius: 8,
};

const countStyle: React.CSSProperties = {
  fontSize: 24,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 8,
  borderBottom: "1px solid #333",
};

const td: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #222",
};