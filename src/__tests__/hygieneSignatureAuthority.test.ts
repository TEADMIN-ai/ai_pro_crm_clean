jest.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP") } }));
jest.mock("@/lib/firebase/sanitizeFirestoreData", () => ({ sanitizeFirestoreData: (value: unknown) => value }));
jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: jest.fn() }));

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { completeHygieneDriverAction, createHygieneSignature } from "@/lib/hygiene/hygieneService";

type Store = Record<string, Record<string, Record<string, unknown>>>;
const user = { uid: "driver-1", email: "driver@example.invalid", role: "admin" as const };
function installFirestore(store: Store) {
  const collection = jest.fn((name: string) => ({
    doc: (id: string) => ({
      get: jest.fn().mockResolvedValue({ exists: Boolean(store[name]?.[id]), data: () => store[name]?.[id] }),
      set: jest.fn().mockImplementation(async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
        store[name] = store[name] ?? {};
        store[name][id] = options?.merge ? { ...(store[name][id] ?? {}), ...payload } : payload;
      }),
    }),
    get: jest.fn().mockResolvedValue({ docs: Object.values(store[name] ?? {}).map((data) => ({ data: () => data })) }),
  }));
  (getFirebaseAdmin as jest.Mock).mockReturnValue({ collection });
}

const client = { clientId: "TE-CLI-1", clientName: "Real Client", clientType: "Hygiene", companyRegistration: "REG", primaryContactName: "Ops", primaryContactPhone: "1", primaryContactEmail: "ops@client.co.za", billingContact: "Ops", contractStartDate: "2026-01-01", contractEndDate: "2026-12-31", serviceFrequency: "Weekly", collectionDay: "Friday", collectionWindow: "After 13:00", paymentStatus: "Paid", status: "Active", monthlyRevenue: 1, recordClassification: "PRODUCTION", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const evidenceEvents = {
  before: { eventId: "E1", eventType: "evidence_uploaded", clientId: "TE-CLI-1", siteId: "TE-SIT-1", collectionId: "TE-COL-1", manifestId: null, userId: "driver-1", userEmail: "driver@example.invalid", timestamp: "2026-08-07T10:00:00.000Z", notes: "Before", metadata: { category: "Bin Before Service" } },
  after: { eventId: "E2", eventType: "evidence_uploaded", clientId: "TE-CLI-1", siteId: "TE-SIT-1", collectionId: "TE-COL-1", manifestId: null, userId: "driver-1", userEmail: "driver@example.invalid", timestamp: "2026-08-07T10:10:00.000Z", notes: "After", metadata: { category: "Completion Photo" } },
};
function collection(overrides: Record<string, unknown> = {}) {
  return { collectionId: "TE-COL-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1", scheduledDate: "2026-08-07", scheduledTimeWindow: "After 13:00", assignedDriver: "Driver", assignedUserIds: ["driver-1"], vehicleRegistration: "TE-REG", vehicleName: "Truck", status: "In Progress", arrivalTime: null, departureTime: null, completedAt: null, manifestId: "Pending", evidencePhotoIds: [], clientSignatureStatus: "Pending", notes: "Collection", workflowSteps: [], completedSteps: ["job-accepted", "travelling-to-site", "arrived-on-site", "waste-collection", "bin-serviced", "evidence-photos-captured", "customer-signature", "waste-loaded", "disposal-facility-confirmation"], currentStep: "job-completed", progressPercentage: 90, stepTimestamps: {}, binCountConfirmed: 1, ...overrides };
}
function signature(overrides: Record<string, unknown> = {}) {
  return { signatureId: "TE-SIG-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1", collectionId: "TE-COL-1", manifestId: null, representativeName: "Customer Rep", representativePosition: "Manager", signatureFileUrl: "https://storage.example/signature.png", signatureStoragePath: "hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png", capturedBy: "driver@example.invalid", capturedAt: "2026-08-07T10:20:00.000Z", ...overrides };
}
describe("hygiene signature service authority", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  function baseStore(activeCollection: Record<string, unknown>, signatures: Record<string, Record<string, unknown>> = {}) {
    return { hygieneClients: { "TE-CLI-1": client }, hygieneCollections: { "TE-COL-1": activeCollection }, hygieneJobEvents: evidenceEvents, hygieneSignatures: signatures } as Store;
  }
  it("generic capture-signature cannot satisfy the signature gate", async () => {
    installFirestore(baseStore(collection({ currentStep: "customer-signature", completedSteps: ["job-accepted", "travelling-to-site", "arrived-on-site", "waste-collection", "bin-serviced", "evidence-photos-captured"] })));
    await expect(completeHygieneDriverAction(user, { collectionId: "TE-COL-1", action: "capture-signature" })).rejects.toMatchObject({ code: "hygiene_signature_evidence_required" });
  });
  it("rejects completion without a persisted signature record", async () => {
    installFirestore(baseStore(collection({ clientSignatureStatus: "Signature captured" })));
    await expect(completeHygieneDriverAction(user, { collectionId: "TE-COL-1", action: "complete-job" })).rejects.toMatchObject({ code: "hygiene_workflow_missing_persisted_signature" });
  });
  it("rejects signature records linked to a different collection", async () => {
    installFirestore(baseStore(collection({ clientSignatureId: "TE-SIG-1", clientSignatureStoragePath: "hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png" }), { "TE-SIG-1": signature({ collectionId: "TE-COL-2" }) }));
    await expect(completeHygieneDriverAction(user, { collectionId: "TE-COL-1", action: "complete-job" })).rejects.toMatchObject({ code: "hygiene_workflow_signature_collection_mismatch" });
  });
  it("allows completion when persisted signature evidence reloads for the same collection", async () => {
    const active = collection({ clientSignatureId: "TE-SIG-1", clientSignatureStoragePath: "hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png" });
    const store = baseStore(active, { "TE-SIG-1": signature() });
    installFirestore(store);
    const event = await completeHygieneDriverAction(user, { collectionId: "TE-COL-1", action: "complete-job" });
    expect(event.eventType).toBe("job_completed");
    expect(store.hygieneCollections["TE-COL-1"].status).toBe("Completed");
  });
  it("createHygieneSignature persists and reloads evidence linked to the exact collection", async () => {
    const store = baseStore(collection());
    installFirestore(store);
    await createHygieneSignature(user, { signatureId: "TE-SIG-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1", collectionId: "TE-COL-1", manifestId: null, representativeName: "Customer Rep", representativePosition: "Manager", signatureFileUrl: "https://storage.example/signature.png", signatureStoragePath: "hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png" });
    expect(store.hygieneSignatures["TE-SIG-1"].collectionId).toBe("TE-COL-1");
    expect(store.hygieneCollections["TE-COL-1"].clientSignatureId).toBe("TE-SIG-1");
    expect(store.hygieneCollections["TE-COL-1"].clientSignatureStoragePath).toBe("hygiene/signatures/TE-CLI-1/TE-COL-1/TE-SIG-1.png");
  });
});
