export type HygieneClientStatus = "Active" | "Inactive" | "Suspended";
export type HygienePaymentStatus = "Current" | "Pending" | "Overdue";
export type HygieneAssetStatus = "Active" | "In Maintenance" | "Retired";
export type HygieneCollectionStatus = "Scheduled" | "Completed" | "Missed" | "Cancelled";
export type HygieneManifestStatus = "Draft" | "Pending Disposal" | "Completed";
export type HygieneComplianceStatus = "Valid" | "Expiring Soon" | "Expired" | "Pending";
export type HygieneDocumentStatus = "On File" | "Missing" | "Expired";
export type HygieneInspectionStatus = "Passed" | "Failed" | "Action Required";
export type HygienePhotoCategory =
  | "Site Arrival"
  | "Bin Before Service"
  | "Bin Servicing"
  | "Bag Sealed"
  | "Transport Container"
  | "Vehicle Loading"
  | "Team Photo"
  | "Client Site Photo";

export const HYGIENE_PHOTO_CATEGORIES: HygienePhotoCategory[] = [
  "Site Arrival",
  "Bin Before Service",
  "Bin Servicing",
  "Bag Sealed",
  "Transport Container",
  "Vehicle Loading",
  "Team Photo",
  "Client Site Photo",
];

export interface HygieneClient {
  clientId: string;
  clientName: string;
  companyRegistration: string;
  contactPerson: string;
  phone: string;
  email: string;
  contractStartDate: string;
  contractEndDate: string;
  serviceFrequency: string;
  collectionDay: string;
  collectionWindow: string;
  paymentStatus: HygienePaymentStatus;
  status: HygieneClientStatus;
  monthlyRevenue: number;
}

export interface HygieneSite {
  siteId: string;
  clientId: string;
  siteName: string;
  address: string;
  binCount: number;
  binSize: string;
  status: HygieneClientStatus;
}

export interface HygieneBinAsset {
  assetId: string;
  clientId: string;
  siteId: string;
  binSize: string;
  status: HygieneAssetStatus;
  installDate: string;
  lastServiceDate: string;
  nextServiceDate: string;
  condition: string;
}

export interface HygieneCollectionJob {
  collectionId: string;
  clientId: string;
  siteId: string;
  scheduledDate: string;
  scheduledTimeWindow: string;
  assignedDriver: string;
  vehicleRegistration: string;
  status: HygieneCollectionStatus;
  completedAt: string | null;
  evidencePhotoIds: string[];
  manifestId: string;
}

export interface HygieneWasteManifest {
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
  disposalFacility: string;
  disposalDate: string | null;
  disposalCertificateNo: string;
  status: HygieneManifestStatus;
}

export interface HygieneEvidencePhoto {
  photoId: string;
  clientId: string;
  siteId: string;
  collectionId: string;
  manifestId: string;
  category: HygienePhotoCategory;
  fileName: string;
  contentType: string;
  storagePath: string;
  downloadUrl: string;
  uploadedAt: string;
  uploadedByUid: string;
}

export interface HygieneVehicleInspection {
  inspectionId: string;
  date: string;
  vehicleRegistration: string;
  vehicle: string;
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
}

export interface HygieneComplianceDocument {
  documentId: string;
  title: string;
  referenceNo: string;
  status: HygieneDocumentStatus;
  issueDate: string | null;
  expiryDate: string | null;
  alert: string | null;
}

export interface HygieneDashboardKpis {
  activeClients: number;
  activeContracts: number;
  activeSites: number;
  activeBinAssets: number;
  collectionsDue: number;
  collectionsCompleted: number;
  complianceStatus: HygieneComplianceStatus;
  monthlyRevenue: number;
  wasteVolumeBinServices: number;
}

export interface HygieneDashboardData {
  kpis: HygieneDashboardKpis;
  clients: HygieneClient[];
  sites: HygieneSite[];
  assets: HygieneBinAsset[];
  collections: HygieneCollectionJob[];
  manifests: HygieneWasteManifest[];
  evidencePhotos: HygieneEvidencePhoto[];
  vehicleInspections: HygieneVehicleInspection[];
  driverLogs: HygieneDriverLog[];
  complianceDocuments: HygieneComplianceDocument[];
}
