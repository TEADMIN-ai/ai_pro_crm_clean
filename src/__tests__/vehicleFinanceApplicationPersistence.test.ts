const getFirebaseAdmin = jest.fn();
const getFirebaseStorageBucket = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
  getFirebaseStorageBucket: () => getFirebaseStorageBucket(),
}));

jest.mock("@/lib/pdf/extractTextFromPdf", () => ({
  extractTextFromPdfDetailed: jest.fn(),
}));

jest.mock("@/lib/vehicle-finance/config/featureFlags", () => ({
  getVehicleFinanceFeatureFlags: () => ({
    ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE: false,
  }),
}));

jest.mock("@/lib/vehicle-finance/intelligence/driverLicenceIntelligenceJobs", () => ({
  queueVehicleFinanceDriverLicenceIntelligence: jest.fn(),
}));

jest.mock("@/lib/vehicle-finance/intelligence/identityIntelligenceJobs", () => ({
  queueVehicleFinanceIdentityIntelligence: jest.fn(),
}));

jest.mock("@/lib/vehicle-finance/intelligence/payslipIntelligenceJobs", () => ({
  queueVehicleFinancePayslipIntelligence: jest.fn(),
}));

jest.mock("@/lib/vehicle-finance/intelligence/bankStatementIntelligenceJobs", () => ({
  queueVehicleFinanceBankStatementIntelligence: jest.fn(),
}));

import { createVehicleFinanceApplication } from "@/lib/vehicleFinance/vehicleFinanceService";
import { uploadVehicleFinanceDocument } from "@/lib/vehicleFinance/vehicleFinanceService";
import { extractTextFromPdfDetailed } from "@/lib/pdf/extractTextFromPdf";

type MockDoc = {
  id: string;
  data: () => Record<string, unknown>;
};

function createDb(options?: {
  existingApplications?: MockDoc[];
  failApplicationSet?: boolean;
  failApplicationSetOnce?: boolean;
  failAuditLog?: boolean;
}) {
  let applicationSetAttempts = 0;
  const applicationSet = jest.fn(async () => {
    applicationSetAttempts += 1;
    if (options?.failApplicationSetOnce && applicationSetAttempts === 1) throw new Error("transient firestore unavailable");
    if (options?.failApplicationSet) throw new Error("firestore unavailable");
  });
  const eventAdd = jest.fn(async () => ({ id: "event-1" }));
  const auditAdd = jest.fn(async () => {
    if (options?.failAuditLog) throw new Error("audit unavailable");
    return { id: "audit-1" };
  });
  const collection = jest.fn((name: string) => {
    if (name === "vehicleFinanceApplications") {
      return {
        doc: jest.fn(() => ({ set: applicationSet })),
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(async () => ({ docs: options?.existingApplications ?? [] })),
          })),
        })),
        limit: jest.fn(() => ({ get: jest.fn(async () => ({ docs: [] })) })),
      };
    }
    if (name === "vehicleFinanceApplicationEvents") {
      return { add: eventAdd };
    }
    if (name === "auditLogs") {
      return { add: auditAdd };
    }
    return { add: jest.fn(async () => ({ id: `${name}-1` })) };
  });

  const db: { collection: jest.Mock } = { collection };

  return {
    db,
    applicationSet,
    auditAdd,
    eventAdd,
  };
}

