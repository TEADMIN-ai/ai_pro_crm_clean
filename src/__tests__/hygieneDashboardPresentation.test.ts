import { HYGIENE_LIGHT_SURFACE_NOTICE, buildHygieneAtAGlance, buildVerifiedEvidenceGallery, getContrastRatio } from "@/lib/hygiene/dashboardPresentation";
import type { HygieneDashboardData } from "@/types/hygiene";
import { NUWKEM_PRODUCTS_URL, NUWKEM_PRODUCT_MEDIA } from "@/lib/hygiene/nuwkemProductMedia";
import { existsSync, readFileSync } from "fs";

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
  it("uses WCAG AA contrast for reusable light-surface notices", () => {
    const ratio = getContrastRatio(
      HYGIENE_LIGHT_SURFACE_NOTICE.contrast.foreground,
      HYGIENE_LIGHT_SURFACE_NOTICE.contrast.background
    );

    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBe(17.58);
    expect(HYGIENE_LIGHT_SURFACE_NOTICE.style.color).toBe("#020617");
    expect(HYGIENE_LIGHT_SURFACE_NOTICE.style.backgroundColor).toBe("#E0F2FE");
    expect(HYGIENE_LIGHT_SURFACE_NOTICE.className).toContain("mb-4");
  });

  it("reuses the accessible light-surface notice for the verified evidence information panel", () => {
    const source = readFileSync("src/components/hygiene/HygieneDivisionClient.tsx", "utf8");
    const evidencePanelSource = source.slice(
      source.indexOf("function VerifiedEvidenceGallery"),
      source.indexOf("function ServiceWorkflowSequence")
    );

    expect(evidencePanelSource).toContain("HYGIENE_LIGHT_SURFACE_NOTICE.className");
    expect(evidencePanelSource).toContain("HYGIENE_LIGHT_SURFACE_NOTICE.style");
    expect(evidencePanelSource).not.toContain("text-cyan-50");
    expect(evidencePanelSource).not.toContain("bg-cyan-400/10");
  });

  it("renders a full Hygiene Division hero with live route calls to action and supplier-media labelling", () => {
    const source = readFileSync("src/components/hygiene/HygieneDivisionClient.tsx", "utf8");
    const heroSource = source.slice(
      source.indexOf('src="/media/partners/nuwkem/nuwkem-hygiene-environment-hero.webp"'),
      source.indexOf('aria-label="Hygiene Division dashboard"')
    );

    expect(heroSource).toContain("Torque Empire Hygiene Division");
    expect(heroSource).toContain("Professional hygiene solutions, controlled waste operations and digital compliance evidence from collection through completion.");
    expect(heroSource).toContain('src="/corporate/logo/torque-empire-primary.png"');
    expect(heroSource).toContain('src="/media/partners/nuwkem/nuwkem-hygiene-environment-hero.webp"');
    expect(heroSource).toContain("Authorised Nuwkem distributor presentation");
    expect(heroSource).toContain("Supplier imagery shown here is distributor presentation media, not operational evidence.");
    expect(heroSource).toContain('href="/dashboard/hygiene/jobs"');
    expect(heroSource).toContain("Open Driver Workflow");
    expect(heroSource).toContain('href="/dashboard/hygiene/evidence"');
    expect(heroSource).toContain("View Operational Evidence");
    expect(heroSource).toContain('href="/dashboard/hygiene/compliance"');
    expect(heroSource).toContain("View Compliance Records");
    expect(heroSource).toContain("rgba(2,6,23,0.98)");
    expect(heroSource).not.toContain("text-cyan-50");
    expect(heroSource).not.toContain("bg-cyan-400/10");
  });

  it("keeps Nuwkem distributor media local, authorised and provenance-labelled", () => {
    expect(NUWKEM_PRODUCTS_URL).toBe("https://www.nuwkem.co.za/products/");
    expect(NUWKEM_PRODUCT_MEDIA).toHaveLength(5);
    expect(NUWKEM_PRODUCT_MEDIA.map((item) => item.category)).toEqual([
      "Sanitary waste solution",
      "Soap and sanitiser dispenser",
      "Paper dispenser / hand dryer",
      "Consumables and refills",
      "Premium dispenser range",
    ]);
    expect(NUWKEM_PRODUCT_MEDIA.every((item) => item.publicAssetPath.startsWith("/media/partners/nuwkem/"))).toBe(true);
    expect(NUWKEM_PRODUCT_MEDIA.every((item) => item.publicAssetPath.endsWith(".webp"))).toBe(true);
    expect(NUWKEM_PRODUCT_MEDIA.every((item) => item.sourcePage > 0)).toBe(true);
    expect(NUWKEM_PRODUCT_MEDIA.some((item) => item.publicAssetPath.includes("nuwkem.co.za"))).toBe(false);
    expect(NUWKEM_PRODUCT_MEDIA.every((item) => existsSync(`public${item.publicAssetPath}`))).toBe(true);
  });

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
