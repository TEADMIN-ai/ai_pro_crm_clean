"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type DealDetail = {
  id: string;
  title?: string;
  contractorId?: string;
  contractorName?: string;
  value?: number;
  status?: string;
  createdAt?: string | number | Date;
  readinessScore?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  missingRequirements?: string[];
};

type DealDetailResponse = {
  deal?: DealDetail;
};

function formatCurrency(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatCreatedDate(value?: string | number | Date) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 16, color: "#111827" }}>{value}</div>
    </div>
  );
}

export default function DealRecordClient({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      setError("Missing deal ID.");
      return;
    }

    let cancelled = false;

    async function loadDeal() {
      try {
        setLoading(true);
        setError(null);

        const response = await authFetch(API_ROUTES.DEAL_DETAIL(dealId), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Failed to load deal (${response.status})`);
        }

        const payload = (await response.json()) as DealDetailResponse;

        if (cancelled) {
          return;
        }

        if (!payload.deal) {
          setDeal(null);
          setError("Deal not found.");
          return;
        }

        setDeal(payload.deal);
      } catch (loadError) {
        if (!cancelled) {
          setDeal(null);
          setError(loadError instanceof Error ? loadError.message : "Failed to load deal.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDeal();

    return () => {
      cancelled = true;
    };
  }, [dealId]);

  if (loading) {
    return <div style={{ padding: 40 }}>Loading deal details...</div>;
  }

  if (error || !deal) {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Deal Details</h1>
        <p style={{ color: "#b91c1c", marginBottom: 16 }}>{error ?? "Deal not found."}</p>
        <Link href="/dashboard/deals" style={{ color: "#2563eb", fontWeight: 600 }}>
          Back to deals
        </Link>
      </div>
    );
  }

  const contractor = deal.contractorName || deal.contractorId || "-";
  const missingRequirements = Array.isArray(deal.missingRequirements) ? deal.missingRequirements : [];

  return (
    <div style={{ padding: 40, display: "grid", gap: 24 }}>
      <section>
        <h1 style={{ marginBottom: 8 }}>{deal.title || "Untitled deal"}</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>Deal ID: {deal.id}</p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <DetailRow label="Deal Title" value={deal.title || "Untitled deal"} />
        <DetailRow label="Contractor" value={contractor} />
        <DetailRow label="Value" value={formatCurrency(deal.value)} />
        <DetailRow label="Status" value={deal.status || "-"} />
        <DetailRow label="Created Date" value={formatCreatedDate(deal.createdAt)} />
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Tender Files</h2>
        <p style={{ marginTop: 0, marginBottom: 16, color: "#4b5563" }}>
          Upload tender PDFs and supporting documents for this deal.
        </p>
        <Link
          href={`/dashboard/deals/${encodeURIComponent(deal.id)}/upload`}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 10,
            background: "#2563eb",
            color: "#ffffff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Upload Tender Files
        </Link>
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>AI Analysis</h2>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <DetailRow
            label="Readiness Score"
            value={typeof deal.readinessScore === "number" ? `${deal.readinessScore}%` : "Pending"}
          />
          <DetailRow label="Risk Level" value={deal.riskLevel ?? "Pending"} />
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
              Missing Requirements
            </div>
            <div style={{ marginTop: 6, color: "#111827" }}>
              {missingRequirements.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {missingRequirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                "Pending"
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
