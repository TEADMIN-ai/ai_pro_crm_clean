"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { calculatePortfolioIntelligence } from "@/lib/intelligence/portfolioIntelligenceEngine";
import { API_ROUTES } from "@/lib/routes";
import { empireColors } from "@/theme/empireTheme";
import type { Deal } from "@/types/deal";

type DealPayload = {
  deals?: unknown[];
};

type DistributionPoint = {
  band: string;
  count: number;
};

type DealMetricSnapshot = {
  winProbability?: unknown;
  riskScore?: unknown;
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parseDeals(payload: unknown): Deal[] {
  const deals = Array.isArray(payload)
    ? payload
    : typeof payload === "object" &&
      payload !== null &&
      Array.isArray((payload as DealPayload).deals)
    ? (payload as DealPayload).deals
    : [];
  return deals as Deal[];
}

function asMetricSnapshot(deal: Deal): DealMetricSnapshot {
  return deal as Deal & DealMetricSnapshot;
}

function buildWpiDistribution(deals: Deal[]): DistributionPoint[] {
  const bands: DistributionPoint[] = [
    { band: "0-39", count: 0 },
    { band: "40-59", count: 0 },
    { band: "60-79", count: 0 },
    { band: "80-100", count: 0 },
  ];

  for (const deal of deals) {
    const snapshot = asMetricSnapshot(deal);
    const score = clampPercent(toSafeNumber(snapshot.winProbability));

    if (score < 40) {
      bands[0].count += 1;
    } else if (score < 60) {
      bands[1].count += 1;
    } else if (score < 80) {
      bands[2].count += 1;
    } else {
      bands[3].count += 1;
    }
  }

  return bands;
}

function buildRiskDistribution(deals: Deal[]): DistributionPoint[] {
  const bands: DistributionPoint[] = [
    { band: "0-29", count: 0 },
    { band: "30-59", count: 0 },
    { band: "60-79", count: 0 },
    { band: "80-100", count: 0 },
  ];

  for (const deal of deals) {
    const snapshot = asMetricSnapshot(deal);
    const score = clampPercent(toSafeNumber(snapshot.riskScore));

    if (score < 30) {
      bands[0].count += 1;
    } else if (score < 60) {
      bands[1].count += 1;
    } else if (score < 80) {
      bands[2].count += 1;
    } else {
      bands[3].count += 1;
    }
  }

  return bands;
}

type MetricCardProps = {
  label: string;
  value: string;
  tone?: "info" | "success" | "warning" | "danger";
};

function MetricCard({ label, value, tone = "info" }: MetricCardProps) {
  return (
    <Card>
      <p className="enterprise-metric-label">{label}</p>
      <h2 className="enterprise-metric-value">{value}</h2>
      <div style={{ marginTop: 8 }}>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </Card>
  );
}

function RadialMetric({
  label,
  value,
  glowColor,
}: {
  label: string;
  value: number;
  glowColor: string;
}) {
  const clamped = clampPercent(value);
  const progress = `${clamped}%`;

  return (
    <Card>
      <p className="enterprise-metric-label">{label}</p>
      <div
        style={{
          marginTop: 10,
          width: 132,
          height: 132,
          borderRadius: "50%",
          background: `conic-gradient(${glowColor} ${progress}, rgba(30,41,59,0.85) ${progress})`,
          display: "grid",
          placeItems: "center",
          boxShadow: `0 0 16px ${glowColor}66`,
        }}
      >
        <div
          style={{
            width: 94,
            height: 94,
            borderRadius: "50%",
            background: empireColors.background,
            border: `1px solid ${empireColors.border}`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 800, color: empireColors.textPrimary }}>
            {clamped.toFixed(1)}%
          </span>
        </div>
      </div>
    </Card>
  );
}

function DistributionChart({
  title,
  data,
  barColor,
}: {
  title: string;
  data: DistributionPoint[];
  barColor: string;
}) {
  return (
    <Card>
      <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>{title}</p>
      <div style={{ width: "100%", height: 260, marginTop: 10 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(30, 41, 59, 0.8)" strokeDasharray="3 3" />
            <XAxis dataKey="band" stroke={empireColors.textSecondary} />
            <YAxis allowDecimals={false} stroke={empireColors.textSecondary} />
            <Tooltip
              contentStyle={{
                background: empireColors.surface,
                border: `1px solid ${empireColors.border}`,
                color: empireColors.textPrimary,
              }}
            />
            <Bar dataKey="count" fill={barColor} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function ExecutiveDashboard() {
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
        setDeals(parseDeals(payload));
      } catch (err) {
        console.error(err);
        setError("Unable to load executive portfolio data");
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, [router]);

  const portfolio = useMemo(() => calculatePortfolioIntelligence(deals), [deals]);
  const wpiDistribution = useMemo(() => buildWpiDistribution(deals), [deals]);
  const riskDistribution = useMemo(() => buildRiskDistribution(deals), [deals]);

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader
          title="Executive Analytics Suite"
          subtitle="Portfolio-level intelligence aggregation"
        >
          <Badge tone="info">Deals {deals.length}</Badge>
          <Badge tone={portfolio.criticalRiskCount > 0 ? "danger" : "success"}>
            Critical Risk {portfolio.criticalRiskCount}
          </Badge>
        </IdentityCardHeader>
        {!loading && !error && (
          <p style={{ margin: "12px 0 0", color: empireColors.textSecondary }}>
            {portfolio.executiveSummary}
          </p>
        )}
      </Card>

      {loading ? (
        <Card>
          <p style={{ margin: 0 }}>Loading executive analytics...</p>
        </Card>
      ) : error ? (
        <Card>
          <p style={{ margin: 0, color: empireColors.danger }}>{error}</p>
        </Card>
      ) : (
        <>
          <div className="enterprise-grid-metrics">
            <RadialMetric
              label="Average Win Probability"
              value={portfolio.avgWinProbability}
              glowColor={empireColors.primary}
            />
            <MetricCard
              label="Portfolio Risk Index"
              value={portfolio.avgRiskScore.toFixed(1)}
              tone={portfolio.avgRiskScore > 60 ? "warning" : "success"}
            />
            <MetricCard
              label="Submission Readiness %"
              value={`${portfolio.readinessRatio.toFixed(1)}%`}
              tone={portfolio.readinessRatio >= 65 ? "success" : "warning"}
            />
          </div>

          <div className="enterprise-grid-metrics">
            <MetricCard
              label="High Risk Deals"
              value={String(portfolio.highRiskCount)}
              tone={portfolio.highRiskCount > 0 ? "warning" : "success"}
            />
            <MetricCard
              label="Critical Risk Deals"
              value={String(portfolio.criticalRiskCount)}
              tone={portfolio.criticalRiskCount > 0 ? "danger" : "success"}
            />
            <Card>
              <p className="enterprise-metric-label">Momentum Summary</p>
              <div className="compliance-summary" style={{ marginTop: 10 }}>
                <div className="compliance-summary-item">
                  <p className="enterprise-metric-label">Up</p>
                  <p className="enterprise-metric-value">{portfolio.improvingCount}</p>
                </div>
                <div className="compliance-summary-item">
                  <p className="enterprise-metric-label">Down</p>
                  <p className="enterprise-metric-value">{portfolio.decliningCount}</p>
                </div>
                <div className="compliance-summary-item">
                  <p className="enterprise-metric-label">Flat</p>
                  <p className="enterprise-metric-value">{portfolio.stableCount}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="enterprise-grid-metrics">
            <DistributionChart
              title="WPI Distribution"
              data={wpiDistribution}
              barColor={empireColors.primary}
            />
            <DistributionChart
              title="Risk Distribution"
              data={riskDistribution}
              barColor={empireColors.warning}
            />
          </div>
        </>
      )}
    </div>
  );
}
