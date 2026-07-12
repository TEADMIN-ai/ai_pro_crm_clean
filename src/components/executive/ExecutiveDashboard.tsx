"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MeasuredResponsiveContainer from "@/components/charts/MeasuredResponsiveContainer";
import Badge from "@/components/ui/Badge";
import {
  ActivityTimeline,
  AIInsightsPanel,
  ExecutiveKPIGrid,
  ExecutiveSummaryStrip,
  NotificationCentre,
  OperationalHealthPanel,
  TodaysPrioritiesPanel,
  WorkspaceStatusBar,
} from "@/components/executive/OperationsCentre";
import { OpportunityIntelligencePanel } from "@/components/executive/OpportunityIntelligenceWidgets";
import { ExecutiveMonitoringPanel } from "@/components/executive/ExecutiveMonitoringWidgets";
import Card from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import { empireColors } from "@/theme/empireTheme";

type ExecutiveAnalyticsPayload = {
  executiveSummary: string;
  riskSummary: {
    highPriorityRisks: number;
  };
  executiveMetrics: {
    cards: {
      activeAudits: number;
      unresolvedRisks: number;
      verifiedDocuments: number;
      complianceAlerts: number;
    };
    complianceSummary: {
      averageComplianceScore: number;
      averageComplianceConfidence: number;
      averageReadinessConfidence: number;
      averageOperationalConfidence: number;
      readyContractors: number;
      riskContractors: number;
      blockedContractors: number;
      statusBreakdown: Array<{ status: string; count: number }>;
      riskDistribution: Array<{ grade: string; count: number }>;
    };
    verificationStats: {
      totalDocuments: number;
      verified: number;
      invalid: number;
      expired: number;
      expiringSoon: number;
      uploaded: number;
      averageConfidenceScore: number;
    };
    riskHeatmap: Array<{ category: string; severity: string; count: number }>;
    auditProgress: Array<{ projectId: string; title: string; progress: number; openTasks: number; findings: number }>;
  };
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getHeatColor(count: number): string {
  if (count >= 4) return "#FF4D4D";
  if (count >= 3) return "#FB923C";
  if (count >= 2) return "#FACC15";
  if (count >= 1) return "#22C55E";
  return "#0F172A";
}

function ComplianceStatusChart({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const colors = [empireColors.success, empireColors.warning, empireColors.danger];

  return (
    <Card>
      <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Compliance Status</p>
      <div className="relative mx-auto mt-3 min-w-0 w-full max-w-[420px] overflow-hidden" style={{ height: 240, minHeight: 240 }}>
        <MeasuredResponsiveContainer minHeight={240}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={55} outerRadius={92} paddingAngle={4}>
              {data.map((entry, index) => (
                <Cell key={entry.status} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: empireColors.surface,
                border: `1px solid ${empireColors.border}`,
                color: empireColors.textPrimary,
              }}
            />
          </PieChart>
        </MeasuredResponsiveContainer>
      </div>
    </Card>
  );
}

function AuditProgressChart({
  data,
}: {
  data: Array<{ title: string; progress: number; openTasks: number; findings: number }>;
}) {
  return (
    <Card>
      <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Audit Progress</p>
      <div className="relative mx-auto mt-3 min-w-0 w-full max-w-[420px] overflow-hidden" style={{ height: 240, minHeight: 240 }}>
        <MeasuredResponsiveContainer minHeight={240}>
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(30, 41, 59, 0.8)" strokeDasharray="3 3" />
            <XAxis dataKey="title" hide />
            <YAxis stroke={empireColors.textSecondary} />
            <Tooltip
              contentStyle={{
                background: empireColors.surface,
                border: `1px solid ${empireColors.border}`,
                color: empireColors.textPrimary,
              }}
            />
            <Bar dataKey="progress" fill={empireColors.primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </MeasuredResponsiveContainer>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {data.map((item) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              color: empireColors.textSecondary,
              fontSize: 13,
            }}
          >
            <span style={{ color: empireColors.textPrimary }}>{item.title}</span>
            <span>{item.progress}% complete</span>
            <span>{item.openTasks} open tasks</span>
            <span>{item.findings} findings</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RiskHeatmap({
  data,
}: {
  data: Array<{ category: string; severity: string; count: number }>;
}) {
  const severities = ["Low", "Medium", "High", "Critical"];
  const categories = Array.from(new Set(data.map((item) => item.category)));

  return (
    <Card>
      <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Risk Heatmap</p>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `160px repeat(${severities.length}, minmax(60px, 1fr))`,
            gap: 8,
            color: empireColors.textSecondary,
            fontSize: 12,
          }}
        >
          <span />
          {severities.map((severity) => (
            <span key={severity}>{severity}</span>
          ))}
        </div>
        {categories.map((category) => (
          <div
            key={category}
            style={{
              display: "grid",
              gridTemplateColumns: `160px repeat(${severities.length}, minmax(60px, 1fr))`,
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ color: empireColors.textPrimary, fontSize: 13 }}>{category}</span>
            {severities.map((severity) => {
              const point = data.find((item) => item.category === category && item.severity === severity);
              const count = point?.count ?? 0;

              return (
                <div
                  key={`${category}-${severity}`}
                  style={{
                    minHeight: 56,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: getHeatColor(count),
                    border: `1px solid ${empireColors.border}`,
                    color: count > 0 ? "#05080F" : empireColors.textSecondary,
                    fontWeight: 800,
                  }}
                >
                  {count}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function VerificationSummary({
  stats,
}: {
  stats: ExecutiveAnalyticsPayload["executiveMetrics"]["verificationStats"];
}) {
  const data = [
    { status: "Verified", count: stats.verified },
    { status: "Expiring", count: stats.expiringSoon },
    { status: "Expired", count: stats.expired },
    { status: "Invalid", count: stats.invalid },
    { status: "Uploaded", count: stats.uploaded },
  ];

  return (
    <Card>
      <p className="enterprise-metric-label">Document Verification Stats</p>
      <div className="compliance-summary" style={{ marginTop: 12 }}>
        <div className="compliance-summary-item">
          <p className="enterprise-metric-label">Total</p>
          <p className="enterprise-metric-value">{stats.totalDocuments}</p>
        </div>
        <div className="compliance-summary-item">
          <p className="enterprise-metric-label">Verified</p>
          <p className="enterprise-metric-value">{stats.verified}</p>
        </div>
        <div className="compliance-summary-item">
          <p className="enterprise-metric-label">Confidence</p>
          <p className="enterprise-metric-value">{clampPercent(stats.averageConfidenceScore * 100)}%</p>
        </div>
      </div>
      <div className="relative mx-auto mt-3 min-w-0 w-full max-w-[420px] overflow-hidden" style={{ height: 240, minHeight: 240 }}>
        <MeasuredResponsiveContainer minHeight={240}>
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
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={
                    entry.status === "Verified"
                      ? empireColors.success
                      : entry.status === "Expiring"
                        ? empireColors.warning
                        : entry.status === "Expired" || entry.status === "Invalid"
                          ? empireColors.danger
                          : empireColors.primary
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </MeasuredResponsiveContainer>
      </div>
    </Card>
  );
}

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<ExecutiveAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await authFetch(API_ROUTES.DASHBOARD_ANALYTICS);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("Session expired. Please login again.");
            router.push("/login");
            return;
          }
          throw new Error(`Failed to fetch analytics: ${res.status}`);
        }

        setAnalytics((await res.json()) as ExecutiveAnalyticsPayload);
      } catch (err) {
        console.error(err);
        setError("Unable to load executive analytics");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [router]);

  const metrics = useMemo(() => analytics?.executiveMetrics, [analytics]);

  return (
    <div className="enterprise-page enterprise-grid">
      <ExecutiveSummaryStrip
        title="Enterprise Operations Centre"
        summary={!loading && !error && analytics ? analytics.executiveSummary : undefined}
        items={analytics ? [
          { label: "High Priority Risks", value: analytics.riskSummary.highPriorityRisks, tone: analytics.riskSummary.highPriorityRisks > 0 ? "warning" : "success", detail: "Executive exceptions" },
          { label: "Operating View", value: "Live", tone: "info", detail: "Audit, risk, compliance, verification" },
          { label: "Decision Order", value: "3 layers", tone: "neutral", detail: "Metrics, actions, detail" },
        ] : undefined}
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">Executive View</Badge>
          <Badge tone={(analytics?.riskSummary.highPriorityRisks ?? 0) > 0 ? "warning" : "success"}>
            High Priority Risks {analytics?.riskSummary.highPriorityRisks ?? 0}
          </Badge>
        </div>
      </ExecutiveSummaryStrip>

      {loading ? (
        <Card>
          <p style={{ margin: 0 }}>Loading executive analytics...</p>
        </Card>
      ) : error || !analytics || !metrics ? (
        <Card>
          <p style={{ margin: 0, color: empireColors.danger }}>{error ?? "Executive analytics unavailable."}</p>
        </Card>
      ) : (
        <>
          <WorkspaceStatusBar
            items={[
              { label: "Admin", value: metrics.cards.activeAudits > 0 ? "Active" : "Quiet", tone: "info" },
              { label: "Procurement", value: metrics.cards.unresolvedRisks > 0 ? "Review" : "Clear", tone: metrics.cards.unresolvedRisks > 0 ? "warning" : "success" },
              { label: "Hygiene", value: metrics.cards.complianceAlerts > 0 ? "Alerts" : "Stable", tone: metrics.cards.complianceAlerts > 0 ? "warning" : "success" },
              { label: "Vehicle Finance", value: "Online", tone: "success" },
              { label: "QS Engine", value: metrics.riskHeatmap.length > 0 ? "Signals" : "Clear", tone: metrics.riskHeatmap.length > 0 ? "info" : "success" },
              { label: "Contractors", value: metrics.complianceSummary.averageComplianceScore >= 80 ? "Ready" : "Review", tone: metrics.complianceSummary.averageComplianceScore >= 80 ? "success" : "warning" },
              { label: "Driver App", value: "Synced", tone: "success" },
              { label: "Roar Cars", value: "Visible", tone: "info" },
            ]}
          />

          <ExecutiveKPIGrid
            items={[
              { label: "Active Audits", value: metrics.cards.activeAudits, tone: metrics.cards.activeAudits > 0 ? "info" : "warning", detail: "Audit work currently in motion" },
              { label: "Unresolved Risks", value: metrics.cards.unresolvedRisks, tone: metrics.cards.unresolvedRisks > 0 ? "warning" : "success", detail: analytics.riskSummary.highPriorityRisks + " high-priority risk(s)" },
              { label: "Compliance Score", value: metrics.complianceSummary.averageComplianceScore + "%", tone: metrics.complianceSummary.averageComplianceScore >= 80 ? "success" : "warning", detail: metrics.complianceSummary.averageOperationalConfidence + "% operational confidence" },
              { label: "Verified Documents", value: metrics.cards.verifiedDocuments, tone: "success", detail: metrics.verificationStats.totalDocuments + " verification records" },
            ]}
          />

          <OpportunityIntelligencePanel />

          <ExecutiveMonitoringPanel />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <OperationalHealthPanel
              items={[
                { label: "Compliance posture", value: metrics.complianceSummary.averageComplianceScore + "%", detail: metrics.cards.complianceAlerts + " active expiry alert(s)", tone: metrics.complianceSummary.averageComplianceScore >= 80 ? "success" : "warning", progress: metrics.complianceSummary.averageComplianceScore },
                { label: "Verification quality", value: clampPercent(metrics.verificationStats.averageConfidenceScore * 100) + "%", detail: metrics.verificationStats.verified + " verified document(s)", tone: metrics.verificationStats.invalid > 0 ? "warning" : "success", progress: clampPercent(metrics.verificationStats.averageConfidenceScore * 100) },
                { label: "Audit execution", value: metrics.cards.activeAudits, detail: "Open audit programme count", tone: metrics.cards.activeAudits > 0 ? "info" : "neutral" },
              ]}
            />

            <TodaysPrioritiesPanel
              priorities={[
                { title: metrics.cards.unresolvedRisks > 0 ? "Review unresolved risk exposure" : "Maintain risk watch", detail: metrics.cards.unresolvedRisks + " unresolved risk item(s) across the portfolio.", owner: "Executive owner", due: "Today", tone: metrics.cards.unresolvedRisks > 0 ? "warning" : "success" },
                { title: metrics.cards.complianceAlerts > 0 ? "Clear compliance expiry alerts" : "Confirm compliance stability", detail: metrics.cards.complianceAlerts + " active compliance alert(s) require attention.", owner: "Compliance lead", due: "Next operating cycle", tone: metrics.cards.complianceAlerts > 0 ? "warning" : "success" },
                { title: "Check verification exceptions", detail: metrics.verificationStats.invalid + " invalid and " + metrics.verificationStats.expiringSoon + " expiring-soon verification record(s).", owner: "Document control", due: "Before handover", tone: metrics.verificationStats.invalid > 0 ? "danger" : "info" },
              ]}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AIInsightsPanel
              insights={[
                { title: "Executive operating readout", body: analytics.executiveSummary, confidence: "Live", tone: "info" },
                {
                  title: metrics.cards.unresolvedRisks > 0 ? "Risk concentration needs review" : "Risk posture is controlled",
                  body: metrics.cards.unresolvedRisks > 0 ? "Prioritise high-impact risk owners before expanding operational detail." : "No immediate risk escalation is visible from the current analytics snapshot.",
                  confidence: "Derived",
                  tone: metrics.cards.unresolvedRisks > 0 ? "warning" : "success",
                },
              ]}
            />

            <NotificationCentre
              notifications={[
                { title: "Compliance alerts", detail: metrics.cards.complianceAlerts + " expiry or document posture alert(s) are active.", meta: "Compliance", tone: metrics.cards.complianceAlerts > 0 ? "warning" : "success" },
                { title: "Verification queue", detail: metrics.verificationStats.expiringSoon + " expiring soon and " + metrics.verificationStats.uploaded + " uploaded verification record(s).", meta: "Documents", tone: metrics.verificationStats.expiringSoon > 0 ? "info" : "success" },
                { title: "Risk summary", detail: analytics.riskSummary.highPriorityRisks + " high-priority risk signal(s).", meta: "Risk", tone: analytics.riskSummary.highPriorityRisks > 0 ? "danger" : "success" },
              ]}
            />
          </div>

          <ActivityTimeline
            items={(metrics.auditProgress.length ? metrics.auditProgress : [{ projectId: "audit", title: "No active audit progress records", progress: 0, openTasks: 0, findings: 0 }]).slice(0, 4).map((audit) => ({
              title: audit.title,
              detail: audit.progress + "% progress | " + audit.openTasks + " open task(s) | " + audit.findings + " finding(s)",
              time: audit.projectId,
              tone: audit.findings > 0 ? "warning" : "info",
            }))}
          />

          <div className="enterprise-grid-metrics" style={{ alignItems: "flex-start" }}>
            <RiskHeatmap data={metrics.riskHeatmap} />
            <ComplianceStatusChart data={metrics.complianceSummary.statusBreakdown} />
          </div>

          <div className="enterprise-grid-metrics" style={{ alignItems: "flex-start" }}>
            <AuditProgressChart data={metrics.auditProgress} />
            <VerificationSummary stats={metrics.verificationStats} />
          </div>
        </>
      )}
    </div>
  );
}
