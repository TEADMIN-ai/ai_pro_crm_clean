import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import AdminDashboardPage from "@/app/dashboard/admin/page";
import ExecutiveSummaryPanel from "@/components/financial/ExecutiveSummaryPanel";
import ProfitProjectionPanel from "@/components/financial/ProfitProjectionPanel";
import RevenueScoreCard from "@/components/financial/RevenueScoreCard";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";
import type { EnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";
import type { UserRole } from "@/lib/auth/roleUtils";

jest.mock("@/hooks/useEnterpriseKpis", () => ({
  useEnterpriseKpis: jest.fn(),
}));

jest.mock("@/components/auth/RequireRole", () => ({
  __esModule: true,
  default: ({ children }: { allow: UserRole[]; children: React.ReactNode }) => children,
}));

const mockedUseEnterpriseKpis = jest.mocked(useEnterpriseKpis);

function snapshot(overrides: Partial<EnterpriseKpiSnapshot> = {}): EnterpriseKpiSnapshot {
  return {
    schemaVersion: "2026-07",
    generatedAt: "2026-07-20T00:00:00.000Z",
    dashboardSummary: {
      totalOpportunities: 5,
      readyForSubmission: 3,
      submitted: 2,
      blocked: 2,
      risk: 1,
      avgReadiness: 76,
      pipelineValue: 1_200_000,
      recent: [],
    },
    opportunities: {
      total: 5,
      rfq: 1,
      tender: 2,
      rfp: 1,
      rfi: 0,
      quotation: 1,
      unknown: 0,
      municipalities: 3,
      closingSoon: 1,
      overdue: 0,
      compulsoryBriefings: 1,
      boqRequired: 2,
      assigned: 3,
      unassigned: 2,
    },
    contractors: {
      total: 7,
      ready: 4,
      compliant: 5,
      assigned: 3,
      unassigned: 4,
      avgReadiness: 72,
    },
    clients: { total: 2, active: 2, inactive: 0, monthlyRevenue: 50_000 },
    drivers: { total: 4, activeAssignments: 2, collectionsToday: 1, collectionsThisWeek: 3 },
    collections: { total: 8, scheduled: 3, inProgress: 1, completed: 3, overdue: 1, dueThisWeek: 4 },
    compliance: { total: 9, valid: 6, expiringSoon: 1, expired: 2 },
    submissions: {
      total: 5,
      readyToSubmit: 3,
      submitted: 2,
      blocked: 2,
      avgReadiness: 76,
      conversionRate: 40,
    },
    revenue: {
      totalValue: 1_200_000,
      awardedValue: 300_000,
      submittedValue: 450_000,
      pipelineValue: 1_200_000,
      averageValue: 240_000,
    },
    documents: {
      total: 9,
      topLevel: 2,
      opportunityDocuments: 4,
      contractorDocuments: 3,
      uploadedToday: 2,
    },
    readiness: { averageScore: 76, ready: 3, atRisk: 1, notReady: 1 },
    ...overrides,
  };
}

function emptySnapshot(): EnterpriseKpiSnapshot {
  return snapshot({
    dashboardSummary: { totalOpportunities: 0, readyForSubmission: 0, submitted: 0, blocked: 0, risk: 0, avgReadiness: 0, pipelineValue: 0, recent: [] },
    opportunities: { total: 0, rfq: 0, tender: 0, rfp: 0, rfi: 0, quotation: 0, unknown: 0, municipalities: 0, closingSoon: 0, overdue: 0, compulsoryBriefings: 0, boqRequired: 0, assigned: 0, unassigned: 0 },
    contractors: { total: 0, ready: 0, compliant: 0, assigned: 0, unassigned: 0, avgReadiness: 0 },
    clients: { total: 0, active: 0, inactive: 0, monthlyRevenue: 0 },
    drivers: { total: 0, activeAssignments: 0, collectionsToday: 0, collectionsThisWeek: 0 },
    collections: { total: 0, scheduled: 0, inProgress: 0, completed: 0, overdue: 0, dueThisWeek: 0 },
    compliance: { total: 0, valid: 0, expiringSoon: 0, expired: 0 },
    submissions: { total: 0, readyToSubmit: 0, submitted: 0, blocked: 0, avgReadiness: 0, conversionRate: 0 },
    revenue: { totalValue: 0, awardedValue: 0, submittedValue: 0, pipelineValue: 0, averageValue: 0 },
    documents: { total: 0, topLevel: 0, opportunityDocuments: 0, contractorDocuments: 0, uploadedToday: 0 },
    readiness: { averageScore: 0, ready: 0, atRisk: 0, notReady: 0 },
  });
}

function mockKpis(state: { data: EnterpriseKpiSnapshot | null; loading?: boolean; error?: string | null }) {
  mockedUseEnterpriseKpis.mockReturnValue({
    data: state.data,
    loading: state.loading ?? false,
    error: state.error ?? null,
  });
}

function text(markup: string): string {
  return markup.replace(/&nbsp;/g, " ").replace(/\u00a0/g, " ").replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ");
}

function renderAllFinancialPanels(): string {
  return text(
    renderToStaticMarkup(
      <>
        <ExecutiveSummaryPanel />
        <ProfitProjectionPanel />
        <RevenueScoreCard />
      </>,
    ),
  );
}

describe("enterprise KPI dashboard semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the admin dashboard from the canonical populated KPI snapshot", () => {
    mockKpis({ data: snapshot() });

    const markup = text(renderToStaticMarkup(<AdminDashboardPage />));

    expect(markup).toContain("Readiness 76%");
    expect(markup).toContain("Risk 1");
    expect(markup).toContain("Opportunities 5");
    expect(markup).toContain("Ready To Submit");
    expect(markup).toContain("Submission Conversion (submitted / total)");
    expect(markup).toContain("40%");
    expect(markup).toContain("Pipeline Value");
    expect(markup).toContain("Submitted Opportunity Value");
    expect(markup).toContain("Average Opportunity Value");
    expect(markup).toContain("Awarded or Closed Opportunity Value");
    expect(markup).toContain("Blocked Submissions");
    expect(markup).toContain("At Risk Readiness");
    expect(markup).toContain(formatCurrency(1_200_000));
    expect(markup).toContain(formatCurrency(450_000));
    expect(markup).toContain(formatCurrency(300_000));
    expect(markup).toContain(formatCurrency(240_000));
  });

  test("renders admin loading, error, and empty-data states", () => {
    mockKpis({ data: null, loading: true });
    expect(text(renderToStaticMarkup(<AdminDashboardPage />))).toContain("Loading live enterprise KPIs...");

    mockKpis({ data: null, error: "Enterprise KPIs are temporarily unavailable." });
    expect(text(renderToStaticMarkup(<AdminDashboardPage />))).toContain("Enterprise KPIs are temporarily unavailable.");

    mockKpis({ data: emptySnapshot() });
    const emptyMarkup = text(renderToStaticMarkup(<AdminDashboardPage />));
    expect(emptyMarkup).toContain("Readiness 0%");
    expect(emptyMarkup).toContain("Opportunities 0");
    expect(emptyMarkup).toContain(formatCurrency(0));
  });

  test("renders retained financial panels with correct labels and values", () => {
    mockKpis({ data: snapshot() });

    const markup = renderAllFinancialPanels();

    expect(markup).toContain("Executive Operating Summary");
    expect(markup).toContain("Opportunity Value Projection");
    expect(markup).toContain("Opportunity Value Intelligence");
    expect(markup).toContain("Visible Contractors");
    expect(markup).toContain("Visible Opportunities");
    expect(markup).toContain("Total Opportunity Value");
    expect(markup).toContain("Pipeline Opportunity Value");
    expect(markup).toContain("Submitted Opportunity Value");
    expect(markup).toContain("Awarded or Closed Opportunity Value");
    expect(markup).toContain("Submission Conversion (submitted / total)");
    expect(markup).toContain(formatCurrency(1_200_000));
    expect(markup).toContain(formatCurrency(450_000));
    expect(markup).toContain(formatCurrency(300_000));
    expect(markup).toContain("40%");
  });

  test("renders financial panel loading, error, and empty-data states", () => {
    mockKpis({ data: null, loading: true });
    expect(renderAllFinancialPanels()).toContain("Loading enterprise KPI snapshot...");

    mockKpis({ data: null, error: "Enterprise KPIs are temporarily unavailable." });
    expect(renderAllFinancialPanels()).toContain("Enterprise KPIs are temporarily unavailable.");

    mockKpis({ data: emptySnapshot() });
    const emptyMarkup = renderAllFinancialPanels();
    expect(emptyMarkup).toContain("Visible Contractors");
    expect(emptyMarkup).toContain(formatCurrency(0));
    expect(emptyMarkup).toContain("0%");
  });

  test("does not reintroduce legacy local fetches or misleading financial terminology", () => {
    const files = [
      "src/app/dashboard/admin/page.tsx",
      "src/components/financial/ExecutiveSummaryPanel.tsx",
      "src/components/financial/ProfitProjectionPanel.tsx",
      "src/components/financial/RevenueScoreCard.tsx",
    ];

    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

    expect(source).not.toMatch(/authFetch|getDealsForUser|getContractors|API_ROUTES|fetch\s*\(/);
    expect(source).not.toMatch(/Revenue Health|Total Revenue|Pipeline Revenue|Profit Projection|Submitted Profit|realised revenue|cash received/i);
  });
});
