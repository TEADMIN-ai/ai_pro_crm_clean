"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { API_ROUTES } from "@/lib/routes";
import { authFetch } from "@/lib/client/authFetch";

type Deal = {
  value?: unknown;
  status?: unknown;
};

type ContractorPayload = {
  contractors?: unknown[];
};

type DealsPayload = {
  deals?: Deal[];
};

async function generateExecutiveSummary() {
  return "Torque Empire is operating at high efficiency with strong compliance and revenue growth trajectory.";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function isCompliantStatus(status: string | undefined): boolean {
  return status === "approved" || status === "submitted" || status === "awarded";
}

function toSafeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function ExecutiveSummaryPanel() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contractorCount, setContractorCount] = useState(0);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExecutiveData() {
      try {
        const dealsPromise = authFetch(API_ROUTES.DEALS).then(async (result) => {
          if (!result.ok) {
            if (result.status === 401 || result.status === 403) {
              throw new Error("AUTH");
            }
            throw new Error(`Failed to fetch deals: ${result.status}`);
          }
          const payload = (await result.json()) as unknown;
          const deals = Array.isArray(payload)
            ? payload
            : typeof payload === "object" &&
              payload !== null &&
              Array.isArray((payload as DealsPayload).deals)
            ? (payload as DealsPayload).deals
            : [];
          return Array.isArray(deals) ? (deals as Deal[]) : [];
        });

        const contractorsPromise = authFetch(API_ROUTES.CONTRACTORS).then(async (result) => {
          if (!result.ok) {
            if (result.status === 401 || result.status === 403) {
              throw new Error("AUTH");
            }
            throw new Error(`Failed to fetch contractors: ${result.status}`);
          }

          const payload = (await result.json()) as unknown;
          const contractors = Array.isArray(payload)
            ? payload
            : typeof payload === "object" &&
              payload !== null &&
              Array.isArray((payload as ContractorPayload).contractors)
            ? (payload as ContractorPayload).contractors
            : [];
          return Array.isArray(contractors) ? contractors.length : 0;
        });

        const summaryPromise = generateExecutiveSummary();

        const [resolvedDeals, resolvedContractors, resolvedSummary] = await Promise.all([
          dealsPromise,
          contractorsPromise,
          summaryPromise,
        ]);

        setDeals(resolvedDeals);
        setContractorCount(resolvedContractors);
        setSummary(resolvedSummary);
      } catch (err) {
        console.error(err);
        if (err instanceof Error && err.message === "AUTH") {
          setError("Session expired. Please login again.");
          router.push("/login");
          return;
        }
        setError("Unable to load executive summary");
      } finally {
        setLoading(false);
      }
    }

    loadExecutiveData();
  }, [router]);

  const metrics = useMemo(() => {
    const totalDeals = deals.length;
    const totalRevenue = deals.reduce((sum, deal) => {
      const value = toSafeNumber(deal.value);
      const status = typeof deal.status === "string" ? deal.status : "";
      return status !== "draft" ? sum + value : sum;
    }, 0);
    const projectedProfit = totalRevenue * 0.35;

    const compliantDeals = deals.filter((deal) =>
      isCompliantStatus(typeof deal.status === "string" ? deal.status : undefined)
    ).length;
    const compliance = totalDeals > 0 ? (compliantDeals / totalDeals) * 100 : 0;

    return {
      totalDeals,
      totalRevenue,
      projectedProfit,
      compliance,
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
          Executive Summary
        </p>
        {loading ? (
          <p style={{ margin: "8px 0 0", color: "#cae0ff" }}>Loading...</p>
        ) : error ? (
          <p style={{ margin: "8px 0 0", color: "#ffb6b6" }}>{error}</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gap: 10,
                marginTop: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <div>
                <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Total Contractors</p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
                  {contractorCount}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Total Deals</p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
                  {metrics.totalDeals}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Total Revenue</p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Projected Profit</p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
                  {formatCurrency(metrics.projectedProfit)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "#b7ceef", fontSize: 12 }}>Compliance %</p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
                  {metrics.compliance.toFixed(1)}%
                </p>
              </div>
            </div>
            <p style={{ margin: "12px 0 0", color: "#cae0ff", fontSize: 13 }}>{summary}</p>
          </>
        )}
      </div>
    </Card>
  );
}
