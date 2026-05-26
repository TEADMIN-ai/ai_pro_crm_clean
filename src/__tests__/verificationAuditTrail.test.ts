import { applyVerificationAuditTrail } from "@/lib/documents/verificationAuditTrail";

describe("verificationAuditTrail", () => {
  test("skips duplicate AI verification reruns with identical state", () => {
    const result = applyVerificationAuditTrail({
      existingAuditTrail: [
        {
          action: "verified",
          by: "ai@system",
          at: "2026-05-22T10:00:00.000Z",
          source: "ai_verification",
          verificationStatus: "PASS",
          aiStatus: "complete",
          extractedFieldsSignature: "{\"companyName\":\"Torque Empire\",\"registrationNumber\":\"123\"}",
        },
      ],
      metadata: {
        verified: true,
        validationStatus: "PASS",
        aiStatus: "complete",
        extractedFields: {
          companyName: "Torque Empire",
          registrationNumber: "123",
        },
      },
      candidate: {
        actor: "ai@system",
        at: "2026-05-22T10:01:00.000Z",
        source: "ai_verification",
        verificationStatus: "PASS",
        aiStatus: "complete",
        extractedFields: {
          companyName: "Torque Empire",
          registrationNumber: "123",
        },
      },
    });

    expect(result.skippedDuplicate).toBe(true);
    expect(result.duplicateReason).toBe("exact_match");
    expect(result.auditTrail).toHaveLength(1);
  });

  test("skips ambiguous replay when identical verification state reappears immediately from a different source", () => {
    const result = applyVerificationAuditTrail({
      existingAuditTrail: [
        {
          action: "verified",
          by: "ai@system",
          at: "2026-05-22T10:00:00.000Z",
          source: "ai_verification",
          verificationStatus: "PASS",
          aiStatus: "complete",
          extractedFieldsSignature: "{\"companyName\":\"Torque Empire\"}",
        },
      ],
      metadata: {
        verified: true,
        validationStatus: "PASS",
        aiStatus: "complete",
        extractedFields: {
          companyName: "Torque Empire",
        },
      },
      candidate: {
        actor: "reviewer@example.com",
        at: "2026-05-22T10:01:00.000Z",
        source: "manual_verification",
        verificationStatus: "PASS",
        aiStatus: "complete",
        extractedFields: {
          companyName: "Torque Empire",
        },
      },
    });

    expect(result.skippedDuplicate).toBe(true);
    expect(result.duplicateReason).toBe("ambiguous_replay");
    expect(result.auditTrail).toHaveLength(1);
  });

  test("appends when extracted verification output changes", () => {
    const result = applyVerificationAuditTrail({
      existingAuditTrail: [
        {
          action: "verified",
          by: "ai@system",
          at: "2026-05-22T10:00:00.000Z",
          source: "ai_verification",
          verificationStatus: "PASS",
          aiStatus: "complete",
          extractedFieldsSignature: "{\"companyName\":\"Torque Empire\",\"registrationNumber\":\"123\"}",
        },
      ],
      metadata: {
        verified: true,
        validationStatus: "PASS",
        aiStatus: "complete",
        extractedFields: {
          companyName: "Torque Empire",
          registrationNumber: "123",
        },
      },
      candidate: {
        actor: "ai@system",
        at: "2026-05-22T10:12:00.000Z",
        source: "ai_verification",
        verificationStatus: "PASS",
        aiStatus: "complete",
        extractedFields: {
          companyName: "Torque Empire Holdings",
          registrationNumber: "123",
        },
      },
    });

    expect(result.skippedDuplicate).toBe(false);
    expect(result.appended).toBe(true);
    expect(result.auditTrail).toHaveLength(2);
  });
});
