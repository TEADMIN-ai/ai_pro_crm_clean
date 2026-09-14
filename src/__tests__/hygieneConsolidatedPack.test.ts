import { getConsolidatedHygieneClientPackData } from "@/lib/hygiene/hygieneConsolidatedPack";
import { getFirebaseAdmin } from "@/lib/firebase/adminFirestore";

jest.mock("@/lib/firebase/adminFirestore", () => ({
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

const otherClient = { ...client, clientId: "TE-CLI-2", clientName: "Other Client" };

const siteOne = {
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

const siteTwo = { ...siteOne, siteId: "TE-SIT-2", siteName: "Ontdekkers Campus", address: "Ontdekkers, Roodepoort", suburb: "Ontdekkers", nextServiceDate: "2026-07-20" };
const otherSite = { ...siteOne, siteId: "TE-SIT-X", clientId: otherClient.clientId, siteName: "Other Site" };

const collectionOne = {
  collectionId: "TE-COL-2026-0001",
  clientId: client.clientId,
  siteId: siteOne.siteId,
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

const collectionTwo = { ...collectionOne, collectionId: "TE-COL-2026-0002", siteId: siteTwo.siteId, scheduledDate: "2026-07-20", manifestId: "TE-WM-2026-0002" };
const collectionOld = { ...collectionOne, collectionId: "TE-COL-2026-OLD", scheduledDate: "2026-06-01", manifestId: "TE-WM-2026-OLD" };
const collectionOther = { ...collectionOne, collectionId: "TE-COL-X", clientId: otherClient.clientId, siteId: otherSite.siteId, manifestId: "TE-WM-X" };

const manifestOne = {
  manifestId: "TE-WM-2026-0001",
  collectionId: collectionOne.collectionId,
  clientId: client.clientId,
  siteId: siteOne.siteId,
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

const manifestTwo = {
  ...manifestOne,
  manifestId: "TE-WM-2026-0002",
  collectionId: collectionTwo.collectionId,
  siteId: siteTwo.siteId,
  quantity: 2,
  collectionDate: "2026-07-20",
  disposalFacility: "Disposal facility not yet captured",
  disposalDate: null,
  disposalCertificateNo: "Disposal certificate pending",
  status: "Disposal Pending",
};

const manifestOld = { ...manifestOne, manifestId: "TE-WM-2026-OLD", collectionId: collectionOld.collectionId, collectionDate: "2026-06-01" };
const manifestOther = { ...manifestOne, manifestId: "TE-WM-X", collectionId: collectionOther.collectionId, clientId: otherClient.clientId, siteId: otherSite.siteId };

const evidence = {
  photoId: "TE-EP-1",
  clientId: client.clientId,
  siteId: siteOne.siteId,
  collectionId: collectionOne.collectionId,
  manifestId: manifestOne.manifestId,
  category: "Disposal Certificate",
  uploadedBy: "ops",
  uploadedAt: "2026-07-11",
  fileUrl: "hygiene/evidence/TE-CLI-1/TE-COL-2026-0001/cert.pdf",
  storagePath: "hygiene/evidence/TE-CLI-1/TE-COL-2026-0001/cert.pdf",
  timestampFromImage: null,
  notes: "Certificate PDF",
};

function firestore(overrides: Record<string, unknown[]> = {}) {
  const collections: Record<string, unknown[]> = {
    hygieneClients: [client, otherClient],
    hygieneSites: [siteOne, siteTwo, otherSite],
    hygieneCollections: [collectionOne, collectionTwo, collectionOld, collectionOther],
    hygieneManifests: [manifestOne, manifestTwo, manifestOld, manifestOther],
    hygieneEvidence: [evidence],
    hygieneComplianceDocuments: [],
    ...overrides,
  };

  return {
    collection: jest.fn((name: string) => ({
      get: jest.fn().mockResolvedValue({
        docs: (collections[name] ?? []).map((record) => ({ data: () => record })),
      }),
    })),
  };
}

describe("getConsolidatedHygieneClientPackData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("aggregates only selected-client collections within the reporting period", async () => {
    const data = await getConsolidatedHygieneClientPackData(user, {
      clientId: client.clientId,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });

    expect(data.entries.map((entry) => entry.collection.collectionId)).toEqual([collectionOne.collectionId, collectionTwo.collectionId]);
    expect(data.entries.every((entry) => entry.collection.clientId === client.clientId)).toBe(true);
    expect(data.entries).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ collection: expect.objectContaining({ collectionId: collectionOther.collectionId }) }),
    ]));
  });

  it("applies site filtering without leaking other client sites", async () => {
    const data = await getConsolidatedHygieneClientPackData(user, {
      clientId: client.clientId,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      siteId: siteTwo.siteId,
    });

    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].site.siteId).toBe(siteTwo.siteId);
    await expect(getConsolidatedHygieneClientPackData(user, {
      clientId: client.clientId,
      siteId: otherSite.siteId,
    })).rejects.toThrow("Hygiene site does not belong to the selected client.");
  });


  it("logs exact relationship diagnostics before blocking mismatched manifests", async () => {
    const mismatchedManifest = { ...manifestTwo, siteId: siteOne.siteId };
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore({
      hygieneManifests: [manifestOne, mismatchedManifest, manifestOld, manifestOther],
    }));

    await expect(getConsolidatedHygieneClientPackData(user, {
      clientId: client.clientId,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    })).rejects.toThrow("Hygiene consolidated pack relationship check failed.");

    expect(console.error).toHaveBeenCalledWith("[HYGIENE_CONSOLIDATED_PACK_RELATIONSHIP_MISMATCH]", {
      relationshipType: "collection-manifest-site",
      clientId: client.clientId,
      siteId: siteTwo.siteId,
      collectionId: collectionTwo.collectionId,
      manifestId: manifestTwo.manifestId,
      expectedId: siteTwo.siteId,
      actualId: siteOne.siteId,
    });
  });

  it("keeps missing disposal evidence pending and does not invent weights", async () => {
    const data = await getConsolidatedHygieneClientPackData(user, {
      clientId: client.clientId,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    const pending = data.entries.find((entry) => entry.manifest.manifestId === manifestTwo.manifestId);

    expect(pending?.evidenceStatus).toBe("Pending disposal evidence");
    expect(pending?.disposalEvidence).toEqual([]);
    expect(data.summary.totalRecordedWasteWeight).toBeNull();
  });

  it("links disposal evidence to the exact manifest and collection relationship", async () => {
    const data = await getConsolidatedHygieneClientPackData(user, {
      clientId: client.clientId,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    const linked = data.entries.find((entry) => entry.manifest.manifestId === manifestOne.manifestId);

    expect(linked?.disposalEvidence).toEqual([
      expect.objectContaining({
        evidenceId: evidence.photoId,
        manifestId: manifestOne.manifestId,
        collectionId: collectionOne.collectionId,
        storagePath: evidence.storagePath,
      }),
    ]);
    expect(data.summary.disposalStatus).toEqual({ disposed: 1, pendingEvidence: 1, generatedIncomplete: 1 });
  });
});
