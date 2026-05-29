import { EMPIRE_PDF_QA_SCENARIOS } from "@/lib/empirePdf/qa/scenarios";

describe("EmpirePDF visual QA scenarios", () => {
  test("cover baseline, short, long, foreign, signature stress, and address stress cases", () => {
    const ids = EMPIRE_PDF_QA_SCENARIOS.map((scenario) => scenario.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "baseline_local_pty",
        "short_name_micro_supplier",
        "long_legal_name_enterprise",
        "foreign_supplier_edge_case",
        "signature_overflow_stress",
        "address_overflow_stress",
      ])
    );
  });

  test("include materially different company-name lengths", () => {
    const lengths = EMPIRE_PDF_QA_SCENARIOS.map((scenario) => scenario.profile.companyName.length);
    expect(Math.min(...lengths)).toBeLessThanOrEqual(10);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(70);
  });

  test("include explicit foreign and local supplier cases", () => {
    const countries = EMPIRE_PDF_QA_SCENARIOS.map((scenario) => scenario.profile.country);
    expect(countries).toContain("South Africa");
    expect(countries).toContain("Namibia");
  });

  test("include long signature-role stress coverage", () => {
    const longestRole = Math.max(
      ...EMPIRE_PDF_QA_SCENARIOS.map((scenario) => scenario.profile.signatoryRole?.length ?? 0)
    );

    expect(longestRole).toBeGreaterThanOrEqual(60);
  });
});
