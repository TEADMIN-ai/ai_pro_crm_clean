import type {
  HygieneBinAsset,
  HygieneClient,
  HygieneCollectionJob,
  HygieneComplianceDocument,
  HygieneDriverLog,
  HygieneSite,
  HygieneVehicleInspection,
  HygieneWasteManifest,
} from "@/types/hygiene";

export const HYGIENE_GENERATOR_REGISTRATION = "GPG-15-793";
export const HYGIENE_TRANSPORT_REGISTRATION = "GPT-15-858";
export const HYGIENE_COMPANY_REGISTRATION = "2024/105084/07";

export const cbavoClient: HygieneClient = {
  clientId: "TE-CLI-0001",
  clientName: "CBAVO Services",
  companyRegistration: HYGIENE_COMPANY_REGISTRATION,
  contactPerson: "CBAVO Site Coordinator",
  phone: "Not captured",
  email: "operations@cbavo.example",
  contractStartDate: "2026-06-18",
  contractEndDate: "2026-07-18",
  serviceFrequency: "Weekly",
  collectionDay: "Friday",
  collectionWindow: "After 13:00",
  paymentStatus: "Current",
  status: "Active",
  monthlyRevenue: 0,
};

export const cbavoSites: HygieneSite[] = [
  {
    siteId: "TE-SIT-0001",
    clientId: "TE-CLI-0001",
    siteName: "Florida Campus",
    address: "40/42 Goldman Street, Florida",
    binCount: 4,
    binSize: "12L",
    status: "Active",
  },
  {
    siteId: "TE-SIT-0002",
    clientId: "TE-CLI-0001",
    siteName: "Ontdekkers Campus",
    address: "Ontdekkers, Roodepoort",
    binCount: 5,
    binSize: "12L",
    status: "Active",
  },
];

export const cbavoBinAssets: HygieneBinAsset[] = Array.from({ length: 9 }, (_, index) => {
  const sequence = index + 1;
  const siteId = sequence <= 4 ? "TE-SIT-0001" : "TE-SIT-0002";

  return {
    assetId: `TE-BIN-2026-${String(sequence).padStart(4, "0")}`,
    clientId: "TE-CLI-0001",
    siteId,
    binSize: "12L",
    status: "Active",
    installDate: "2026-06-18",
    lastServiceDate: "2026-06-19",
    nextServiceDate: "2026-06-26",
    condition: "Serviceable",
  };
});

export const cbavoCollections: HygieneCollectionJob[] = [
  {
    collectionId: "TE-COL-2026-0001",
    clientId: "TE-CLI-0001",
    siteId: "TE-SIT-0001",
    scheduledDate: "2026-06-19",
    scheduledTimeWindow: "After 13:00",
    assignedDriver: "C. Karanie",
    vehicleRegistration: "JG 71 RS GP",
    status: "Completed",
    completedAt: "2026-06-19T13:00:00+02:00",
    evidencePhotoIds: [],
    manifestId: "TE-WM-2026-0001",
  },
  {
    collectionId: "TE-COL-2026-0002",
    clientId: "TE-CLI-0001",
    siteId: "TE-SIT-0001",
    scheduledDate: "2026-06-26",
    scheduledTimeWindow: "After 13:00",
    assignedDriver: "C. Karanie",
    vehicleRegistration: "JG 71 RS GP",
    status: "Scheduled",
    completedAt: null,
    evidencePhotoIds: [],
    manifestId: "Pending",
  },
];

