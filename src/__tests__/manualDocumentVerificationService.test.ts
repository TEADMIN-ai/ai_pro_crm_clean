import type { AuthorizedUser } from "@/lib/server/authz";
import { applyManualDocumentVerification } from "@/server/services/manualDocumentVerificationService";

const getContractorDocument = jest.fn();
const upsertContractorDocument = jest.fn();
const recordAuditLog = jest.fn();
const recalculateContractorCompliance = jest.fn();
const getFirebaseAdmin = jest.fn();

jest.mock("@/server/services/contractorService", () => ({
  getContractorDocument: (...args: unknown[]) => getContractorDocument(...args),
  upsertContractorDocument: (...args: unknown[]) => upsertContractorDocument(...args),
}));

jest.mock("@/server/services/auditLogService", () => ({
  recordAuditLog: (...args: unknown[]) => recordAuditLog(...args),
}));

jest.mock("@/lib/server/recalculateContractorCompliance", () => ({
  recalculateContractorCompliance: (...args: unknown[]) => recalculateContractorCompliance(...args),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

describe("manualDocumentVerificationService", () => {
  const actor: AuthorizedUser = {
    uid: "reviewer-1",
    email: "reviewer@example.com",
    role: "manager",
  };

  beforeEach(() => {
    getFirebaseAdmin.mockReset();
    getContractorDocument.mockReset();
    upsertContractorDocument.mockReset();
    recordAuditLog.mockReset();
    recalculateContractorCompliance.mockReset();

    getFirebaseAdmin.mockReturnValue({ db: "mock" });
    recordAuditLog.mockResolvedValue({
      id: "audit-1",
      userId: actor.uid,
      action: "MANUAL_VERIFICATION_APPROVED",
      entityType: "document",
      entityId: "cipc",
      timestamp: new Date().toISOString(),
    });

    getContractorDocument
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          contractorId: "contractor-1",
          documentType: "cipc",
          validationStatus: "REVIEW",
          status: "uploaded",
          fileUrl: "https://example.com/doc.pdf",
          auditTrail: [{ action: "uploaded", by: "system", at: "2026-03-20T10:00:00.000Z" }],
        }),
      })
      .mockResolvedValueOnce({
        id: "cipc",
        data: () => ({
          contractorId: "contractor-1",
          documentType: "cipc",
          validationStatus: "PASS",
          status: "verified",
          verified: true,
          verifiedAt: "2026-03-23T10:00:00.000Z",
          verifiedBy: actor.email,
          reviewedBy: actor.email,
          fileUrl: "https://example.com/doc.pdf",
        }),
      });
  });

  test("REVIEW document can be manually approved and audit logged", async () => {
    const document = await applyManualDocumentVerification({
      contractorId: "contractor-1",
      documentType: "cipc",
      action: "approve",
      actor,
      reviewReason: "Verified against source document",
    });

    expect(upsertContractorDocument).toHaveBeenCalledWith(
      "contractor-1",
      "cipc",
      expect.objectContaining({
        validationStatus: "PASS",
        status: "verified",
        verified: true,
        verifiedBy: actor.email,
        verifiedAt: expect.any(String),
        manualDecisionAvailable: false,
        auditTrail: expect.arrayContaining([
          expect.objectContaining({ action: "uploaded", by: "system" }),
          expect.objectContaining({ action: "verified", by: actor.email }),
        ]),
      })
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "reviewer-1",
        action: "MANUAL_VERIFICATION_APPROVED",
        entityType: "document",
        entityId: "cipc",
        metadata: expect.objectContaining({
          previousStatus: "REVIEW",
          newStatus: "PASS",
          reviewReason: "Verified against source document",
        }),
      })
    );
    expect(recalculateContractorCompliance).toHaveBeenCalled();
    expect(document.validationStatus).toBe("PASS");
    expect(document.verified).toBe(true);
    expect(document.verifiedBy).toBe(actor.email);
  });

  test("REVIEW document can be manually rejected and audit logged", async () => {
    getContractorDocument
      .mockReset()
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          contractorId: "contractor-1",
          documentType: "cipc",
          validationStatus: "REVIEW",
          status: "uploaded",
          fileUrl: "https://example.com/doc.pdf",
        }),
      })
      .mockResolvedValueOnce({
        id: "cipc",
        data: () => ({
          contractorId: "contractor-1",
          documentType: "cipc",
          validationStatus: "FAIL",
          status: "invalid",
          verified: false,
          validationError: "Registration number mismatch",
          fileUrl: "https://example.com/doc.pdf",
        }),
      });

    await applyManualDocumentVerification({
      contractorId: "contractor-1",
      documentType: "cipc",
      action: "reject",
      actor,
      reviewReason: "Registration number mismatch",
    });

    expect(upsertContractorDocument).toHaveBeenCalledWith(
      "contractor-1",
      "cipc",
      expect.objectContaining({
        validationStatus: "FAIL",
        status: "invalid",
        verified: false,
        validationError: "Registration number mismatch",
      })
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MANUAL_VERIFICATION_REJECTED",
        metadata: expect.objectContaining({
          previousStatus: "REVIEW",
          newStatus: "FAIL",
          reviewReason: "Registration number mismatch",
        }),
      })
    );
  });
});
