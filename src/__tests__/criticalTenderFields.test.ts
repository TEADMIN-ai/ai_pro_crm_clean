import {
  CRITICAL_TENDER_FIELDS,
  CRITICAL_TENDER_FIELD_LABELS,
  getCriticalTenderMissingFields,
} from "@/lib/tender/criticalTenderFields";

describe("criticalTenderFields", () => {
  test("returns only the configured critical tender fields in canonical order", () => {
    expect(
      getCriticalTenderMissingFields([
        "companyName",
        "address",
        "taxPin",
        "email",
        "vatNumber",
        "csdNumber",
      ])
    ).toEqual(CRITICAL_TENDER_FIELDS);
  });

  test("exposes human-readable labels for each critical field", () => {
    expect(CRITICAL_TENDER_FIELD_LABELS.vatNumber).toBe("VAT Number");
    expect(CRITICAL_TENDER_FIELD_LABELS.taxPin).toBe("Tax Pin");
    expect(CRITICAL_TENDER_FIELD_LABELS.csdNumber).toBe("CSD Number");
    expect(CRITICAL_TENDER_FIELD_LABELS.address).toBe("Address");
  });
});
