import { readFileSync } from "node:fs";
import path from "node:path";
import { buildContractorRepositoryDecision, getContractorRepositoryStatusLabel } from "@/lib/contractors/contractorRepositoryDecision";
import type { ContractorDocument } from "@/types/document";

const docs: ContractorDocument[] = Array.from({ length: 5 }, (_, index) => ({
  id: "doc-" + index,
  contractorId: "archived-1",
  documentType: ["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation"][index],
  fileUrl: "https://example.test/doc.pdf",
  verified: true,
  verifiedAt: Date.parse("2026-07-22T00:00:00.000Z"),
}));

describe("archived contractor presentation integrity", () => {
  test("archived records are blocked operationally while historical scores remain readable", () => {
    const decision = buildContractorRepositoryDecision({
      evaluatedAt: "2026-07-23T00:00:00.000Z",
      contractor: {
        id: "archived-1",
        companyName: "Mr K",
        name: "Mr K",
        archived: true,
        status: "archived",
        readinessScore: 100,
        complianceStatus: "complete",
        overallStatus: "Approved / Compliant",
        legalName: "Mr K",
        taxpayerName: "Chadwin",
        csdMNumber: "MISREPRESENT",
      },
      documents: docs,
    });

    expect(decision.archived).toBe(true);
    expect(decision.assignmentAllowed).toBe(false);
    expect(decision.readinessDecisionStatus).toBe("BLOCKED");
    expect(decision.readinessScore).toBeNull();
    expect(decision.blockingReasons).toContain("Contractor is archived and cannot receive new assignments.");
    expect(decision.historicalDecision.readinessScore).toBe(100);
    expect(getContractorRepositoryStatusLabel(decision)).toBe("Archived / Assignment blocked");
  });

  test("the onboarding API exposes historical deal references separately", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/api/contractors/[contractorId]/onboarding/route.ts"), "utf8");
    expect(source).toContain("historicalDealCount");
    expect(source).toContain("containsContractorReference");
  });

  test("profile presentation does not use raw invalid CSD or raw SARS identity match as current authority", () => {
    const profile = readFileSync(path.join(process.cwd(), "src/components/contractors/ContractorOnboardingView.tsx"), "utf8");
    const card = readFileSync(path.join(process.cwd(), "src/components/contractors/ContractorBusinessIdCard.tsx"), "utf8");
    const sars = readFileSync(path.join(process.cwd(), "src/components/contractors/SarsTcsVerificationCard.tsx"), "utf8");
    expect(profile).toContain('csdValidationStatus === "VALID"');
    expect(card).toContain("validateCsdSupplierNumber");
    expect(sars).toContain("identityMatchStatus");
  });
});
