"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Deal = {
  status?: string;
};

type PipelineStatus = "draft" | "review" | "approved" | "submitted" | "rejected";

function normalizeStatus(status: unknown): PipelineStatus {
  if (status === "review" || status === "approved" || status === "submitted" || status === "rejected") {
    return status;
  }
  if (status === "awarded") {
    return "approved";
  }
  return "draft";
}

export default function DealConversionGraph() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeals() {
      try {
        const result = await authFetch(API_ROUTES.DEALS);
        if (!result.ok) {
          if (result.code === "AUTH") {
            setError("Session expired. Please login again.");
            router.push("/login");
            return;
          }
          throw new Error(result.message);
        }

        const { response: res } = result;

        if (!res.ok) {
          throw new Error("Failed to fetch deals");
        }

        const payload = (await res.json()) as { deals?: Deal[] };
        setDeals(Array.isArray(payload.deals) ? payload.deals : []);
      } catch (err) {
        console.error(err);
        setError("Unable to load conversion data");
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, [router]);

  const data = useMemo(() => {
    const counts: Record<PipelineStatus, number> = {
      draft: 0,
      review: 0,
      approved: 0,
      submitted: 0,
      rejected: 0,
    };

    for (const deal of deals) {
      counts[normalizeStatus(deal.status)] += 1;
    }

    return [
      { status: "Draft", count: counts.draft },
      { status: "Review", count: counts.review },
      { status: "Approved", count: counts.approved },
      { status: "Submitted", count: counts.submitted },
      { status: "Rejected", count: counts.rejected },
    ];
  }, [deals]);

  return (
    <Card>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(109, 182, 255, 0.26)",
          background:
            "linear-gradient(160deg, rgba(11, 26, 46, 0.95), rgba(13, 30, 55, 0.9))",
          boxShadow:
            "0 16px 38px rgba(74, 145, 255, 0.2), inset 0 0 22px rgba(92, 175, 255, 0.07)",
          padding: 14,
          fontFamily: "\"Segoe UI\", system-ui, sans-serif",
          color: "#e7f0ff",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>
          Deal Conversion Efficiency
        </p>
        {loading ? (
          <p style={{ margin: "8px 0 0", color: "#cae0ff" }}>Loading...</p>
        ) : error ? (
          <p style={{ margin: "8px 0 0", color: "#ffb6b6" }}>{error}</p>
        ) : (
          <div style={{ width: "100%", height: 250, marginTop: 10 }}>
            <ResponsiveContainer>
              <BarChart data={data}>
                <XAxis dataKey="status" stroke="#d6e5ff" />
                <YAxis allowDecimals={false} stroke="#d6e5ff" />
                <Tooltip />
                <Bar dataKey="count" fill="#53a8ff" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
