import { HYGIENE_MANIFEST_DISPLAY_LABELS, buildHygieneReportMetrics, deriveManifestDisplayStatus, hasRealHygieneManifestId, isManifestGenerationRequired } from "@/lib/hygiene/hygieneManifestDisplay";
import type { HygieneCollection, HygieneManifest } from "@/types/hygiene";

function c(overrides: Partial<HygieneCollection> = {}): HygieneCollection {
  return { collectionId: "COL-1", clientId: "CLIENT-1", siteId: "SITE-1", scheduledDate: "2026-07-10", scheduledTimeWindow: "After 13:00", assignedDriver: "Driver", vehicleRegistration: "TE 01", vehicleName: "Vehicle", status: "Completed", arrivalTime: null, departureTime: null, completedAt: "2026-07-10T14:00:00.000Z", manifestId: "Pending", evidencePhotoIds: [], clientSignatureStatus: "Signature captured", notes: "Waste collected.", workflowSteps: [], ...overrides };
}

function m(overrides: Partial<HygieneManifest> = {}): HygieneManifest {
  return { manifestId: "MAN-1", collectionId: "COL-1", clientId: "CLIENT-1", siteId: "SITE-1", generatorRegistration: "GPG", transportRegistration: "GPT", wasteClassification: "HW19", wasteType: "Sanitary/Feminine Hygiene Waste", quantity: 4, unit: "12L bins", collectionDate: "2026-07-10", collectedBy: "Driver", vehicleRegistration: "TE 01", disposalFacility: "Pending", disposalDate: null, disposalCertificateNo: "Pending", status: "Disposal Pending", createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z", ...overrides };
}

describe("hygiene manifest display classification", () => {
  it("classifies generated, pending, zero-waste and cancelled display states", () => {
    expect(deriveManifestDisplayStatus(c({ manifestId: "TE-WM-2026-0001" }))).toBe("generated");
    expect(deriveManifestDisplayStatus(c({ manifestId: "Pending" }))).toBe("pending_generation");
    expect(deriveManifestDisplayStatus(c({ collectionOutcome: "zero_waste", manifestId: "TE-WM-1783888267150", notes: "Completed site attendance. No waste collected." }))).toBe("zero_waste_record");
    expect(deriveManifestDisplayStatus(c({ status: "Cancelled", collectionOutcome: "cancelled", manifestId: "Not applicable", completedAt: null }))).toBe("not_applicable_cancelled");
  });

  it("uses required labels and preserves manifest IDs where present", () => {
    expect(HYGIENE_MANIFEST_DISPLAY_LABELS.generated).toBe("Generated");
    expect(HYGIENE_MANIFEST_DISPLAY_LABELS.pending_generation).toBe("Pending generation");
    expect(HYGIENE_MANIFEST_DISPLAY_LABELS.zero_waste_record).toBe("Zero-waste service record");
    expect(HYGIENE_MANIFEST_DISPLAY_LABELS.not_applicable_cancelled).toBe("Not applicable — cancelled");
    expect(hasRealHygieneManifestId("TE-WM-1783888267150")).toBe(true);
    expect(hasRealHygieneManifestId("Pending")).toBe(false);
  });

  it("requires generation only for completed waste-bearing collections without a manifest", () => {
    expect(isManifestGenerationRequired(c({ manifestId: "Pending" }))).toBe(true);
    expect(isManifestGenerationRequired(c({ manifestId: "TE-WM-2026-0001" }))).toBe(false);
    expect(isManifestGenerationRequired(c({ collectionOutcome: "zero_waste", manifestId: "Pending" }))).toBe(false);
    expect(isManifestGenerationRequired(c({ status: "Cancelled", collectionOutcome: "cancelled", manifestId: "Not applicable" }))).toBe(false);
  });

  it("excludes zero-waste and cancelled records from waste-bearing report totals", () => {
    const metrics = buildHygieneReportMetrics({
      collections: [
        c({ collectionId: "COL-WASTE", siteId: "SITE-1", manifestId: "MAN-WASTE" }),
        c({ collectionId: "COL-PENDING", siteId: "SITE-2", manifestId: "Pending" }),
        c({ collectionId: "COL-ZERO", siteId: "SITE-1", manifestId: "MAN-ZERO", collectionOutcome: "zero_waste", binCountConfirmed: 0 }),
        c({ collectionId: "COL-CANCELLED", siteId: "SITE-2", status: "Cancelled", collectionOutcome: "cancelled", manifestId: "Not applicable", completedAt: null }),
      ],
      manifests: [m({ manifestId: "MAN-WASTE", collectionId: "COL-WASTE", quantity: 4 }), m({ manifestId: "MAN-ZERO", collectionId: "COL-ZERO", quantity: 0 })],
      evidenceCount: 0,
    });
    expect(metrics.collectionsCompleted).toBe(2);
    expect(metrics.sitesServiced).toBe(2);
    expect(metrics.totalBinsServiced).toBe(4);
    expect(metrics.manifestsCreated).toBe(1);
    expect(metrics.disposalCertificatesPending).toBe(1);
  });

  it("does not treat zero bin count alone as a zero-waste service record", () => {
    const record = c({ collectionId: "TE-COL-1783071399102", manifestId: "Pending", binCountConfirmed: 0, notes: "Operational collection update." });
    expect(deriveManifestDisplayStatus(record)).toBe("pending_generation");
    expect(isManifestGenerationRequired(record)).toBe(true);
  });

  it("does not regress disposal-certificate status or collection completion status", () => {
    const certifiedManifest = m({ status: "Certified", disposalCertificateNo: "CERT-1" });
    const completedCollection = c({ manifestId: certifiedManifest.manifestId });
    expect(completedCollection.status).toBe("Completed");
    expect(certifiedManifest.status).toBe("Certified");
    expect(deriveManifestDisplayStatus(completedCollection)).toBe("generated");
  });
});
