import { inferHygieneRecordClassification } from "@/lib/hygiene/recordClassification"
import { filterHygieneDashboardDataForVisibility } from "@/lib/hygiene/hygieneVisibility"
import type { HygieneDashboardData } from "@/types/hygiene"

const baseData: Omit<HygieneDashboardData, "kpis"> = {
  clients: [
    { clientId: "prod-1", clientName: "CBAVO Services", clientType: "Hygiene Client", companyRegistration: "2024/105084/07", primaryContactName: "Ops", primaryContactPhone: "1", primaryContactEmail: "ops@example.co.za", billingContact: "Ops", contractStartDate: "2026-06-01", contractEndDate: "2026-07-01", serviceFrequency: "Weekly", collectionDay: "Friday", collectionWindow: "After 13:00", paymentStatus: "Paid", status: "Active", monthlyRevenue: 2100, recordClassification: "PRODUCTION", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
    { clientId: "qa-1", clientName: "QA v1 Hygiene Client", clientType: "Hygiene Client", companyRegistration: "QA", primaryContactName: "QA Hygiene Contact", primaryContactPhone: "1", primaryContactEmail: "qa-v1-hygiene@example.invalid", billingContact: "QA Hygiene Contact", contractStartDate: "2026-06-01", contractEndDate: "2026-07-01", serviceFrequency: "Weekly", collectionDay: "Friday", collectionWindow: "After 13:00", paymentStatus: "Paid", status: "Active", monthlyRevenue: 9999, recordClassification: "TEST", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
  ],
  sites: [],
  assets: [],
  collections: [
    { collectionId: "prod-col", clientId: "prod-1", siteId: "prod-site", scheduledDate: "2026-06-07", scheduledTimeWindow: "After 13:00", assignedDriver: "Driver", vehicleRegistration: "REG", vehicleName: "Vehicle", status: "Completed", arrivalTime: null, departureTime: null, completedAt: "2026-06-07", manifestId: "prod-man", evidencePhotoIds: [], clientSignatureStatus: "Signature captured", notes: "Production", workflowSteps: [] },
    { collectionId: "qa-col", clientId: "qa-1", siteId: "qa-site", scheduledDate: "2026-06-07", scheduledTimeWindow: "After 13:00", assignedDriver: "Driver", vehicleRegistration: "REG", vehicleName: "Vehicle", status: "Completed", arrivalTime: null, departureTime: null, completedAt: "2026-06-07", manifestId: "qa-man", evidencePhotoIds: [], clientSignatureStatus: "Signature captured", notes: "QA", workflowSteps: [] },
  ],
  manifests: [
    { manifestId: "prod-man", collectionId: "prod-col", clientId: "prod-1", siteId: "prod-site", generatorRegistration: "G", transportRegistration: "T", wasteClassification: "HW19", wasteType: "Waste", quantity: 4, unit: "12L bins", collectionDate: "2026-06-07", collectedBy: "Driver", vehicleRegistration: "REG", disposalFacility: "Facility", disposalDate: null, disposalCertificateNo: "Pending", status: "Generated", createdAt: "2026-06-07", updatedAt: "2026-06-07" },
    { manifestId: "qa-man", collectionId: "qa-col", clientId: "qa-1", siteId: "qa-site", generatorRegistration: "G", transportRegistration: "T", wasteClassification: "HW19", wasteType: "Waste", quantity: 99, unit: "12L bins", collectionDate: "2026-06-07", collectedBy: "Driver", vehicleRegistration: "REG", disposalFacility: "Facility", disposalDate: null, disposalCertificateNo: "Pending", status: "Generated", createdAt: "2026-06-07", updatedAt: "2026-06-07" },
  ],
  evidencePhotos: [],
  vehicleInspections: [],
  driverLogs: [],
  complianceDocuments: [
    { documentId: "prod-doc", documentType: "Service Agreement", title: "Service Agreement", registrationNumber: "PROD", issueDate: null, expiryDate: null, status: "Compliance Green", fileUrl: null, owner: "CBAVO Services", uploadedAt: null },
    { documentId: "qa-doc", documentType: "Service Agreement", title: "QA Agreement", registrationNumber: "QA", issueDate: null, expiryDate: null, status: "Compliance Green", fileUrl: null, owner: "QA v1 Hygiene Client", uploadedAt: null },
  ],
  reports: [],
  jobEvents: [],
  signatures: [],
}

describe("hygiene record classification", () => {
  it("infers confirmed QA hygiene client records as TEST", () => {
    expect(inferHygieneRecordClassification({
      clientName: "QA v1 Hygiene Client",
      primaryContactName: "QA Hygiene Contact",
      primaryContactEmail: "qa-v1-hygiene@example.invalid",
    })).toBe("TEST")
  })

  it("hides TEST client graph records by default", () => {
    const visible = filterHygieneDashboardDataForVisibility(baseData)
    expect(visible.clients.map((client) => client.clientId)).toEqual(["prod-1"])
    expect(visible.collections.map((collection) => collection.collectionId)).toEqual(["prod-col"])
    expect(visible.manifests.map((manifest) => manifest.manifestId)).toEqual(["prod-man"])
    expect(visible.complianceDocuments.map((document) => document.documentId)).toEqual(["prod-doc"])
  })

  it("can include TEST records for admin review when requested", () => {
    const visible = filterHygieneDashboardDataForVisibility(baseData, { includeTestData: true })
    expect(visible.clients.map((client) => client.clientId)).toEqual(["prod-1", "qa-1"])
    expect(visible.manifests.map((manifest) => manifest.manifestId)).toEqual(["prod-man", "qa-man"])
  })
})
