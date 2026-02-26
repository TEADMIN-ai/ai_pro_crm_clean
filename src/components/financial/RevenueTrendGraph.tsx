"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Deal = {
  value?: unknown;
  createdAt?: unknown;
};

type RevenuePoint = {
  month: string;
  revenue: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RevenueTrendGraph() {
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
        setError("Unable to load trend data");
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, [router]);

  const data = useMemo<RevenuePoint[]>(() => {
    const monthTotals = new Map<number, number>();

    for (const deal of deals) {
      const parsedValue = Number(deal.value);
      const value = Number.isFinite(parsedValue) ? parsedValue : 0;
      const parsedDate = Number(deal.createdAt);
      const createdAt = Number.isFinite(parsedDate) ? parsedDate : Date.now();
      const date = new Date(createdAt);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      monthTotals.set(monthStart, (monthTotals.get(monthStart) ?? 0) + value);
    }

    return [...monthTotals.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([monthStart, revenue]) => ({
        month: new Date(monthStart).toLocaleString("en-US", { month: "short" }),
        revenue,
      }));
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
          Revenue Trend
        </p>
        {loading ? (
          <p style={{ margin: "8px 0 0", color: "#cae0ff" }}>Loading...</p>
        ) : error ? (
          <p style={{ margin: "8px 0 0", color: "#ffb6b6" }}>{error}</p>
        ) : (
          <div style={{ width: "100%", height: 260, marginTop: 10 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="rgba(170, 205, 255, 0.15)" />
                <XAxis dataKey="month" stroke="#d6e5ff" />
                <YAxis stroke="#d6e5ff" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#70d1ff"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