describe("vehicle finance application persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFirebaseStorageBucket.mockReturnValue({});
    jest.mocked(extractTextFromPdfDetailed).mockResolvedValue({
      text: "Valid uploaded finance document text with enough content for analysis.",
      directTextLength: 64,
      ocrTextLength: 0,
      pageCount: 1,
      source: "PDF_TEXT",
    });
  });

  test("returns a saved application when audit logging fails after the primary write", async () => {
    const { db, applicationSet, auditAdd, eventAdd } = createDb({ failAuditLog: true });
    getFirebaseAdmin.mockReturnValue(db);

    const application = await createVehicleFinanceApplication(
      {
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        clientSubmissionId: "submission-1",
        dealerName: "Roar Cars",
        dealValue: 250000,
      },
      { actorId: "staff-1", actorRole: "staff", actorName: "staff@example.com" },
    );

    expect(application.applicationId).toEqual(expect.any(String));
    expect(application.clientSubmissionId).toBe("submission-1");
    expect(application.isDeleted).toBe(false);
    expect(application.archived).toBe(false);
    expect(application.inactive).toBe(false);
    expect(applicationSet).toHaveBeenCalledTimes(1);
    expect(auditAdd).toHaveBeenCalledTimes(1);
    expect(eventAdd).toHaveBeenCalledWith(expect.objectContaining({ operation: "Audit Failed", applicationId: application.applicationId }));
  });

  test("reuses an existing application for duplicate client submissions", async () => {
    const existingRecord = {
      applicationId: "application-existing",
      customerId: "customer-1",
      vehicleId: "vehicle-1",
      clientSubmissionId: "submission-duplicate",
      dealerName: "Roar Cars",
      dealValue: 250000,
      applicationStatus: "NEW",
      fraudScore: 100,
      verificationStatus: "PENDING",
      createdAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:00:00.000Z",
    };
    const { db, applicationSet } = createDb({
      existingApplications: [{ id: "application-existing", data: () => existingRecord }],
    });
    getFirebaseAdmin.mockReturnValue(db);

    const application = await createVehicleFinanceApplication(
      {
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        clientSubmissionId: "submission-duplicate",
        dealerName: "Roar Cars",
        dealValue: 250000,
      },
      { actorId: "staff-1", actorRole: "staff" },
    );

    expect(application.applicationId).toBe("application-existing");
    expect(application.clientSubmissionId).toBe("submission-duplicate");
    expect(applicationSet).not.toHaveBeenCalled();
  });

  test("throws only when the primary Firestore application write fails", async () => {
    const { db, eventAdd } = createDb({ failApplicationSet: true });
    getFirebaseAdmin.mockReturnValue(db);

    await expect(
      createVehicleFinanceApplication(
        {
          customerId: "customer-1",
          vehicleId: "vehicle-1",
          clientSubmissionId: "submission-failed",
          dealerName: "Roar Cars",
          dealValue: 250000,
        },
        { actorId: "staff-1", actorRole: "staff" },
      ),
    ).rejects.toThrow("firestore unavailable");

    expect(eventAdd).toHaveBeenCalledWith(expect.objectContaining({ operation: "Application Create Failed", status: "failure" }));
  });

  test("retries a transient Firestore application write failure", async () => {
    const { db, applicationSet } = createDb({ failApplicationSetOnce: true });
    getFirebaseAdmin.mockReturnValue(db);

    const application = await createVehicleFinanceApplication(
      {
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        clientSubmissionId: "submission-retry",
        dealerName: "Roar Cars",
        dealValue: 250000,
      },
      { actorId: "staff-1", actorRole: "staff" },
    );

    expect(application.applicationId).toEqual(expect.any(String));
    expect(applicationSet).toHaveBeenCalledTimes(2);
  });

  test("records storage upload failure without creating a document record", async () => {
    const { db, eventAdd } = createDb();
    const documentSet = jest.fn();
    db.collection = jest.fn((name: string) => {
      if (name === "vehicleFinanceDocuments") {
        return { doc: jest.fn(() => ({ set: documentSet })) };
      }
      if (name === "vehicleFinanceApplicationEvents") {
        return { add: eventAdd };
      }
      return { add: jest.fn(async () => ({ id: `${name}-1` })) };
    });
    getFirebaseAdmin.mockReturnValue(db);
    getFirebaseStorageBucket.mockReturnValue({
      file: jest.fn(() => ({
        save: jest.fn(async () => {
          throw new Error("storage unavailable");
        }),
      })),
    });

    await expect(
      uploadVehicleFinanceDocument(
        {
          applicationId: "application-1",
          documentType: "payslip",
          fileName: "payslip.pdf",
          fileBuffer: Buffer.from("pdf"),
        },
        { actorId: "staff-1", actorRole: "staff" },
      ),
    ).rejects.toThrow("storage unavailable");

    expect(documentSet).not.toHaveBeenCalled();
    expect(eventAdd).toHaveBeenCalledWith(expect.objectContaining({ operation: "Storage Upload Failed", applicationId: "application-1" }));
  });
});
