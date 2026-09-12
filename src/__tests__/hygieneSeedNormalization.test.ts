import { PDFDocument } from "pdf-lib";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getHygieneManifestPdfData } from "@/lib/hygiene/hygienePdfData";
import { generateHygieneClientPackPdf } from "@/lib/hygiene/hygienePdfBranding";
import {
  cbavoClient,
  cbavoCollections,
  cbavoComplianceDocuments,
  cbavoDriverLogs,
  cbavoManifests,
  cbavoSites,
} from "@/lib/hygiene/hygieneSeed";

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: jest.fn(),
}));

const user = { uid: "admin-1", email: "admin@example.test", role: "admin" as const };

function firestore() {
  const collections: Record<string, Record<string, unknown> | unknown[]> = {
    hygieneManifests: Object.fromEntries(cbavoManifests.map((record) => [record.manifestId, record])),
    hygieneCollections: Object.fromEntries(cbavoCollections.map((record) => [record.collectionId, record])),
    hygieneClients: { [cbavoClient.clientId]: cbavoClient },
    hygieneSites: Object.fromEntries(cbavoSites.map((record) => [record.siteId, record])),
    hygieneEvidence: [],
    hygieneComplianceDocuments: cbavoComplianceDocuments,
    hygieneSignatures: [],
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

describe("normalized CBAVO Hygiene staging seed relationships", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firestore());
  });

  it("resolves Florida and Ontdekkers manifests to same-site collections", async () => {
    const florida = await getHygieneManifestPdfData(user, "TE-WM-2026-0001");
    const ontdekkers = await getHygieneManifestPdfData(user, "TE-WM-2026-0002");

    expect(florida.manifest.collectionId).toBe("TE-COL-2026-0001");
    expect(florida.collection.collectionId).toBe("TE-COL-2026-0001");
    expect(florida.manifest.siteId).toBe("TE-SIT-0001");
    expect(florida.collection.siteId).toBe(florida.manifest.siteId);

    expect(ontdekkers.manifest.collectionId).toBe("TE-COL-2026-0003");
    expect(ontdekkers.collection.collectionId).toBe("TE-COL-2026-0003");
    expect(ontdekkers.manifest.siteId).toBe("TE-SIT-0002");
    expect(ontdekkers.collection.siteId).toBe(ontdekkers.manifest.siteId);
  });

  it("builds client packs for both normalized manifests", async () => {
    const florida = await getHygieneManifestPdfData(user, "TE-WM-2026-0001");
    const ontdekkers = await getHygieneManifestPdfData(user, "TE-WM-2026-0002");

    const floridaPack = await PDFDocument.load(await generateHygieneClientPackPdf(florida));
    const ontdekkersPack = await PDFDocument.load(await generateHygieneClientPackPdf(ontdekkers));

    expect(floridaPack.getPageCount()).toBe(3);
    expect(ontdekkersPack.getPageCount()).toBe(3);
  });

  it("keeps TE-COL-2026-0002 as the later scheduled Florida collection", () => {
    expect(cbavoCollections.find((record) => record.collectionId === "TE-COL-2026-0002")).toMatchObject({
      clientId: "TE-CLI-0001",
      siteId: "TE-SIT-0001",
      scheduledDate: "2026-06-26",
      status: "Scheduled",
      manifestId: "Pending",
      arrivalTime: null,
      departureTime: null,
      completedAt: null,
    });
  });

  it("does not fabricate disposal, certificate, or signature evidence", async () => {
    const florida = await getHygieneManifestPdfData(user, "TE-WM-2026-0001");
    const ontdekkers = await getHygieneManifestPdfData(user, "TE-WM-2026-0002");

    for (const data of [florida, ontdekkers]) {
      expect(data.manifest.disposalFacility).toBe("Disposal facility not yet captured");
      expect(data.manifest.disposalDate).toBeNull();
      expect(data.manifest.disposalCertificateNo).toBe("Disposal certificate pending");
      expect(data.disposalEvidence).toEqual([]);
      expect(data.signatures).toEqual([]);
    }

    expect(ontdekkers.collection).toMatchObject({
      collectionId: "TE-COL-2026-0003",
      siteId: "TE-SIT-0002",
      arrivalTime: null,
      departureTime: null,
      completedAt: null,
      clientSignatureStatus: "Pending signature capture",
    });

    expect(cbavoDriverLogs[0]?.linkedCollectionIds).toEqual(["TE-COL-2026-0001", "TE-COL-2026-0003"]);
  });
});
