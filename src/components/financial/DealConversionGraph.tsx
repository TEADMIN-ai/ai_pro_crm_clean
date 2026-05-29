"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import MeasuredResponsiveContainer from "@/components/charts/MeasuredResponsiveContainer";
import { empireColors } from "@/theme/empireTheme";

type Deal = {
  status?: unknown;
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
        const res = await authFetch(API_ROUTES.DEALS);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("Session expired. Please login again.");
            router.push("/login");
            return;
          }
          throw new Error(`Failed to fetch deals: ${res.status}`);
        }
        const payload = (await res.json()) as unknown;
        const source = Array.isArray(payload)
          ? payload
          : typeof payload === "object" &&
            payload !== null &&
            Array.isArray((payload as { deals?: unknown[] }).deals)
          ? (payload as { deals: unknown[] }).deals
          : [];
        setDeals(source as Deal[]);
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
          <div className="relative mx-auto mt-[10px] flex h-[250px] min-h-[250px] min-w-0 w-full max-w-[420px] items-center justify-center overflow-hidden">
            <MeasuredResponsiveContainer minHeight={250}>
              <BarChart data={data}>
                <CartesianGrid stroke="rgba(30, 41, 59, 0.8)" strokeDasharray="3 3" />
                <XAxis dataKey="status" stroke={empireColors.textSecondary} />
                <YAxis allowDecimals={false} stroke={empireColors.textSecondary} />
                <Tooltip
                  contentStyle={{
                    background: empireColors.surface,
                    border: `1px solid ${empireColors.border}`,
                    color: empireColors.textPrimary,
                  }}
                />
                <Bar dataKey="count" fill={empireColors.primary} radius={[5, 5, 0, 0]} />
              </BarChart>
            </MeasuredResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
