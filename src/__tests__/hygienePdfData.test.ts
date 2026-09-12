import { getHygieneManifestPdfData } from "@/lib/hygiene/hygienePdfData";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: jest.fn(),
}));

const user = { uid: "admin-1", email: "admin@example.test", role: "admin" as const };

const client = {
  clientId: "TE-CLI-1",
  clientName: "CBAVO Services",
  clientType: "Hygiene Client",
  companyRegistration: "2024/105084/07",
  primaryContactName: "Ops",
  primaryContactPhone: "069 000 0000",
  primaryContactEmail: "ops@example.test",
  billingContact: "Ops",
  contractStartDate: "2026-07-01",
  contractEndDate: "2027-07-01",
  serviceFrequency: "Weekly",
  collectionDay: "Friday",
  collectionWindow: "After 13:00",
  paymentStatus: "Paid",
  status: "Active",
  monthlyRevenue: 2100,
  recordClassification: "PRODUCTION",
  createdAt: "2026-07-01",
  updatedAt: "2026-07-01",
};

const site = {
  siteId: "TE-SIT-1",
  clientId: client.clientId,
  siteName: "Goldman Crossing",
  address: "1 Goldman Street",
  suburb: "Florida",
  city: "Roodepoort",
  contactPerson: "Site Manager",
  contactPhone: "069 111 1111",
  binCount: 4,
  binSize: "12L",
  serviceFrequency: "Weekly",
  accessNotes: "Reception access",
  lastServiceDate: null,
  nextServiceDate: "2026-07-10",
  status: "Active",
};

const collection = {
  collectionId: "TE-COL-2026-0001",
  clientId: client.clientId,
  siteId: site.siteId,
  scheduledDate: "2026-07-10",
  scheduledTimeWindow: "After 13:00",
  assignedDriver: "Driver One",
  vehicleRegistration: "TE 01 GP",
  vehicleName: "Hygiene Vehicle",
  status: "Completed",
  arrivalTime: "2026-07-10T10:00:00.000Z",
  departureTime: "2026-07-10T10:30:00.000Z",
  completedAt: "2026-07-10T10:30:00.000Z",
  manifestId: "TE-WM-2026-0001",
  evidencePhotoIds: [],
  clientSignatureStatus: "Captured",
  notes: "Operational collection update.",
  workflowSteps: [],
};

const manifest = {
  manifestId: "TE-WM-2026-0001",
  collectionId: collection.collectionId,
  clientId: client.clientId,
  siteId: site.siteId,
  generatorRegistration: "GPG-15-793",
  transportRegistration: "GPT-15-858",
  wasteClassification: "HW19",
  wasteType: "Sanitary/Feminine Hygiene Waste",
  quantity: 4,
  unit: "12L bins",
  collectionDate: "2026-07-10",
  collectedBy: "Driver One",
  vehicleRegistration: "TE 01 GP",
  disposalFacility: "Approved Disposal Facility",
  disposalDate: "2026-07-11",
  disposalCertificateNo: "CERT-2026-77",
  status: "Certified",
  createdAt: "2026-07-10T10:31:00.000Z",
  updatedAt: "2026-07-11T12:00:00.000Z",
};

function firestore(overrides: Record<string, Record<string, unknown> | unknown[]> = {}) {
  const collections: Record<string, Record<string, unknown> | unknown[]> = {
    hygieneManifests: { [manifest.manifestId]: manifest },
    hygieneCollections: { [collection.collectionId]: collection },
    hygieneClients: { [client.clientId]: client },
    hygieneSites: { [site.siteId]: site },
    hygieneEvidence: [],
    hygieneComplianceDocuments: [],
    hygieneSignatures: [],
    ...overrides,
  };

  return {
    collection: jest.fn((name: string) => ({
      doc: jest.fn((id: string) => ({
        get: jest.fn().mockResolvedValue({
          exists: !Array.isArray(collections[name]) && Boolean((collections[name] as Record<string, unknown>)?.[id]),
          data: () => !Array.isArray(collections[name]) ? (collections[name] as Record<string, unknown>)?.[id] : undefined,
        }),
      })),
      get: jest.fn().mockResolvedValue({
        docs: Array.isArray(collections[name])
          ? (collections[name] as unknown[]).map((record) => ({ data: () => record }))
          : Object.values(collections[name] ?? {}).map((record) => ({ data: () => record })),
      }),
    })),
  };
}

describe("getHygieneManifestPdfData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves PDF content from canonical persisted records only", async () => {
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore());

    const data = await getHygieneManifestPdfData(user, manifest.manifestId);

    expect(data.manifest.manifestId).toBe(manifest.manifestId);
    expect(data.client.clientName).toBe(client.clientName);
    expect(data.site.siteName).toBe(site.siteName);
    expect(data.collection.collectionId).toBe(collection.collectionId);
  });

  it("rejects guessed or nonexistent manifest IDs", async () => {
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore());

    await expect(getHygieneManifestPdfData(user, "TE-WM-MISSING")).rejects.toThrow("Hygiene manifest was not found.");
  });

  it("rejects tampered persisted relationships before PDF generation", async () => {
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore({
      hygieneCollections: {
        [collection.collectionId]: { ...collection, clientId: "OTHER-CLIENT" },
      },
    }));

    await expect(getHygieneManifestPdfData(user, manifest.manifestId)).rejects.toThrow("Hygiene manifest client relationship is invalid.");
  });

  it("preserves pending disposal and certificate fields without fabricating evidence", async () => {
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore({
      hygieneManifests: {
        [manifest.manifestId]: { ...manifest, disposalFacility: "Disposal facility not yet captured", disposalDate: null, disposalCertificateNo: "Disposal certificate pending", status: "Disposal Pending" },
      },
    }));

    const data = await getHygieneManifestPdfData(user, manifest.manifestId);

    expect(data.manifest.disposalFacility).toBe("Disposal facility not yet captured");
    expect(data.manifest.disposalDate).toBeNull();
    expect(data.manifest.disposalCertificateNo).toBe("Disposal certificate pending");
    expect(data.disposalEvidence).toEqual([]);
  });

  it("does not attach unrelated or weakly matched disposal evidence", async () => {
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore({
      hygieneEvidence: [
        { photoId: "TE-EP-OTHER", clientId: client.clientId, siteId: site.siteId, collectionId: "OTHER-COL", manifestId: manifest.manifestId, category: "Disposal Certificate", uploadedBy: "ops", uploadedAt: "2026-07-11", fileUrl: "hygiene/evidence/TE-CLI-1/OTHER-COL/cert.pdf", storagePath: "hygiene/evidence/TE-CLI-1/OTHER-COL/cert.pdf", timestampFromImage: null, notes: "Other collection" },
      ],
      hygieneComplianceDocuments: [
        { documentId: "TE-HC-OTHER", documentType: "Disposal Certificates", title: "Other certificate", registrationNumber: "OTHER-CERT", issueDate: null, expiryDate: null, status: "Active", fileUrl: null, owner: client.clientName, uploadedAt: "2026-07-11", storagePath: "hygiene/compliance/TE-HC-OTHER/cert.pdf" },
      ],
    }));

    const data = await getHygieneManifestPdfData(user, manifest.manifestId);

    expect(data.disposalEvidence).toEqual([]);
  });
});
