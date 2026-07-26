import { buildHygieneAtAGlance, buildVerifiedEvidenceGallery } from "@/lib/hygiene/dashboardPresentation";
import type { HygieneDashboardData } from "@/types/hygiene";

function dashboardData(overrides: Partial<HygieneDashboardData> = {}): HygieneDashboardData {
  return {
    kpis: {
      activeHygieneClients: 0,
      activeSites: 0,
      activeBinAssets: 0,
      collectionsDueThisWeek: 0,
      collectionsCompletedThisMonth: 0,
      wasteServicesCompleted: 0,
      disposalCertificatesPending: 0,
      complianceStatus: "Compliance Green",
      monthlyContractRevenue: 0,
    },
    clients: [],
    sites: [],
    assets: [],
    collections: [],
    manifests: [],
    evidencePhotos: [],
    vehicleInspections: [],
    driverLogs: [],
    complianceDocuments: [],
    reports: [],
    ...overrides,
  };
}

describe("hygiene dashboard presentation model", () => {
  it("keeps unavailable operational metrics explicit instead of inventing live figures", () => {
    const metrics = buildHygieneAtAGlance(dashboardData());

    expect(metrics.find((metric) => metric.label === "Scheduled Collections")).toMatchObject({
      value: 0,
      status: "empty",
    });
    expect(metrics.find((metric) => metric.label === "Completed Collections")).toMatchObject({
      value: 0,
      status: "empty",
    });
    expect(metrics.find((metric) => metric.label === "Compliance Status")).toMatchObject({
      value: "Compliance Green",
      status: "good",
    });
  });

  it("derives meeting metrics from canonical collections, manifests and evidence", () => {
    const metrics = buildHygieneAtAGlance(dashboardData({
      collections: [
        { collectionId: "COL-1", clientId: "CLIENT-1", siteId: "SITE-1", scheduledDate: "2026-07-26", scheduledTimeWindow: "09:00", assignedDriver: "Driver", vehicleRegistration: "TE 01", vehicleName: "Vehicle", status: "Scheduled", arrivalTime: null, departureTime: null, completedAt: null, manifestId: "MAN-1", evidencePhotoIds: [], clientSignatureStatus: "Pending", notes: "", workflowSteps: [] },
        { collectionId: "COL-2", clientId: "CLIENT-1", siteId: "SITE-1", scheduledDate: "2026-07-26", scheduledTimeWindow: "10:00", assignedDriver: "Driver", vehicleRegistration: "TE 01", vehicleName: "Vehicle", status: "Completed", arrivalTime: null, departureTime: null, completedAt: "2026-07-26T10:30:00.000Z", manifestId: "MAN-2", evidencePhotoIds: [], clientSignatureStatus: "Signature captured", notes: "", workflowSteps: [] },
        { collectionId: "COL-3", clientId: "CLIENT-1", siteId: "SITE-1", scheduledDate: "2026-07-26", scheduledTimeWindow: "11:00", assignedDriver: "Driver", vehicleRegistration: "TE 01", vehicleName: "Vehicle", status: "Awaiting Disposal", arrivalTime: null, departureTime: null, completedAt: null, manifestId: "MAN-3", evidencePhotoIds: [], clientSignatureStatus: "Pending", notes: "", workflowSteps: [] },
      ],
      manifests: [
        { manifestId: "MAN-3", collectionId: "COL-3", clientId: "CLIENT-1", siteId: "SITE-1", generatorRegistration: "GPG", transportRegistration: "GPT", wasteClassification: "HW19", wasteType: "Sanitary/Feminine Hygiene Waste", quantity: 1, unit: "12L bins", collectionDate: "2026-07-26", collectedBy: "Driver", vehicleRegistration: "TE 01", disposalFacility: "Pending", disposalDate: null, disposalCertificateNo: "Pending", status: "Disposal Pending", createdAt: "2026-07-26T00:00:00.000Z", updatedAt: "2026-07-26T00:00:00.000Z" },
      ],
      evidencePhotos: [
        { photoId: "PHOTO-1", clientId: "CLIENT-1", siteId: "SITE-1", collectionId: "COL-3", manifestId: "MAN-3", category: "Incident Photo", uploadedBy: "operator@example.test", uploadedAt: "2026-07-26T11:00:00.000Z", fileUrl: "https://storage.example/photo.jpg", timestampFromImage: null, notes: "" },
      ],
    }));

    expect(metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ["Scheduled Collections", 1],
      ["Completed Collections", 1],
      ["Pending Disposal Verification", 2],
      ["Incidents / Non-Conformances", 1],
      ["Compliance Status", "Compliance Green"],
    ]);
  });

  it("only exposes evidence linked to the visible client, site and collection graph", () => {
    const items = buildVerifiedEvidenceGallery(dashboardData({
      clients: [
        { clientId: "CLIENT-1", clientName: "Client One", clientType: "Hygiene Client", companyRegistration: "REG", primaryContactName: "Ops", primaryContactPhone: "1", primaryContactEmail: "ops@example.test", billingContact: "Ops", contractStartDate: "2026-07-01", contractEndDate: "2027-07-01", serviceFrequency: "Weekly", collectionDay: "Monday", collectionWindow: "09:00", paymentStatus: "Paid", status: "Active", monthlyRevenue: 0, recordClassification: "PRODUCTION", createdAt: "2026-07-01", updatedAt: "2026-07-01" },
      ],
      sites: [
        { siteId: "SITE-1", clientId: "CLIENT-1", siteName: "Visible Site", address: "1 Road", suburb: "Suburb", city: "City", contactPerson: "Ops", contactPhone: "1", binCount: 1, binSize: "12L", serviceFrequency: "Weekly", accessNotes: "", lastServiceDate: null, nextServiceDate: null, status: "Active" },
      ],
      collections: [
        { collectionId: "COL-1", clientId: "CLIENT-1", siteId: "SITE-1", scheduledDate: "2026-07-26", scheduledTimeWindow: "09:00", assignedDriver: "Driver", vehicleRegistration: "TE 01", vehicleName: "Vehicle", status: "Completed", arrivalTime: null, departureTime: null, completedAt: "2026-07-26T10:00:00.000Z", manifestId: "MAN-1", evidencePhotoIds: [], clientSignatureStatus: "Signature captured", notes: "", workflowSteps: [] },
      ],
      evidencePhotos: [
        { photoId: "VISIBLE", clientId: "CLIENT-1", siteId: "SITE-1", collectionId: "COL-1", manifestId: "MAN-1", category: "Completion Photo", uploadedBy: "operator@example.test", uploadedAt: "2026-07-26T10:00:00.000Z", fileUrl: "https://storage.example/visible.jpg", timestampFromImage: null, notes: "" },
        { photoId: "WRONG-CLIENT", clientId: "CLIENT-2", siteId: "SITE-1", collectionId: "COL-1", manifestId: "MAN-1", category: "Completion Photo", uploadedBy: "operator@example.test", uploadedAt: "2026-07-26T10:01:00.000Z", fileUrl: "https://storage.example/wrong.jpg", timestampFromImage: null, notes: "" },
        { photoId: "WRONG-COLLECTION", clientId: "CLIENT-1", siteId: "SITE-1", collectionId: "COL-2", manifestId: "MAN-2", category: "Completion Photo", uploadedBy: "operator@example.test", uploadedAt: "2026-07-26T10:02:00.000Z", fileUrl: "https://storage.example/wrong-collection.jpg", timestampFromImage: null, notes: "" },
      ],
    }));

    expect(items).toHaveLength(1);
    expect(items[0].photo.photoId).toBe("VISIBLE");
    expect(items[0].siteName).toBe("Visible Site");
  });
});
