import { buildEmpirePdfContractorSignaturePayload } from "@/lib/empirePdf/contractorSignaturePayload";

describe("contractor signature payload", () => {
  test("exposes a stable EmpirePDF-compatible signature payload", () => {
    const payload = buildEmpirePdfContractorSignaturePayload({
      contractorId: "contractor-1",
      acknowledgementId: "ack-1",
      signatureText: "Jane Director",
      signedByName: "Jane Director",
      signedByCapacity: "Managing Director",
      signedAt: "2026-06-01T10:00:00.000Z",
      acknowledgementVersion: "contractor-onboarding-v1",
      userUid: "uid-1",
    });

    expect(payload).toEqual({
      contractorId: "contractor-1",
      acknowledgementId: "ack-1",
      signatureText: "Jane Director",
      signedByName: "Jane Director",
      signedByCapacity: "Managing Director",
      signedAt: "2026-06-01T10:00:00.000Z",
      acknowledgementVersion: "contractor-onboarding-v1",
      userUid: "uid-1",
    });
  });

  test("keeps missing signatures explicit", () => {
    expect(buildEmpirePdfContractorSignaturePayload(null)).toBeNull();
  });
});
