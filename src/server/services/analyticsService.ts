import { calculatePortfolioIntelligence } from "@/lib/intelligence/portfolioIntelligenceEngine";
import { buildRiskRegisterSummary } from "@/lib/risk/riskRegisterSummary";
import type { Deal } from "@/types/deal";
import type { AuditProject } from "@/types/audit";
import type { RiskRegisterSummary } from "@/types/risk";
import { listDealsForUser } from "@/server/services/dealService";
import { listRiskRegisterEntries } from "@/server/services/riskRegisterService";
import type { AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export interface DashboardTenderInsights {
  avgReadinessScore: number;
  totalEstimatedDealValue: number;
  missingComplianceItems: string[];
  highRiskDeals: number;
}

export interface DashboardAnalyticsPayload {
  deals: Deal[];
  contractorCount: number;
  executiveSummary: string;
  portfolio: ReturnType<typeof calculatePortfolioIntelligence>;
  tenderInsights: DashboardTenderInsights;
  riskSummary: RiskRegisterSummary;
  executiveMetrics: ExecutiveMetricsPayload;
}

export interface ExecutiveMetricCardSet {
  activeAudits: number;
  unresolvedRisks: number;
  verifiedDocuments: number;
  complianceAlerts: number;
}

export interface ComplianceStatusPoint {
  status: string;
  count: number;
}

export interface VerificationStatsPayload {
  totalDocuments: number;
  verified: number;
  invalid: number;
  expired: number;
  expiringSoon: number;
  uploaded: number;
  averageConfidenceScore: number;
}

export interface ComplianceSummaryPayload {
  averageComplianceScore: number;
  readyContractors: number;
  riskContractors: number;
  blockedContractors: number;
  statusBreakdown: ComplianceStatusPoint[];
}

export interface RiskHeatmapPoint {
  category: string;
  severity: string;
  count: number;
}

export interface AuditProgressPoint {
  projectId: string;
  title: string;
  progress: number;
  openTasks: number;
  findings: number;
}

export interface ExecutiveMetricsPayload {
  cards: ExecutiveMetricCardSet;
  complianceSummary: ComplianceSummaryPayload;
  verificationStats: VerificationStatsPayload;
  riskHeatmap: RiskHeatmapPoint[];
  auditProgress: AuditProgressPoint[];
}

function toSafeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function buildTenderInsights(deals: Deal[]): DashboardTenderInsights {
  if (deals.length === 0) {
    return {
      avgReadinessScore: 0,
      totalEstimatedDealValue: 0,
      missingComplianceItems: [],
      highRiskDeals: 0,
    };
  }

  const totalReadiness = deals.reduce((sum, deal) => sum + (typeof deal.readinessScore === "number" ? deal.readinessScore : 0), 0);
  const totalEstimatedDealValue = deals.reduce(
    (sum, deal) => sum + (typeof deal.estimatedDealValue === "number" ? deal.estimatedDealValue : 0),
    0
  );
  const missingComplianceItems = Array.from(
    new Set(deals.flatMap((deal) => (Array.isArray(deal.missingRequirements) ? deal.missingRequirements : [])))
  );
  const highRiskDeals = deals.filter((deal) => deal.riskLevel === "HIGH" || deal.riskLevel === "CRITICAL").length;

  return {
    avgReadinessScore: Math.round(totalReadiness / deals.length),
    totalEstimatedDealValue,
    missingComplianceItems,
    highRiskDeals,
  };
}

function buildComplianceSummary(contractorsSnapshot: FirebaseFirestore.QuerySnapshot): ComplianceSummaryPayload {
  let totalScore = 0;
  let readyContractors = 0;
  let riskContractors = 0;
  let blockedContractors = 0;

  for (const doc of contractorsSnapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    totalScore += toSafeNumber(data.complianceStatusScore);

    const tenderLockStatus = asString(data.tenderLockStatus);
    if (tenderLockStatus === "READY") {
      readyContractors += 1;
    } else if (tenderLockStatus === "RISK") {
      riskContractors += 1;
    } else {
      blockedContractors += 1;
    }
  }

  return {
    averageComplianceScore:
      contractorsSnapshot.size > 0 ? Math.round(totalScore / contractorsSnapshot.size) : 0,
    readyContractors,
    riskContractors,
    blockedContractors,
    statusBreakdown: [
      { status: "Ready", count: readyContractors },
      { status: "Risk", count: riskContractors },
      { status: "Blocked", count: blockedContractors },
    ],
  };
}

function buildVerificationStats(snapshot: FirebaseFirestore.QuerySnapshot): VerificationStatsPayload {
  let verified = 0;
  let invalid = 0;
  let expired = 0;
  let expiringSoon = 0;
  let uploaded = 0;
  let confidenceTotal = 0;

  for (const doc of snapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const status = asString(data.validationStatus) ?? asString(data.status) ?? "uploaded";

    if (status === "verified") {
      verified += 1;
    } else if (status === "invalid") {
      invalid += 1;
    } else if (status === "expired") {
      expired += 1;
    } else if (status === "expiringSoon") {
      expiringSoon += 1;
    } else {
      uploaded += 1;
    }

    confidenceTotal += toSafeNumber(data.confidenceScore);
  }

  return {
    totalDocuments: snapshot.size,
    verified,
    invalid,
    expired,
    expiringSoon,
    uploaded,
    averageConfidenceScore: snapshot.size > 0 ? Number((confidenceTotal / snapshot.size).toFixed(2)) : 0,
  };
}

function resolveRiskSeverity(score: number): string {
  if (score >= 5) {
    return "Critical";
  }
  if (score >= 4) {
    return "High";
  }
  if (score >= 3) {
    return "Medium";
  }

  return "Low";
}

function buildRiskHeatmap(risks: Array<{ riskCategory: string; riskScore: number }>): RiskHeatmapPoint[] {
  const buckets = new Map<string, number>();

  for (const risk of risks) {
    const category = risk.riskCategory?.trim() || "general";
    const severity = resolveRiskSeverity(risk.riskScore);
    const key = `${category}::${severity}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([key, count]) => {
      const [category, severity] = key.split("::");
      return { category, severity, count };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.severity.localeCompare(b.severity));
}

function normalizeAuditProject(id: string, data: Record<string, unknown>): AuditProject {
  return {
    id,
    title: asString(data.title) ?? "Untitled audit",
    department: asString(data.department) ?? "",
    startDate:
      typeof data.startDate === "string"
        ? data.startDate
        : new Date(toMillis(data.startDate) ?? Date.now()).toISOString(),
    endDate:
      typeof data.endDate === "string"
        ? data.endDate
        : new Date(toMillis(data.endDate) ?? Date.now()).toISOString(),
    leadAuditor: asString(data.leadAuditor) ?? "",
    status:
      data.status === "active" || data.status === "completed" || data.status === "archived"
        ? data.status
        : "planned",
  };
}

async function buildAuditProgress(db: FirebaseFirestore.Firestore): Promise<{ activeAudits: number; points: AuditProgressPoint[] }> {
  const projectsSnapshot = await db.collection("auditProjects").orderBy("updatedAt", "desc").get();
  const projects = projectsSnapshot.docs.map((doc) =>
    normalizeAuditProject(doc.id, (doc.data() ?? {}) as Record<string, unknown>),
  );

  const activeAudits = projects.filter((project) => project.status === "active").length;

  const points = await Promise.all(
    projects.slice(0, 6).map(async (project) => {
      const [tasksSnapshot, findingsSnapshot] = await Promise.all([
        db.collection("auditProjects").doc(project.id).collection("tasks").get(),
        db.collection("auditProjects").doc(project.id).collection("findings").get(),
      ]);

      const taskCount = tasksSnapshot.size;
      const completedTaskCount = tasksSnapshot.docs.filter((doc) => ((doc.data() ?? {}) as Record<string, unknown>).status === "done").length;
      const openTasks = taskCount - completedTaskCount;

      return {
        projectId: project.id,
        title: project.title,
        progress: taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0,
        openTasks,
        findings: findingsSnapshot.size,
      };
    }),
  );

  return { activeAudits, points };
}

async function buildExecutiveMetrics(
  db: FirebaseFirestore.Firestore,
  contractorsSnapshot: FirebaseFirestore.QuerySnapshot,
  risks: Awaited<ReturnType<typeof listRiskRegisterEntries>>,
): Promise<ExecutiveMetricsPayload> {
  const [complianceDataSnapshot, auditProgress] = await Promise.all([
    db.collectionGroup("complianceData").get(),
    buildAuditProgress(db),
  ]);

  const complianceSummary = buildComplianceSummary(contractorsSnapshot);
  const verificationStats = buildVerificationStats(complianceDataSnapshot);

  return {
    cards: {
      activeAudits: auditProgress.activeAudits,
      unresolvedRisks: risks.filter((risk) => risk.status === "open" || risk.status === "monitoring").length,
      verifiedDocuments: verificationStats.verified,
      complianceAlerts: contractorsSnapshot.docs.reduce(
        (sum, doc) => sum + toSafeNumber((doc.data() ?? {}).activeComplianceAlerts),
        0,
      ),
    },
    complianceSummary,
    verificationStats,
    riskHeatmap: buildRiskHeatmap(risks),
    auditProgress: auditProgress.points,
  };
}

export async function getDashboardAnalytics(user: AuthorizedUser): Promise<DashboardAnalyticsPayload> {
  const db = getFirebaseAdmin();
  const [deals, contractorsSnapshot, risks] = await Promise.all([
    listDealsForUser(user),
    db.collection("contractors").get(),
    listRiskRegisterEntries(user),
  ]);

  return {
    deals,
    contractorCount: contractorsSnapshot.size,
    executiveSummary:
      deals.length > 0
        ? "Operational portfolio metrics are available and current."
        : "No deal activity is available yet.",
    portfolio: calculatePortfolioIntelligence(deals),
    tenderInsights: buildTenderInsights(deals),
    riskSummary: buildRiskRegisterSummary(risks),
    executiveMetrics: await buildExecutiveMetrics(db, contractorsSnapshot, risks),
  };
}
