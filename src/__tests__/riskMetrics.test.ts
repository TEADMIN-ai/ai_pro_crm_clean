import { buildRiskMetrics } from "@/lib/risk/riskMetrics";
import type { Risk } from "@/types/risk";

describe("buildRiskMetrics", () => {
  test("returns zeroed metrics for an empty risk list", () => {
    expect(buildRiskMetrics([])).toEqual({
      totalRisks: 0,
      openRisks: 0,
      monitoringRisks: 0,
      mitigatedRisks: 0,
      averageRiskScore: 0,
    });
  });

  test("summarizes risk counts and average score", () => {
    const risks: Risk[] = [
      {
        id: "1",
        riskTitle: "Late permit",
        riskDescription: "Permit approval may slip",
        riskCategory: "schedule",
        riskScore: 5,
        mitigationPlan: "Escalate with authority",
        owner: "Ops",
        status: "open",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "2",
        riskTitle: "Supplier churn",
        riskDescription: "Supplier availability is unstable",
        riskCategory: "vendor",
        riskScore: 4,
        mitigationPlan: "Qualify alternate supplier",
        owner: "Procurement",
        status: "monitoring",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
      {
        id: "3",
        riskTitle: "Scope resolved",
        riskDescription: "Clarification received",
        riskCategory: "delivery",
        riskScore: 2,
        mitigationPlan: "Track residual issues",
        owner: "PM",
        status: "mitigated",
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      },
    ];

    expect(buildRiskMetrics(risks)).toEqual({
      totalRisks: 3,
      openRisks: 1,
      monitoringRisks: 1,
      mitigatedRisks: 1,
      averageRiskScore: 3.67,
    });
  });
});
