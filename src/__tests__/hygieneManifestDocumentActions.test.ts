import { readFileSync } from "node:fs";
import {
  HYGIENE_SAVED_MANIFEST_ACTION_ORDER,
  getHygieneManifestDocumentActionVisibility,
  hasHygieneDisposalCertificateEvidence,
} from "@/lib/hygiene/hygieneManifestDocumentActions";
import type { HygieneComplianceDocument, HygieneEvidencePhoto, HygieneManifest } from "@/types/hygiene";

function manifest(overrides: Partial<HygieneManifest> = {}): HygieneManifest {
  return {
    manifestId: "TE-WM-2026-0001",
    collectionId: "TE-COL-2026-0001",
    clientId: "TE-CLI-1",
    siteId: "TE-SIT-1",
    generatorRegistration: "GPG-15-793",
    transportRegistration: "GPT-15-858",
    wasteClassification: "HW19",
    wasteType: "Sanitary/Feminine Hygiene Waste",
    quantity: 4,
    unit: "12L bins",
    collectionDate: "2026-07-10",
    collectedBy: "Driver One",
    vehicleRegistration: "TE 01 GP",
    disposalFacility: "Pending",
    disposalDate: null,
    disposalCertificateNo: "Pending",
    status: "Generated",
    createdAt: "2026-07-10T10:31:00.000Z",
    updatedAt: "2026-07-11T12:00:00.000Z",
    ...overrides,
  };
}

const certificatePhoto: HygieneEvidencePhoto = {
  photoId: "PHOTO-CERT-1",
  clientId: "TE-CLI-1",
  siteId: "TE-SIT-1",
  collectionId: "TE-COL-2026-0001",
  manifestId: "TE-WM-2026-0001",
  category: "Disposal Certificate",
  uploadedBy: "ops@example.test",
  uploadedAt: "2026-07-11T10:00:00.000Z",
  fileUrl: "hygiene/evidence/TE-CLI-1/TE-COL-2026-0001/cert.pdf",
  timestampFromImage: null,
  notes: "Certificate uploaded.",
};

const certificateDocument: HygieneComplianceDocument = {
  documentId: "DOC-CERT-1",
  documentType: "Disposal Certificates",
  title: "Disposal Certificate TE-WM-2026-0001",
  registrationNumber: "CERT-2026-77",
  issueDate: "2026-07-11",
  expiryDate: null,
  status: "Active",
  fileUrl: "hygiene/compliance/DOC-CERT-1/cert.pdf",
  owner: "CBAVO Services",
  uploadedAt: "2026-07-11T10:00:00.000Z",
  storagePath: "hygiene/compliance/DOC-CERT-1/cert.pdf",
};

