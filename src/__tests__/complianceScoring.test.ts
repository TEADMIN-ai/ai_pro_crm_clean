import { analyzeComplianceDocument } from "@/lib/compliance/analyzeComplianceDocument";
import {
  computeAggregateComplianceScore,
  computeComplianceScore,
  resolveComplianceExpiryAlert,
} from "@/lib/compliance/complianceScoring";
import type { ContractorDocument } from "@/types/document";

describe("compliance scoring", () => {
  test("creates an expiring soon alert when expiry is inside the warning window", () => {
    const now = Date.UTC(2026, 2, 16);
    const expiry = now + 10 * 24 * 60 * 60 * 1000;

    expect(resolveComplianceExpiryAlert(expiry, now)).toEqual({
      state: "expiringSoon",
      daysUntilExpiry: 10,
      message: "Compliance document expires in 10 day(s).",
    });
  });

  test("scores compliance states by verification strength", () => {
    expect(computeComplianceScore({ status: "verified", confidenceScore: 1 })).toBe(100);
    expect(computeComplianceScore({ status: "expiringSoon", confidenceScore: 0.5 })).toBe(70);
    expect(computeComplianceScore({ status: "uploaded", confidenceScore: 0.4 })).toBe(35);
    expect(computeComplianceScore({ status: "expired", confidenceScore: 1 })).toBe(0);
  });

  test("aggregates persisted document compliance scores", () => {
    const documents: ContractorDocument[] = [
      { id: "1", contractorId: "c1", complianceScore: 100, status: "verified" },
      { id: "2", contractorId: "c1", complianceScore: 70, status: "expiringSoon" },
      { id: "3", contractorId: "c1", complianceScore: 0, status: "expired" },
    ];

    expect(computeAggregateComplianceScore(documents)).toBe(57);
  });

  test("analysis output includes compliance metadata for expiry-aware documents", () => {
    const result = analyzeComplianceDocument(
      "taxClearance",
      [
        "Tax Compliance Status Pin: ABC12345",
        "Taxpayer Name: Demo Trading",
        "Valid Until: 31/12/2099",
      ].join("\n"),
    );

    expect(result.complianceType).toBe("taxClearance");
    expect(typeof result.expiryDate).toBe("number");
    expect(result.expiryAlert).toBe("none");
    expect(result.complianceScore).toBeGreaterThan(0);
  });
});
