"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { API_ROUTES } from "@/lib/routes";

type Deal = {
  value?: number;
  status?: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProfitProjectionPanel() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeals() {
      try {
        const res = await fetch(API_ROUTES.DEALS);
        if (!res.ok) {
          throw new Error("Failed to fetch deals");
        }

        const payload = (await res.json()) as { deals?: Deal[] };
        setDeals(Array.isArray(payload.deals) ? payload.deals : []);
      } catch (err) {
        console.error(err);
        setError("Unable to load projection data");
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, []);

  const { totalRevenue, projectedProfit } = useMemo(() => {
    const revenue = deals.reduce((sum, deal) => {
      const value = typeof deal.value === "number" ? deal.value : 0;
      return deal.status !== "draft" ? sum + value : sum;
    }, 0);

    return {
      totalRevenue: revenue,
      projectedProfit: revenue * 0.35,
    };
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
          Profit Projection
        </p>
        {loading ? (
          <p style={{ margin: "8px 0 0", color: "#cae0ff" }}>Loading...</p>
        ) : error ? (
          <p style={{ margin: "8px 0 0", color: "#ffb6b6" }}>{error}</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <div>
              <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Projected Profit</p>
              <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>
                {formatCurrency(projectedProfit)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Expected Revenue</p>
              <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Estimated Margin</p>
              <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>35%</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
