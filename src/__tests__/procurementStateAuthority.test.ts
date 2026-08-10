import {
  ProcurementStateAuthorityError,
  assertNoGovernedProcurementMutation,
  buildSafeDealMetadataPatch,
  containsGovernedProcurementMutation,
  normalizeSubmissionEvidence,
} from "@/lib/procurement/procurementStateAuthority";

describe("procurement state authority", () => {
  it.each(["submitted", "approved", "rejected", "awarded", "lost"])(
    "blocks generic deal PATCH from setting %s",
    (status) => {
      expect(() => assertNoGovernedProcurementMutation({ status })).toThrow(ProcurementStateAuthorityError);
      expect(containsGovernedProcurementMutation({ status })).toBe(true);
    },
  );

  it("allows safe non-governed metadata PATCH fields", () => {
    expect(
      buildSafeDealMetadataPatch({
        notes: "Call client on Monday",
        internalDescription: "Internal RFQ review note",
        random: "ignored",
      }),
    ).toEqual({
      notes: "Call client on Monday",
      internalDescription: "Internal RFQ review note",
    });
  });

  it("rejects arbitrary submission objects as durable evidence", () => {
    expect(
      normalizeSubmissionEvidence({
        submittedAt: "2026-08-10T10:00:00.000Z",
        uiConfirmed: true,
      }),
    ).toEqual({
      valid: false,
      reason: "Durable submission evidence is required before marking an opportunity submitted.",
      evidenceReferences: {},
    });
  });

  it("accepts persisted submission evidence references", () => {
    expect(
      normalizeSubmissionEvidence({
        tenderPackId: "TP-001",
        submissionDocumentId: "DOC-001",
        submittedBy: "user-1",
      }),
    ).toEqual({
      valid: true,
      reason: null,
      evidenceReferences: {
        tenderPackId: "TP-001",
        submissionDocumentId: "DOC-001",
      },
    });
  });

  it("does not treat empty evidence fields as durable evidence", () => {
    expect(normalizeSubmissionEvidence({ tenderPackId: " " }).valid).toBe(false);
  });
});
