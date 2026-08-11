import { evaluateContractorReadiness, resolveCanonicalContractor } from "@/lib/contractors/governedContractorResolution";

describe("governed contractor resolution", () => {
  const records = [{ id: "R1", legalName: "TORQUE EMPIRE (PTY) LTD", tradingName: "Torque Empire", registrationNumber: "2024/105084/07", csdNumber: "MAAA1740658", workspaceId: "w1" }];

  test("resolves canonical ID, registration number, and CSD identity", () => {
    expect(resolveCanonicalContractor({ reference: "R1", workspaceId: "w1", records }).contractorId).toBe("R1");
    expect(resolveCanonicalContractor({ registrationNumber: "2024/105084/07", workspaceId: "w1", records }).contractorId).toBe("R1");
    expect(resolveCanonicalContractor({ csdNumber: "MAAA1740658", workspaceId: "w1", records }).contractorId).toBe("R1");
  });

  test("does not auto-resolve ambiguous or name-only identity", () => {
    expect(resolveCanonicalContractor({ tradingName: "Torque Empire", workspaceId: "w1", records }).status).toBe("REVIEW_REQUIRED");
    expect(resolveCanonicalContractor({ legalName: "Unknown", workspaceId: "w1", records }).status).toBe("UNRESOLVED");
    expect(resolveCanonicalContractor({ tradingName: "Torque Empire", workspaceId: "w1", records: [...records, { ...records[0], id: "R2" }] }).status).toBe("REVIEW_REQUIRED");
  });

  test("typed identifiers without governed evidence do not satisfy readiness", () => {
    const result = evaluateContractorReadiness({ requiredTypes: ["CIPC", "CSD", "SARS_TCS"], evidence: [], now: new Date("2026-08-11T00:00:00Z") });
    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toEqual(expect.arrayContaining(["CIPC_EVIDENCE_MISSING", "CSD_EVIDENCE_MISSING", "SARS_TCS_EVIDENCE_MISSING"]));
  });

  test("current governed evidence passes and expired evidence blocks", () => {
    const evidence = ["CIPC", "CSD", "SARS_TCS"].map((complianceType) => ({ complianceType, documentId: `DOC-${complianceType}`, verificationStatus: "VERIFIED", currentStatus: "CURRENT", issueDate: "2026-08-11", expiryDate: "2026-09-30" }));
    expect(evaluateContractorReadiness({ requiredTypes: ["CIPC", "CSD", "SARS_TCS"], evidence, now: new Date("2026-08-11T00:00:00Z") }).status).toBe("READY");
    expect(evaluateContractorReadiness({ requiredTypes: ["CIPC", "CSD", "SARS_TCS"], evidence: evidence.map((item) => item.complianceType === "SARS_TCS" ? { ...item, expiryDate: "2026-08-10" } : item), now: new Date("2026-08-11T00:00:00Z") }).blockers).toContain("SARS_TCS_EVIDENCE_EXPIRED");
  });

  test("opportunity-specific CSD freshness is enforced", () => {
    const evidence = ["CIPC", "SARS_TCS"].map((complianceType) => ({ complianceType, documentId: `DOC-${complianceType}`, verificationStatus: "VERIFIED", currentStatus: "CURRENT", issueDate: "2026-08-11", expiryDate: "2026-09-30" }));
    const csd = { complianceType: "CSD", documentId: "DOC-CSD", verificationStatus: "VERIFIED", currentStatus: "CURRENT", issueDate: "2026-08-11", expiryDate: "2026-09-30" };
    expect(evaluateContractorReadiness({ requiredTypes: ["CIPC", "CSD", "SARS_TCS"], evidence: [...evidence, csd], csdMaxAgeDays: 30, now: new Date("2026-09-04T00:00:00Z") }).status).toBe("READY");
    expect(evaluateContractorReadiness({ requiredTypes: ["CIPC", "CSD", "SARS_TCS"], evidence: [...evidence, { ...csd, issueDate: "2026-07-01" }], csdMaxAgeDays: 30, now: new Date("2026-09-04T00:00:00Z") }).blockers).toContain("CSD_EVIDENCE_TOO_OLD");
  });
});
