// src/app/dashboard/admin/page.tsx

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import type { Deal } from "@/types/deal";

import { computeAdminMetrics } from "@/lib/intelligence/admin/computeAdminMetrics";
import { computeRevenueHealthScore } from "@/lib/kpis/revenueHealthScore";
import { computeDealRisk } from "@/lib/risk/computeDealRisk";

import { computeCapitalEfficiency } from "@/lib/executive/computeCapitalEfficiency";
import { computeExecutionVelocity } from "@/lib/executive/computeExecutionVelocity";
import { computePipelineQuality } from "@/lib/executive/computePipelineQuality";
import { computePortfolioExposure } from "@/lib/executive/computePortfolioExposure";
import { computeRevenueMomentum } from "@/lib/executive/computeRevenueMomentum";

/* =========================
   FIREBASE ADMIN INIT
========================= */

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

/* =========================
   UI CARD COMPONENT
========================= */

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

/* =========================
   ADMIN DASHBOARD PAGE
========================= */

export default async function AdminDashboardPage() {
  initFirebaseAdmin();

  const db = getFirestore();
  const snapshot = await db.collection("deals").get();
  const deals = snapshot.docs.map((doc) => doc.data()) as Deal[];

  /* ---------- Core Metrics ---------- */

  const metrics = computeAdminMetrics(deals);
  const revenueHealth = computeRevenueHealthScore(deals);

  const riskScores = deals.map((d) => computeDealRisk(d));
  const avgRisk =
    riskScores.length > 0
      ? riskScores.reduce((a, b) => a + b.score, 0) / riskScores.length
      : 0;

  const conversionRate = metrics?.submissionConversion ?? 0;

  /* ---------- Executive Signals ---------- */

  const capitalEfficiency = computeCapitalEfficiency(deals);
  const executionVelocity = computeExecutionVelocity(deals);
  const pipelineQuality = computePipelineQuality(deals);
  const portfolioExposure = computePortfolioExposure(deals);
  const revenueMomentum = computeRevenueMomentum(deals);

  /* ---------- Color Logic ---------- */

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

      {/* ================= EXECUTIVE SIGNALS ================= */}

      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <Card
          title="Revenue Momentum"
          value={`${revenueMomentum.percentage.toFixed(1)}%`}
          color={
            revenueMomentum.trend === "up"
              ? "#10b981"
              : revenueMomentum.trend === "down"
              ? "#ef4444"
              : "#f59e0b"
          }
        />
        <Card
          title="Pipeline Quality"
          value={`${pipelineQuality.score}/100`}
          color={
            pipelineQuality.score >= 75
              ? "#10b981"
              : pipelineQuality.score >= 60
              ? "#f59e0b"
              : "#ef4444"
          }
        />
        <Card
          title="Capital Efficiency"
          value={capitalEfficiency.toFixed(2)}
          color={capitalEfficiency >= 0.8 ? "#10b981" : "#f97316"}
        />
        <Card
          title="Portfolio Exposure"
          value={`${portfolioExposure}/100`}
          color={portfolioExposure <= 40 ? "#10b981" : "#ef4444"}
        />
      </div>

      {/* ================= FINANCIAL PULSE ================= */}

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

      {/* ================= RISK PANEL ================= */}

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

      {/* ================= OPERATIONS ================= */}

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