export const cbavoManifests: HygieneWasteManifest[] = [
  {
    manifestId: "TE-WM-2026-0001",
    collectionId: "TE-COL-2026-0001",
    clientId: "TE-CLI-0001",
    siteId: "TE-SIT-0001",
    generatorRegistration: HYGIENE_GENERATOR_REGISTRATION,
    transportRegistration: HYGIENE_TRANSPORT_REGISTRATION,
    wasteClassification: "HW19",
    wasteType: "Sanitary/Feminine Hygiene Waste",
    quantity: 4,
    unit: "12L bins",
    collectionDate: "2026-06-19",
    disposalFacility: "Pending disposal facility confirmation",
    disposalDate: null,
    disposalCertificateNo: "Pending",
    status: "Pending Disposal",
  },
  {
    manifestId: "TE-WM-2026-0002",
    collectionId: "TE-COL-2026-0001",
    clientId: "TE-CLI-0001",
    siteId: "TE-SIT-0002",
    generatorRegistration: HYGIENE_GENERATOR_REGISTRATION,
    transportRegistration: HYGIENE_TRANSPORT_REGISTRATION,
    wasteClassification: "HW19",
    wasteType: "Sanitary/Feminine Hygiene Waste",
    quantity: 5,
    unit: "12L bins",
    collectionDate: "2026-06-19",
    disposalFacility: "Pending disposal facility confirmation",
    disposalDate: null,
    disposalCertificateNo: "Pending",
    status: "Pending Disposal",
  },
];

export const cbavoVehicleInspections: HygieneVehicleInspection[] = [
  {
    inspectionId: "TE-VI-2026-0001",
    date: "2026-06-19",
    vehicleRegistration: "JG 71 RS GP",
    vehicle: "Nissan NP200",
    driver: "C. Karanie",
    odometerStart: null,
    odometerEnd: null,
    fuelStatus: "Operational",
    roadworthyStatus: "Roadworthy",
    ppeAvailable: true,
    spillKitAvailable: true,
    wasteContainerSecured: true,
    comments: "First CBAVO hygiene collection vehicle inspection passed.",
    status: "Passed",
  },
];

export const cbavoDriverLogs: HygieneDriverLog[] = [
  {
    driverLogId: "TE-DL-2026-0001",
    date: "2026-06-19",
    driverName: "C. Karanie",
    vehicleRegistration: "JG 71 RS GP",
    startKm: null,
    endKm: null,
    fuel: "R200 Diesel",
    signatureStatus: "Pending signature capture",
  },
];

export const cbavoComplianceDocuments: HygieneComplianceDocument[] = [
  {
    documentId: "TE-HC-WASTE-GENERATOR",
    title: "Waste Generator Certificate",
    referenceNo: HYGIENE_GENERATOR_REGISTRATION,
    status: "On File",
    issueDate: null,
    expiryDate: null,
    alert: null,
  },
  {
    documentId: "TE-HC-WASTE-TRANSPORTER",
    title: "Waste Transporter Certificate",
    referenceNo: HYGIENE_TRANSPORT_REGISTRATION,
    status: "On File",
    issueDate: null,
    expiryDate: "2027-05-08",
    alert: "GPT-15-858 expires 2027-05-08",
  },
  {
    documentId: "TE-HC-COIDA",
    title: "COIDA",
    referenceNo: "Pending upload",
    status: "Missing",
    issueDate: null,
    expiryDate: null,
    alert: "Upload required",
  },
  {
    documentId: "TE-HC-SERVICE-AGREEMENT",
    title: "Service Agreement",
    referenceNo: "CBAVO Services",
    status: "On File",
    issueDate: "2026-06-18",
    expiryDate: "2026-07-18",
    alert: null,
  },
  {
    documentId: "TE-HC-SLA",
    title: "SLA",
    referenceNo: "CBAVO Weekly Friday After 13:00",
    status: "On File",
    issueDate: "2026-06-18",
    expiryDate: "2026-07-18",
    alert: null,
  },
  {
    documentId: "TE-HC-SIGNED-QUOTATION",
    title: "Signed Quotation",
    referenceNo: "CBAVO Hygiene Onboarding",
    status: "On File",
    issueDate: "2026-06-18",
    expiryDate: null,
    alert: null,
  },
  {
    documentId: "TE-HC-DISPOSAL-CERTIFICATES",
    title: "Disposal Certificates",
    referenceNo: "Pending",
    status: "Missing",
    issueDate: null,
    expiryDate: null,
    alert: "Add disposal certificate number after disposal confirmation",
  },
];
