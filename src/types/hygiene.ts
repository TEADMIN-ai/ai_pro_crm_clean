export type HygieneInternalRole = "admin" | "manager" | "staff" | "driver";
export type HygieneClientPortalRole = "hygieneClient" | "hygieneContractor";
export type HygieneAccessMode = "internal" | "clientPortal";
export type HygieneRecordClassification = "PRODUCTION" | "TEST" | "DEMO" | "ARCHIVED";

export type HygieneClientStatus = "Active" | "Pending" | "Inactive" | "Suspended";
export type HygienePaymentStatus = "Paid" | "Pending" | "Overdue";
export type HygieneAssetStatus = "Active" | "Pending" | "In Maintenance" | "Retired";
export type HygieneCollectionStatus = "Scheduled" | "In Progress" | "Awaiting Disposal" | "Completed" | "Overdue" | "Cancelled" | "Rescheduled";
export type HygieneCollectionOutcome = "waste_collected" | "zero_waste" | "cancelled";
export type HygieneManifestDisplayStatus = "generated" | "pending_generation" | "zero_waste_record" | "not_applicable_cancelled";
export type HygieneManifestStatus = "Draft" | "Generated" | "In Transit" | "Awaiting Disposal" | "Disposed" | "Certified" | "Disposal Pending" | "Certificate Received" | "Completed";
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
  | "Completion Photo"
  | "Disposal Certificate"
  | "Scale Ticket"
  | "Incident Photo";

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
  "Disposal Certificate",
  "Scale Ticket",
  "Incident Photo",
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
  recordClassification: HygieneRecordClassification;
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

export interface HygieneGpsLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string;
}

export interface HygieneCollection {
  collectionId: string;
  clientId: string;
  siteId: string;
  scheduledDate: string;
  scheduledTimeWindow: string;
  assignedDriver: string;
  assignedUserIds?: string[];
  vehicleRegistration: string;
  vehicleName: string;
  status: HygieneCollectionStatus;
  collectionOutcome?: HygieneCollectionOutcome;
  arrivalTime: string | null;
  departureTime: string | null;
  completedAt: string | null;
  manifestId: string;
  evidencePhotoIds: string[];
  clientSignatureStatus: string;
  clientSignatureId?: string | null;
  clientSignatureStoragePath?: string | null;
  clientSignatureFileUrl?: string | null;
  clientSignatureCapturedAt?: string | null;
  notes: string;
  workflowSteps: HygieneWorkflowStep[];
  completedSteps?: string[];
  currentStep?: string;
  progressPercentage?: number;
  stepTimestamps?: Record<string, string | null>;
  updatedAt?: string;
  updatedBy?: string;
  lastGpsLocation?: HygieneGpsLocation | null;
  backupVehicleUsed?: boolean;
  backupDriverUsed?: boolean;
  backupVehicleRegistration?: string | null;
  backupDriverName?: string | null;
  substitutionReason?: string | null;
  substitutionApprovedBy?: string | null;
  substitutionTimestamp?: string | null;
  binCountConfirmed?: number | null;
  adminOverrideReason?: string | null;
}

export type HygieneJobEventType =
  | "job_accepted"
  | "job_started"
  | "travelling_to_site"
  | "vehicle_inspection_completed"
  | "backup_vehicle_assigned"
  | "arrived_on_site"
  | "waste_collection_started"
  | "bin_serviced"
  | "evidence_uploaded"
  | "evidence_photos_captured"
  | "checklist_step_completed"
  | "customer_signature_captured"
  | "manifest_generated"
  | "signature_captured"
  | "waste_loaded"
  | "disposal_facility_confirmed"
  | "awaiting_disposal"
  | "disposal_certificate_uploaded"
  | "job_completed"
  | "collection_rescheduled"
  | "collection_cancelled"
  | "manifest_status_updated";

export interface HygieneJobEvent {
  eventId: string;
  eventType: HygieneJobEventType;
  clientId: string;
  siteId: string;
  collectionId: string;
  manifestId: string | null;
  userId: string;
  userEmail: string | null;
  timestamp: string;
  notes: string;
  metadata: Record<string, unknown>;
}

export interface HygieneSignature {
  signatureId: string;
  clientId: string;
  siteId: string;
  collectionId: string;
  manifestId: string | null;
  representativeName: string;
  representativePosition: string;
  signatureDataUrl?: string;
  signatureFileUrl: string | null;
  signatureStoragePath?: string | null;
  capturedBy: string;
  capturedAt: string;
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
  storagePath?: string | null;
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
  storagePath?: string | null;
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
  jobEvents?: HygieneJobEvent[];
  signatures?: HygieneSignature[];
}
