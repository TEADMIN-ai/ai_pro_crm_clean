import { readFileSync } from "fs";
import path from "path";
import { buildDealsDashboardDecision } from "@/lib/deals/dealsDashboardDecision";

const source = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/deals/page.tsx"),
  "utf8",
);

describe("Deals Hub contractor link UI wiring", () => {
  it("keeps the no-contractor state visible and blocks pack generation through the canonical decision", () => {
    const decision = buildDealsDashboardDecision({ deal: { contractorReferenceResolution: { status: "none" } } });

    expect(source).toContain("Not linked");
    expect(source).toContain("This deal is not linked to a contractor. Actions are restricted.");
    expect(source).toContain("dashboardDecision.primaryBlockingReason");
    expect(source).toContain("disabled={!canGeneratePack || isGeneratingPack}");
    expect(source).toContain("if (!canGeneratePack)");
    expect(source).toContain("isDealContractorResolved(selectedDeal)");
    expect(decision.canGeneratePack).toBe(false);
    expect(decision.primaryBlockingReason).toBe("Contractor identity unresolved");
  });

  it("gates assignment controls to authorised roles through the shared helper", () => {
    expect(source).toContain("canManageDealContractorLink(role)");
    expect(source).toContain("canManageContractorLink && selectedDeal");
    expect(source).toContain("aria-label=\"Select contractor to link\"");
  });

  it("uses confirmation before changing an existing contractor link", () => {
    expect(source).toContain("window.confirm(\"Change the linked contractor for this deal?\")");
  });

  it("uses the canonical opportunity execution assignment action and refreshes canonical decision state", () => {
    expect(source).toContain("buildAssignContractorRequest(nextContractorId)");
    expect(source).toContain("`${API_ROUTES.OPPORTUNITY_REGISTER}/${encodeURIComponent(selectedDeal.id)}/execution`");
    expect(source).toContain("await loadData(true);");
    expect(source).toContain("await loadExecutionView(selectedDeal.id);");
    expect(source).not.toContain("await loadSelectedContractor(nextContractorId);");
  });

  it("prevents duplicate or unauthorized assignment submissions unless canonical assignment allows it", () => {
    const missingDecision = buildDealsDashboardDecision({
      deal: { contractorId: "c1", contractorReferenceResolution: { status: "resolved" } },
      projection: { contractorId: "c1", complianceStatus: "VALID", readinessStatus: "READY", readinessScore: 100, eligible: true },
    });

    expect(source).toContain("setIsAssigningContractor(true)");
    expect(source).toContain("selectedAssignmentDecision?.assignmentAllowed !== true");
    expect(source).toContain("disabled={isLoadingContractors || isAssigningContractor || !assignmentContractorId.trim() || selectedAssignmentDecision?.assignmentAllowed !== true}");
    expect(missingDecision.assignmentAllowed).toBe(false);
  });
});
