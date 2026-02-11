import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { computeAdminMetrics } from "@/lib/intelligence/admin/computeAdminMetrics";
import { computeRevenueHealthScore } from "@/lib/kpis/revenueHealthScore";
import { computeDealRisk } from "@/lib/risk/computeDealRisk";import type { Deal } from "@/types/deal";

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#111827",
        padding: "20px",
        borderRadius: "10px",
        color: "white",
        minWidth: "220px",
        flex: 1,
      }}
    >
      <p style={{ opacity: 0.7, fontSize: 14 }}>{title}</p>
      <h2 style={{ fontSize: 28, marginTop: 8, color: color || "white" }}>
        {value}
      </h2>
    </div>
  );
}

export default async function AdminDashboardPage() {
  initFirebaseAdmin();
  const db = getFirestore();

  const snapshot = await db.collection("deals").get();
  const deals = snapshot.docs.map((doc) => doc.data()) as Deal[];

  const metrics = computeAdminMetrics(deals);

  const revenueHealth = computeRevenueHealthScore(deals);

  const riskScores = deals.map((d) => computeDealRisk(d));
  const avgRisk =
    riskScores.length > 0
      ? riskScores.reduce((a, b) => a + b.score, 0) / riskScores.length
      : 0;

  const conversionRate =
    metrics?.submissionConversion ?? 0;

  const revenueHealthColor =
    revenueHealth >= 80
      ? "#10b981"
      : revenueHealth >= 60
      ? "#f59e0b"
      : "#ef4444";

  const riskColor =
    avgRisk <= 30
      ? "#10b981"
      : avgRisk <= 60
      ? "#f97316"
      : "#ef4444";

  return (
    <div style={{ padding: "40px", background: "#0f172a", minHeight: "100vh" }}>
      <h1 style={{ color: "white", marginBottom: 30 }}>
        Admin Control Tower
      </h1>

      {/* ROW 1 — FINANCIAL PULSE */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <Card
          title="Total Pipeline"
          value={`R ${metrics.totalPipelineValue?.toLocaleString() || 0}`}
        />
        <Card
          title="Weighted Revenue"
          value={`R ${metrics.weightedRevenue?.toLocaleString() || 0}`}
        />
        <Card
          title="Revenue Health Score"
          value={`${revenueHealth.toFixed(1)}%`}
          color={revenueHealthColor}
        />
      </div>

      {/* ROW 2 — RISK PANEL */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <Card
          title="Portfolio Risk Score"
          value={`${avgRisk.toFixed(1)}`}
          color={riskColor}
        />
        <Card
          title="Critical Risk Deals"
          value={metrics.criticalRiskCount || 0}
        />
        <Card
          title="High Risk Deals"
          value={metrics.highRiskCount || 0}
        />
      </div>

      {/* ROW 3 — OPERATIONS */}
      <div style={{ display: "flex", gap: 20 }}>
        <Card
          title="Ready To Submit"
          value={metrics.readyToSubmitCount || 0}
        />
        <Card
          title="Stuck In Manager Review"
          value={metrics.managerReviewStuckCount || 0}
        />
        <Card
          title="Submission Conversion"
          value={`${conversionRate.toFixed(1)}%`}
        />
      </div>
    </div>
  );
}