import { buildDealsDashboardDecision, findDashboardMatch } from "@/lib/deals/dealsDashboardDecision";

describe("deals dashboard canonical decision", () => {
  const deal = { contractorId: "c1", contractorReferenceResolution: { status: "resolved" } };
  const validProjection = { contractorId: "c1", complianceStatus: "VALID", readinessStatus: "READY", readinessScore: 100, eligible: true, assignmentAllowed: true, blockingReasons: [] };

  it("missing readiness object does not produce READY", () => {
    expect(buildDealsDashboardDecision({ deal }).readinessLabel).toBe("Readiness not verified");
  });

  it("undefined ready does not become true", () => {
    expect(buildDealsDashboardDecision({ deal, projection: { contractorId: "c1", complianceStatus: "VALID", readinessScore: 100 } }).canGeneratePack).toBe(false);
  });

  it("missing contractor identity displays unresolved", () => {
    expect(buildDealsDashboardDecision({ deal: { contractorReferenceResolution: { status: "unresolved" } } }).contractorIdentityLabel).toBe("Contractor identity unresolved");
  });

  it("missing compliance evidence displays unavailable", () => {
    expect(buildDealsDashboardDecision({ deal, projection: { contractorId: "c1" } }).complianceLabel).toBe("Compliance evidence unavailable");
  });

  it("assignmentAllowed false disables assignment", () => {
    expect(buildDealsDashboardDecision({ deal, projection: { ...validProjection, assignmentAllowed: false } }).assignmentAllowed).toBe(false);
  });

  it("missing assignmentAllowed disables assignment", () => {
    expect(buildDealsDashboardDecision({ deal, projection: { contractorId: "c1", complianceStatus: "VALID", readinessStatus: "READY", readinessScore: 100, eligible: true } }).assignmentAllowed).toBe(false);
  });

  it("only explicit assignmentAllowed true enables assignment", () => {
    expect(buildDealsDashboardDecision({ deal, projection: validProjection }).assignmentAllowed).toBe(true);
  });

  it("score of 100 with a blocker remains blocked", () => {
    const decision = buildDealsDashboardDecision({ deal, projection: { ...validProjection, blockingReasons: ["Compliance evidence unavailable"] } });
    expect(decision.status).toBe("BLOCKED");
    expect(decision.readinessScore).toBeNull();
  });

  it("score above 80 with unresolved identity remains blocked", () => {
    const decision = buildDealsDashboardDecision({ deal: { contractorReferenceResolution: { status: "unresolved" } }, projection: { ...validProjection, readinessScore: 85 } });
    expect(decision.status).toBe("UNRESOLVED");
    expect(decision.assignmentAllowed).toBe(false);
  });

  it("generic positive recommendation text is not shown with blockers", () => {
    const decision = buildDealsDashboardDecision({ deal, projection: { ...validProjection, blockingReasons: ["Tax missing"] }, selectedMatch: { recommendationReason: "Ready for submission", blockingReasons: ["Tax missing"] } });
    expect(decision.recommendationText).toBeNull();
  });

  it("empty requirement-like evidence does not create a positive dashboard state", () => {
    expect(buildDealsDashboardDecision({ deal, projection: { contractorId: "c1", complianceStatus: "VALID", readinessStatus: "UNKNOWN", readinessScore: null, eligible: true, assignmentAllowed: true, blockingReasons: [] } }).canGeneratePack).toBe(false);
  });

  it("preserves the blocking reason used for server assignment rejection display", () => {
    const decision = buildDealsDashboardDecision({
      deal,
      projection: { ...validProjection, blockingReasons: ["Compliance expired or missing"] },
      selectedMatch: { contractorId: "c1", assignmentAllowed: false, blockingReasons: ["Compliance expired or missing"] },
    });

    expect(decision.assignmentAllowed).toBe(false);
    expect(decision.primaryBlockingReason).toBe("Compliance expired or missing");
  });

  it("valid canonical decision displays readiness and enables assignment", () => {
    const decision = buildDealsDashboardDecision({ deal, projection: validProjection });

    expect(decision.readinessLabel).toBe("Readiness verified");
    expect(decision.readinessScore).toBe(100);
    expect(decision.assignmentAllowed).toBe(true);
    expect(decision.canGeneratePack).toBe(true);
  });

  it("finds assignment decisions by canonical contractor id only", () => {
    expect(findDashboardMatch([{ contractorId: "c1", assignmentAllowed: true }], "c1")?.assignmentAllowed).toBe(true);
    expect(findDashboardMatch([{ contractorId: "c1", assignmentAllowed: true }], "missing")).toBeNull();
  });
});
