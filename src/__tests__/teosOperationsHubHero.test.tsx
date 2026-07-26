import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import TeosOperationsHubHero from "@/components/dashboard/TeosOperationsHubHero";
import type { EnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ priority, ...props }: { src: string; alt: string; width: number; height: number; className?: string; sizes?: string; priority?: boolean }) => (
    <img {...props} data-priority={priority ? "true" : undefined} />
  ),
}));

const snapshot: EnterpriseKpiSnapshot = {
  schemaVersion: "2026-07", generatedAt: "2026-07-26T00:00:00.000Z",
  dashboardSummary: { totalOpportunities: 4, readyForSubmission: 2, submitted: 1, blocked: 1, risk: 1, avgReadiness: 74, pipelineValue: 120000, recent: [] },
  opportunities: { total: 4, rfq: 1, tender: 2, rfp: 0, rfi: 0, quotation: 1, unknown: 0, municipalities: 2, closingSoon: 1, overdue: 0, compulsoryBriefings: 1, boqRequired: 2, assigned: 2, unassigned: 2 },
  contractors: { total: 3, ready: 2, compliant: 2, assigned: 1, unassigned: 2, avgReadiness: 70 },
  clients: { total: 1, active: 1, inactive: 0, monthlyRevenue: 0 }, drivers: { total: 1, activeAssignments: 1, collectionsToday: 0, collectionsThisWeek: 1 },
  collections: { total: 1, scheduled: 1, inProgress: 0, completed: 0, overdue: 0, dueThisWeek: 1 }, compliance: { total: 2, valid: 1, expiringSoon: 1, expired: 0 },
  submissions: { total: 4, readyToSubmit: 2, submitted: 1, blocked: 1, avgReadiness: 74, conversionRate: 25 }, revenue: { totalValue: 120000, awardedValue: 0, submittedValue: 20000, pipelineValue: 120000, averageValue: 30000 },
  documents: { total: 5, topLevel: 1, opportunityDocuments: 3, contractorDocuments: 1, uploadedToday: 0 }, readiness: { averageScore: 74, ready: 2, atRisk: 1, notReady: 1 },
};

function renderHero() {
  return renderToStaticMarkup(<TeosOperationsHubHero data={snapshot} readinessScore="74%" submissionRate="25%" />);
}

describe("TEOS operations hub hero", () => {
  test("is imported and rendered by the main dashboard component", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/dashboard/EnterpriseDashboardHome.tsx"), "utf8");
    expect(source).toContain("import TeosOperationsHubHero");
    expect(source).toContain("<TeosOperationsHubHero data={data} readinessScore={readinessScore} submissionRate={submissionRate} />");
  });

  test("renders the optimized image path and concept-visual disclaimer", () => {
    const markup = renderHero();
    expect(markup).toContain("TORQUE EMPIRE OPERATING SYSTEM");
    expect(markup).toContain("One intelligent operating hub. Four divisions. Total control.");
    expect(markup).toContain("/media/teos/teos-operations-hub-hero.webp");
    expect(markup).toContain("Portrait brand concept visual of the Torque Empire Operations Hub digital workspace.");
    expect(markup).toContain("Torque Empire Operations Hub - Brand Concept Visual");
  });

  test("uses useful existing CTA destinations with no current-page self-link", () => {
    const markup = renderHero();
    expect(markup).toContain("href=\"/dashboard/opportunity-register\"");
    expect(markup).toContain("href=\"/dashboard/contractors\"");
    expect(markup).toContain("href=\"/dashboard/hygiene\"");
    expect(markup).not.toContain("href=\"/dashboard\"");
  });

  test("keeps MetricCard label and value text readable on translucent cards", () => {
    const markup = renderHero();
    expect(markup).toContain("[&amp;_.tex-metric-label]:text-sky-100/80");
    expect(markup).toContain("[&amp;_.tex-metric-value]:text-white");
    expect(markup).toContain("Avg Readiness");
    expect(markup).toContain("74%");
    expect(markup).toContain("Submission Rate");
    expect(markup).toContain("25%");
    expect(markup).toContain("Risk Watch");
  });
});