describe("Hygiene manifest document action visibility", () => {
  it("shows saved manifest actions in the required operator order", () => {
    expect(HYGIENE_SAVED_MANIFEST_ACTION_ORDER).toEqual(["View Manifest", "Download PDF", "Create Client Pack"]);
  });

  it("shows manifest PDF actions for a generated manifest even when disposal remains pending", () => {
    const visibility = getHygieneManifestDocumentActionVisibility({
      manifest: manifest({ status: "Generated", disposalFacility: "Pending", disposalCertificateNo: "Pending" }),
      evidencePhotos: [],
      complianceDocuments: [],
      clientName: "CBAVO Services",
      canOperate: true,
    });

    expect(visibility).toMatchObject({
      viewManifest: true,
      downloadPdf: true,
      createClientPack: true,
      viewCertificate: false,
      downloadCertificate: false,
    });
  });

  it("keeps certificate actions hidden when certificate evidence is absent", () => {
    const visibility = getHygieneManifestDocumentActionVisibility({
      manifest: manifest({ status: "Disposal Pending" }),
      evidencePhotos: [],
      complianceDocuments: [],
      clientName: "CBAVO Services",
      canOperate: true,
    });

    expect(visibility.viewCertificate).toBe(false);
    expect(visibility.downloadCertificate).toBe(false);
  });

  it("does not show certificate actions for owner-only or collection-only evidence matches", () => {
    const ownerOnlyDocument = { ...certificateDocument, registrationNumber: "OTHER-CERT" };
    const collectionOnlyPhoto = { ...certificatePhoto, manifestId: "OTHER-MANIFEST" };

    expect(hasHygieneDisposalCertificateEvidence({
      manifest: manifest({ disposalCertificateNo: "CERT-2026-77" }),
      evidencePhotos: [collectionOnlyPhoto],
      complianceDocuments: [ownerOnlyDocument],
      clientName: "CBAVO Services",
    })).toBe(false);
  });

  it("shows certificate actions when linked disposal certificate evidence exists", () => {
    expect(hasHygieneDisposalCertificateEvidence({ manifest: manifest(), evidencePhotos: [certificatePhoto], complianceDocuments: [], clientName: "CBAVO Services" })).toBe(true);

    const visibility = getHygieneManifestDocumentActionVisibility({
      manifest: manifest({ disposalCertificateNo: "CERT-2026-77" }),
      evidencePhotos: [],
      complianceDocuments: [certificateDocument],
      clientName: "CBAVO Services",
      canOperate: true,
    });

    expect(visibility.viewCertificate).toBe(true);
    expect(visibility.downloadCertificate).toBe(true);
  });

  it("does not couple compliance warnings to document generation actions", () => {
    const pendingDisposal = manifest({ status: "Disposal Pending", disposalFacility: "Disposal facility not yet captured", disposalCertificateNo: "Disposal certificate pending" });
    const visibility = getHygieneManifestDocumentActionVisibility({ manifest: pendingDisposal, evidencePhotos: [], complianceDocuments: [], clientName: "CBAVO Services", canOperate: true });

    expect(pendingDisposal.status).toBe("Disposal Pending");
    expect(visibility.viewManifest).toBe(true);
    expect(visibility.downloadPdf).toBe(true);
    expect(visibility.createClientPack).toBe(true);
  });

  it("uses the same governed document action renderer for card and table manifest layouts", () => {
    const source = readFileSync("src/components/hygiene/HygieneDivisionClient.tsx", "utf8");
    const manifestRegister = source.slice(source.indexOf("Waste Manifest Register"), source.indexOf('view === "evidence"'));

    expect(source).toContain("function renderManifestActions(manifest: HygieneManifest, layout: \"card\" | \"table\")");
    expect(manifestRegister).toContain('actions={renderManifestActions(manifest, "card")}');
    expect(manifestRegister).toContain('{renderManifestActions(manifest, "table")}');
    expect(manifestRegister).toContain("DisposalWarningCell");
  });

  it("renders the consolidated pack modal as an opaque foreground panel", () => {
    const source = readFileSync("src/components/hygiene/HygieneDivisionClient.tsx", "utf8");
    const modalSource = source.slice(source.indexOf("{modal ?"), source.indexOf('view === "home"'));

    expect(modalSource).toContain("absolute inset-0 bg-slate-950/80");
    expect(modalSource).toContain('aria-hidden="true"');
    expect(modalSource).toContain("relative z-10");
    expect(modalSource).toContain('backgroundColor: "#020617"');
    expect(modalSource).not.toContain("bg-[color:var(--hygiene-surface)]");
    expect(source).toContain("htmlFor={fieldId}");
    expect(modalSource).toContain("hygiene-modal-siteId-help");
    expect(modalSource).toContain("hygiene-modal-includeIncomplete");
  });

  it("saved manifest UI exposes the required PDF actions through authenticated blob handling", () => {
    const source = readFileSync("src/components/hygiene/HygieneDivisionClient.tsx", "utf8");
    const renderer = source.slice(source.indexOf("function renderManifestActions"), source.indexOf("function openModal"));

    expect(renderer.indexOf("View Manifest")).toBeLessThan(renderer.indexOf("Download PDF"));
    expect(renderer.indexOf("Download PDF")).toBeLessThan(renderer.indexOf("Create Client Pack"));
    expect(source).toContain("await authFetch(url)");
    expect(source).toContain("response.blob()");
    expect(source).toContain("Content-Type");
    expect(source).toContain("function isPdfContentType");
    expect(source).toContain("application/pdf");
    expect(source).toContain("URL.createObjectURL(blob)");
    expect(source).toContain("window.location.assign(url)");
    expect(source).toContain("URL.revokeObjectURL(url)");
    expect(source).not.toContain("window.open(");
    expect(source).not.toContain("Browser blocked the manifest document popup");
    expect(source).toContain("API_ROUTES.HYGIENE_EVIDENCE_ACCESS");
    expect(source).toContain("fetch(payload.accessUrl)");
    expect(source).toContain("function isViewableDocumentContentType");
    expect(renderer).toContain("openManifestPdf(manifest)");
    expect(renderer).toContain("View Manifest");
    expect(renderer).toContain("openManifestPdf(manifest, true)");
    expect(renderer).toContain("openClientPack(manifest)");
    expect(renderer).toContain('openManifestCertificate(manifest, "Certificate opened in this tab.")');
    expect(renderer).toContain('openManifestCertificate(manifest, "Certificate download started.", true)');
  });
});
