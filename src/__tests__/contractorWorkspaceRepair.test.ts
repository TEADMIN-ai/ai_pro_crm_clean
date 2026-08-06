import {
  buildWorkspaceRepairPlan,
  buildWorkspaceRepairPlans,
  type WorkspaceRepairRecord,
  type WorkspaceRepairTarget,
} from "@/lib/contractors/contractorWorkspaceRepair";

const baseRecord: WorkspaceRepairRecord = {
  id: "contractor-1",
  companyName: "Torque Empire",
  workspaceId: null,
  readinessScore: 100,
  complianceScore: 100,
  complianceApproved: true,
};

const target: WorkspaceRepairTarget = {
  contractorId: "contractor-1",
  targetWorkspaceId: "workspace-1",
  workspaceEvidence: [{ workspaceId: "workspace-1", source: "linked-user", confidence: "HIGH", reference: "user-1" }],
};

describe("contractor workspace repair planning", () => {
  it("defaults to a dry-run with an explicit allowlist", () => {
    const plan = buildWorkspaceRepairPlan(baseRecord, target);
    expect(plan.mode).toBe("DRY_RUN");
    expect(plan.status).toBe("READY");
    expect(plan.allowedFields).toEqual(["workspaceId", "workspaceResolutionStatus", "workspaceRepairMetadata"]);
    expect(plan.proposedChanges.workspaceId).toBe("workspace-1");
  });

  it("requires explicit targets and rejects duplicate target IDs", () => {
    expect(() => buildWorkspaceRepairPlans([baseRecord], [])).toThrow("explicit contractor target");
    expect(() => buildWorkspaceRepairPlans([baseRecord], [target, target])).toThrow("Duplicate contractor target");
  });

  it("refuses archived contractors", () => {
    const plan = buildWorkspaceRepairPlan({ ...baseRecord, archived: true }, target);
    expect(plan.status).toBe("BLOCKED");
    expect(plan.blockers).toContain("Archived contractor requires explicit separate review");
  });

  it("refuses benchmark contractors", () => {
    const plan = buildWorkspaceRepairPlan({ ...baseRecord, id: "torque-empire-benchmark" }, { ...target, contractorId: "torque-empire-benchmark" });
    expect(plan.status).toBe("BLOCKED");
    expect(plan.blockers).toContain("Benchmark contractor cannot be repaired");
  });

  it("refuses ambiguous or missing workspace evidence", () => {
    const ambiguous = buildWorkspaceRepairPlan(baseRecord, { ...target, workspaceEvidence: [
      { workspaceId: "workspace-1", source: "user", confidence: "HIGH" },
      { workspaceId: "workspace-2", source: "deal", confidence: "HIGH" },
    ] });
    expect(ambiguous.blockers).toContain("Workspace evidence is ambiguous");
    const missing = buildWorkspaceRepairPlan(baseRecord, { ...target, workspaceEvidence: [] });
    expect(missing.blockers).toContain("Workspace evidence is missing");
  });

  it("refuses duplicate canonical identity and workspace conflicts", () => {
    const plan = buildWorkspaceRepairPlan(baseRecord, { ...target, duplicateCanonicalIdentityIds: ["other-contractor"] });
    expect(plan.blockers).toContain("Duplicate canonical identity requires manual review");
    const conflict = buildWorkspaceRepairPlan(baseRecord, { ...target, targetWorkspaceId: "workspace-2" });
    expect(conflict.blockers).toContain("Target workspace conflicts with workspace evidence");
  });

  it("is idempotent and does not elevate readiness or compliance", () => {
    const plan = buildWorkspaceRepairPlan({ ...baseRecord, workspaceId: "workspace-1" }, target);
    expect(plan.status).toBe("NOOP");
    expect(plan.readinessElevated).toBe(false);
    expect(plan.complianceElevated).toBe(false);
    expect(plan.recomputationRequired).toBe(true);
  });

  it("generates rollback data and keeps readiness/compliance out of proposed changes", () => {
    const plan = buildWorkspaceRepairPlan(baseRecord, target);
    expect(plan.rollback.restoreFields).toEqual({ workspaceId: null, workspaceResolutionStatus: null, workspaceRepairMetadata: null });
    expect(plan.proposedChanges).not.toHaveProperty("readinessScore");
    expect(plan.proposedChanges).not.toHaveProperty("complianceScore");
    expect(plan.proposedChanges).not.toHaveProperty("complianceApproved");
  });
});

