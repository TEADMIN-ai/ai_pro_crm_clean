export type HygieneInternalRole = "admin" | "manager" | "staff";
export type HygieneClientPortalRole = "hygieneClient" | "hygieneContractor";
export type HygieneAccessMode = "internal" | "clientPortal";

export type HygieneClientStatus = "Active" | "Pending" | "Inactive" | "Suspended";
export type HygienePaymentStatus = "Paid" | "Pending" | "Overdue";
export type HygieneAssetStatus = "Active" | "Pending" | "In Maintenance" | "Retired";
export type HygieneCollectionStatus = "Scheduled" | "In Progress" | "Completed" | "Overdue" | "Cancelled";
export type HygieneManifestStatus = "Draft" | "Disposal Pending" | "Certificate Received" | "Completed";
export type HygieneComplianceStatus = "Compliance Green" | "Compliance Warning" | "Compliance Expired";
export type HygieneDocumentStatus = "Active" | "Pending" | "Compliance Green" | "Compliance Warning" | "Compliance Expired";
export type HygieneInspectionStatus = "Passed" | "Failed" | "Action Required";

export type HygienePhotoCategory =
  | "Site Arrival"
  | "Client Site Signage"
  | "Bin Before Service"
  | "Bin Servicing"
  | "Bag Removed"
  | "Bag Sealed"
  | "Transport Container"
  | "Vehicle Loading"
  | "Team Photo"
  | "Completion Photo";

export const HYGIENE_PHOTO_CATEGORIES: HygienePhotoCategory[] = [
  "Site Arrival",
  "Client Site Signage",
  "Bin Before Service",
  "Bin Servicing",
  "Bag Removed",
  "Bag Sealed",
  "Transport Container",
  "Vehicle Loading",
  "Team Photo",
  "Completion Photo",
];

export interface HygieneClient {
  clientId: string;
  clientName: string;
  clientType: string;
  companyRegistration: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  billingContact: string;
  contractStartDate: string;
  contractEndDate: string;
  serviceFrequency: string;
  collectionDay: string;
  collectionWindow: string;
  paymentStatus: HygienePaymentStatus;
  status: HygieneClientStatus;
  monthlyRevenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface HygieneSite {
  siteId: string;
  clientId: string;
  siteName: string;
  address: string;
  suburb: string;
  city: string;
  contactPerson: string;
  contactPhone: string;
  binCount: number;
  binSize: string;
  serviceFrequency: string;
  accessNotes: string;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  status: HygieneClientStatus;
}

export interface HygieneBinAsset {
  assetId: string;
  clientId: string;
  siteId: string;
  binSize: string;
  binType: string;
  locationDescription: string;
  status: HygieneAssetStatus;
  installDate: string;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  condition: string;
  notes: string;
}

export interface HygieneCollection {
  collectionId: string;
  clientId: string;
  siteId: string;
  scheduledDate: string;
  scheduledTimeWindow: string;
  assignedDriver: string;
  vehicleRegistration: string;
  vehicleName: string;
  status: HygieneCollectionStatus;
  arrivalTime: string | null;
  departureTime: string | null;
  completedAt: string | null;
  manifestId: string;
  evidencePhotoIds: string[];
  clientSignatureStatus: string;
  notes: string;
  workflowSteps: HygieneWorkflowStep[];
}

export interface HygieneWorkflowStep {
  stepId: string;
  label: string;
  status: "Pending" | "Completed";
}

export interface HygieneManifest {
  manifestId: string;
  collectionId: string;
  clientId: string;
  siteId: string;
  generatorRegistration: string;
  transportRegistration: string;
  wasteClassification: "HW19" | "GW";
  wasteType: string;
  quantity: number;
  unit: string;
  collectionDate: string;
  collectedBy: string;
  vehicleRegistration: string;
  disposalFacility: string;
  disposalDate: string | null;
  disposalCertificateNo: string;
  status: HygieneManifestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HygieneEvidencePhoto {
  photoId: string;
  clientId: string;
  siteId: string;
  collectionId: string;
  manifestId: string;
  category: HygienePhotoCategory;
  uploadedBy: string;
  uploadedAt: string;
  fileUrl: string;
  timestampFromImage: string | null;
  notes: string;
}

export interface HygieneVehicleInspection {
  inspectionId: string;
  date: string;
  vehicleRegistration: string;
  vehicleName: string;
  driver: string;
  odometerStart: number | null;
  odometerEnd: number | null;
  fuelStatus: string;
  roadworthyStatus: string;
  ppeAvailable: boolean;
  spillKitAvailable: boolean;
  wasteContainerSecured: boolean;
  comments: string;
  status: HygieneInspectionStatus;
}

export interface HygieneDriverLog {
  driverLogId: string;
  date: string;
  driverName: string;
  vehicleRegistration: string;
  startKm: number | null;
  endKm: number | null;
  fuel: string;
  signatureStatus: string;
  linkedCollectionIds: string[];
}

export interface HygieneComplianceDocument {
  documentId: string;
  documentType: string;
  title: string;
  registrationNumber: string;
  issueDate: string | null;
  expiryDate: string | null;
  status: HygieneDocumentStatus;
  fileUrl: string | null;
  owner: string;
  uploadedAt: string | null;
}

export interface HygieneReport {
  reportId: string;
  period: string;
  collectionsCompleted: number;
  sitesServiced: number;
  totalBinsServiced: number;
  manifestsCreated: number;
  disposalCertificatesPending: number;
  incidents: number;
  evidenceCompletionPercentage: number;
  revenueSummary: number;
  createdAt: string;
}

export interface HygieneDashboardKpis {
  activeHygieneClients: number;
  activeSites: number;
  activeBinAssets: number;
  collectionsDueThisWeek: number;
  collectionsCompletedThisMonth: number;
  wasteServicesCompleted: number;
  disposalCertificatesPending: number;
  complianceStatus: HygieneComplianceStatus;
  monthlyContractRevenue: number;
}

export interface HygieneDashboardData {
  kpis: HygieneDashboardKpis;
  clients: HygieneClient[];
  sites: HygieneSite[];
  assets: HygieneBinAsset[];
  collections: HygieneCollection[];
  manifests: HygieneManifest[];
  evidencePhotos: HygieneEvidencePhoto[];
  vehicleInspections: HygieneVehicleInspection[];
  driverLogs: HygieneDriverLog[];
  complianceDocuments: HygieneComplianceDocument[];
  reports: HygieneReport[];
}
