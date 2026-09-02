"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import TimelineStatusPanel from "@/components/vehicle-finance/TimelineStatusPanel";
import WorkflowProgressSummary from "@/components/vehicle-finance/WorkflowProgressSummary";
import VehicleFinanceApplicationOperationsPanel from "@/components/vehicle-finance/VehicleFinanceApplicationOperationsPanel";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import { buildVehicleFinanceDecisionFromIntelligence } from "@/lib/vehicle-finance/underwriting/decisionEngine";
import {
  getVehicleFinanceDocumentLabel,
  VEHICLE_FINANCE_DOCUMENT_TYPES,
  VEHICLE_FINANCE_PARTNER_VISIBLE_STATUSES,
  VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES,
  type VehicleFinanceApplication,
  type VehicleFinanceAssessment,
  type VehicleFinanceBusinessClient,
  type VehicleFinanceCertificate,
  type VehicleFinanceCustomer,
  type VehicleFinanceProcurementCase,
  type VehicleFinanceProcurementSummary,
  type VehicleFinanceSupplier,
  type VehicleFinanceSupplierQuote,
  type VehicleFinanceDocument,
  type VehicleFinanceDocumentType,
} from "@/types/vehicleFinance";
import type { RoarInventoryResponse } from "@/types/roarInventory";

type VehicleFinanceOverview = {
  metrics: {
    totalApplications: number;
    pendingVerification: number;
    verifiedApplications: number;
    fraudAlerts: number;
    approvalRatio: number;
    monthlyDealValue: number;
  };
  customers: VehicleFinanceCustomer[];
  applications: VehicleFinanceApplication[];
  documents: VehicleFinanceDocument[];
  assessments: VehicleFinanceAssessment[];
  certificates: VehicleFinanceCertificate[];
  businessClients: VehicleFinanceBusinessClient[];
  suppliers: VehicleFinanceSupplier[];
  procurementCases: VehicleFinanceProcurementCase[];
  supplierQuotes: VehicleFinanceSupplierQuote[];
  procurementSummary: VehicleFinanceProcurementSummary;
};

type VehicleFinanceDriverLicenceIntelligenceJobResponse = {
  jobId: string;
  status: string;
};

type VehicleFinanceDriverLicenceIntelligenceStatusResponse = {
  job?: {
    jobId: string;
    status: string;
    errorMessage?: string | null;
  };
  document?: VehicleFinanceDocument | null;
  driverLicenceIntelligence?: unknown;
};

type Section = "dashboard" | "customers" | "business-clients" | "supply-chain" | "procurement-cases" | "applications" | "document-verification" | "certificates" | "reports";

type Props = {
  initialSection: Section;
  initialApplicationId?: string;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  employer: string;
  monthlyIncome: string;
};

type ApplicationForm = {
  customerId: string;
  vehicleId: string;
  dealerName: string;
  dealValue: string;
};

type BusinessClientForm = { legalName: string; tradingName: string; registrationNumber: string; vatNumber: string; industry: string; accountStatus: string; primaryContact: string; procurementContact: string; phone: string; email: string; registeredAddress: string; billingAddress: string; accountManager: string; preferredTransactionMethod: string; procurementNotes: string };
type SupplierForm = { legalName: string; tradingName: string; supplierCategory: string; classification: string; brandsRepresented: string; branchLocation: string; primarySalesContact: string; fleetContact: string; email: string; phone: string; relationshipStatus: string; preferredSupplier: boolean; quoteTurnaroundNotes: string; geographicCoverage: string; commercialNotes: string };
type ProcurementCaseForm = { businessClientId: string; clientRequestor: string; internalReference: string; clientReferenceNumber: string; accountOwner: string; vehicleQuantity: string; make: string; model: string; variant: string; fuelType: string; colour: string; requiredSpecifications: string; condition: string; purchaseMethod: string; budget: string; requiredDeliveryDate: string; notes: string };
type SupplierQuoteForm = { procurementCaseId: string; supplierId: string; vehicleDescription: string; quotedAmount: string; availability: string; quoteDate: string; quoteExpiry: string; supplierReference: string; colourSpecification: string; quoteState: string; notes: string };
type PartnerStatusPublicationForm = { supplierQuoteId: string; partnerVisibleStatus: string; messageTemplateId: string; reviewedCustomMessage: string; reviewedCustomMessageApproved: boolean };

const EMPTY_CUSTOMER_FORM: CustomerForm = {
  firstName: "",
  lastName: "",
  idNumber: "",
  phone: "",
  email: "",
  address: "",
  employer: "",
  monthlyIncome: "",
};

const EMPTY_APPLICATION_FORM: ApplicationForm = {
  customerId: "",
  vehicleId: "",
  dealerName: "",
  dealValue: "",
};
const EMPTY_BUSINESS_CLIENT_FORM: BusinessClientForm = { legalName: "", tradingName: "", registrationNumber: "", vatNumber: "", industry: "", accountStatus: "ACTIVE", primaryContact: "", procurementContact: "", phone: "", email: "", registeredAddress: "", billingAddress: "", accountManager: "", preferredTransactionMethod: "", procurementNotes: "" };
const EMPTY_SUPPLIER_FORM: SupplierForm = { legalName: "", tradingName: "", supplierCategory: "DEALER", classification: "FRANCHISE", brandsRepresented: "", branchLocation: "", primarySalesContact: "", fleetContact: "", email: "", phone: "", relationshipStatus: "CONFIRMED", preferredSupplier: false, quoteTurnaroundNotes: "", geographicCoverage: "", commercialNotes: "" };
const EMPTY_PROCUREMENT_CASE_FORM: ProcurementCaseForm = { businessClientId: "", clientRequestor: "", internalReference: "", clientReferenceNumber: "", accountOwner: "", vehicleQuantity: "1", make: "", model: "", variant: "", fuelType: "", colour: "", requiredSpecifications: "", condition: "NEW", purchaseMethod: "PURCHASE_ORDER", budget: "", requiredDeliveryDate: "", notes: "" };
const EMPTY_SUPPLIER_QUOTE_FORM: SupplierQuoteForm = { procurementCaseId: "", supplierId: "", vehicleDescription: "", quotedAmount: "", availability: "", quoteDate: "", quoteExpiry: "", supplierReference: "", colourSpecification: "", quoteState: "SUBMITTED", notes: "" };
const EMPTY_PARTNER_STATUS_PUBLICATION_FORM: PartnerStatusPublicationForm = { supplierQuoteId: "", partnerVisibleStatus: "UNDER_REVIEW", messageTemplateId: "under_review_default", reviewedCustomMessage: "", reviewedCustomMessageApproved: false };

const EMPTY_CUSTOMERS: VehicleFinanceCustomer[] = [];
const EMPTY_APPLICATIONS: VehicleFinanceApplication[] = [];
const EMPTY_DOCUMENTS: VehicleFinanceDocument[] = [];
const EMPTY_CERTIFICATES: VehicleFinanceCertificate[] = [];
const EMPTY_BUSINESS_CLIENTS: VehicleFinanceBusinessClient[] = [];
const EMPTY_SUPPLIERS: VehicleFinanceSupplier[] = [];
const EMPTY_PROCUREMENT_CASES: VehicleFinanceProcurementCase[] = [];
const EMPTY_SUPPLIER_QUOTES: VehicleFinanceSupplierQuote[] = [];

const SECTION_TITLES: Record<Section, string> = {
  dashboard: "Vehicle Dashboard",
  customers: "Individual Customers",
  "business-clients": "Business Clients",
  "supply-chain": "Supply Chain",
  "procurement-cases": "Procurement Cases",
  applications: "Finance Applications",
  "document-verification": "Document Verification",
  certificates: "Finance Certificates",
  reports: "Executive Reports",
};

function formatDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ExtractedFieldEvidence = {
  value?: unknown;
  confidence?: number | null;
  sourceText?: unknown;
} | null | undefined;

function renderPrimitive(value: unknown, fallback = "Not detected"): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("en-ZA") : fallback;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toLocaleString("en-ZA");
  }

  if (Array.isArray(value)) {
    const joined = value.map((item) => renderPrimitive(item, "")).filter(Boolean).join(", ");
    return joined || fallback;
  }

  if (typeof value === "object") {
    const record = value as { value?: unknown; sourceText?: unknown };
    const primitiveValue = renderPrimitive(record.value, "");
    if (primitiveValue) return primitiveValue;
    const sourceText = renderPrimitive(record.sourceText, "");
    if (sourceText) return sourceText;
    return fallback;
  }

  return String(value);
}

function formatConfidence(confidence?: number | null): string {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return "Pending analysis";
  }

  const normalized = Math.max(0, Math.min(100, Math.round(confidence)));
  return `${normalized}%`;
}

function renderExtractedField(field: ExtractedFieldEvidence, fallback = "Not detected") {
  const confidence = typeof field?.confidence === "number" && Number.isFinite(field.confidence)
    ? Math.max(0, Math.min(100, Math.round(field.confidence)))
    : null;

  return {
    value: renderPrimitive(field?.value, fallback),
    confidence,
    confidenceLabel: confidence === null ? "Pending analysis" : `${confidence}%`,
    sourceText: renderPrimitive(field?.sourceText, ""),
    isLowConfidence: confidence !== null && confidence < 70,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function VehicleFinanceWorkspace({ initialSection, initialApplicationId }: Props) {
  const section = initialSection;
  const [overview, setOverview] = useState<VehicleFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);
  const [applicationForm, setApplicationForm] = useState<ApplicationForm>(EMPTY_APPLICATION_FORM);
  const [businessClientForm, setBusinessClientForm] = useState<BusinessClientForm>(EMPTY_BUSINESS_CLIENT_FORM);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(EMPTY_SUPPLIER_FORM);
  const [procurementCaseForm, setProcurementCaseForm] = useState<ProcurementCaseForm>(EMPTY_PROCUREMENT_CASE_FORM);
  const [supplierQuoteForm, setSupplierQuoteForm] = useState<SupplierQuoteForm>(EMPTY_SUPPLIER_QUOTE_FORM);
  const [partnerStatusPublicationForm, setPartnerStatusPublicationForm] = useState<PartnerStatusPublicationForm>(EMPTY_PARTNER_STATUS_PUBLICATION_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<VehicleFinanceDocumentType, File>>>({});
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>(initialApplicationId ?? "");
  const [inventory, setInventory] = useState<RoarInventoryResponse | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [selectedInventoryVehicleId, setSelectedInventoryVehicleId] = useState<string>("");
  const [timeline, setTimeline] = useState<{
    auditLogs: Array<{ id: string; eventType?: string; timestamp?: string; metadata?: Record<string, unknown>; targetId?: string }>;
    decisionLogs: Array<{ id: string; triggerEvent?: string; reasonForChange?: string; timestamp?: string; previousReadinessScore?: number | null; newReadinessScore?: number | null }>;
    assessment: VehicleFinanceAssessment | null;
  } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineSyncPending, setTimelineSyncPending] = useState(false);

  const loadOverview = useCallback(async (preferredApplicationId?: string) => {
    try {
      setLoading(true);
      const response = await authFetch("/api/vehicle-finance/overview", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as VehicleFinanceOverview & { error?: string } | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? `Vehicle finance overview request failed (${response.status})`);
      }

      setOverview(payload);
      setError(null);
      const hasApplication = (applicationId: string) =>
        payload.applications.some((application) => application.applicationId === applicationId);
      const matchingApplicationId = preferredApplicationId && hasApplication(preferredApplicationId)
        ? preferredApplicationId
        : initialApplicationId
        ? payload.applications.find((application) => application.applicationId === initialApplicationId)?.applicationId ?? null
        : null;

      if (matchingApplicationId) {
        setSelectedApplicationId((current) =>
          preferredApplicationId === matchingApplicationId ? matchingApplicationId : hasApplication(current) ? current : matchingApplicationId,
        );
      } else if (payload.applications[0]?.applicationId) {
        const fallbackApplicationId = payload.applications[0].applicationId;
        setSelectedApplicationId((current) => (hasApplication(current) ? current : fallbackApplicationId));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Vehicle finance overview unavailable");
    } finally {
      setLoading(false);
    }
  }, [initialApplicationId]);

  useEffect(() => {
    const controller = new AbortController();

    authFetch(API_ROUTES.VEHICLE_FINANCE_ROAR_INVENTORY, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as (RoarInventoryResponse & { error?: string }) | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? `Inventory request failed (${response.status})`);
        }

        setInventory(payload);
        setInventoryError(payload.warning ?? null);
      })
      .catch((inventoryLoadError: unknown) => {
        if (!controller.signal.aborted) {
          setInventory(null);
          setInventoryError(inventoryLoadError instanceof Error ? inventoryLoadError.message : "Live inventory temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setInventoryLoading(false);
      });

    return () => controller.abort();
  }, []);

  const loadTimeline = useCallback(async (applicationId: string) => {
    if (!applicationId) {
      setTimeline(null);
      setTimelineSyncPending(false);
      return;
    }

    try {
      setTimelineLoading(true);
      const response = await authFetch(`/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}/timeline`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as NonNullable<typeof timeline> & { error?: string } | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? `Timeline request failed (${response.status})`);
      }
      setTimeline(payload);
      setTimelineSyncPending(false);
    } catch (timelineError) {
      setTimeline({
        auditLogs: [],
        decisionLogs: [],
        assessment: null,
      });
      setTimelineSyncPending(true);
      console.warn("[vehicle-finance] Timeline sync deferred", {
        applicationId,
        error: timelineError instanceof Error ? timelineError.message : "Unknown timeline error",
      });
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedApplicationId) {
      void loadTimeline(selectedApplicationId);
    }
  }, [loadTimeline, selectedApplicationId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const customers = overview?.customers ?? EMPTY_CUSTOMERS;
  const applications = overview?.applications ?? EMPTY_APPLICATIONS;
  const documents = overview?.documents ?? EMPTY_DOCUMENTS;
  const certificates = overview?.certificates ?? EMPTY_CERTIFICATES;
  const businessClients = overview?.businessClients ?? EMPTY_BUSINESS_CLIENTS;
  const suppliers = overview?.suppliers ?? EMPTY_SUPPLIERS;
  const procurementCases = overview?.procurementCases ?? EMPTY_PROCUREMENT_CASES;
  const supplierQuotes = overview?.supplierQuotes ?? EMPTY_SUPPLIER_QUOTES;
  const procurementSummary = overview?.procurementSummary ?? { activeBusinessClients: 0, activeProcurementCases: 0, registeredSuppliers: 0, quotesAwaitingClientDecision: 0, vehiclesPendingDelivery: 0 };

  const selectedPartnerStatusQuote = useMemo(() => supplierQuotes.find((quote) => quote.supplierQuoteId === partnerStatusPublicationForm.supplierQuoteId) ?? null, [partnerStatusPublicationForm.supplierQuoteId, supplierQuotes]);
  const selectedPartnerStatusCase = useMemo(() => selectedPartnerStatusQuote ? procurementCases.find((item) => item.procurementCaseId === selectedPartnerStatusQuote.procurementCaseId) ?? null : null, [procurementCases, selectedPartnerStatusQuote]);
  const selectedPartnerStatusSupplier = useMemo(() => selectedPartnerStatusQuote ? suppliers.find((supplier) => supplier.supplierId === selectedPartnerStatusQuote.supplierId) ?? null : null, [selectedPartnerStatusQuote, suppliers]);
  const partnerMessageTemplatesForStatus = useMemo(() => VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES.filter((template) => template.status === partnerStatusPublicationForm.partnerVisibleStatus), [partnerStatusPublicationForm.partnerVisibleStatus]);
  const selectedPartnerMessageTemplate = useMemo(() => partnerMessageTemplatesForStatus.find((template) => template.messageTemplateId === partnerStatusPublicationForm.messageTemplateId) ?? null, [partnerMessageTemplatesForStatus, partnerStatusPublicationForm.messageTemplateId]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.applicationId === selectedApplicationId) ?? null,
    [applications, selectedApplicationId],
  );

  const inventoryVehicles = useMemo(
    () => inventory?.vehicles.filter((vehicle) => !/sold|inactive|reserved|unavailable/i.test(vehicle.status)) ?? [],
    [inventory?.vehicles],
  );
  const selectedInventoryVehicle = useMemo(
    () => inventoryVehicles.find((vehicle) => vehicle.id === selectedInventoryVehicleId) ?? null,
    [inventoryVehicles, selectedInventoryVehicleId],
  );

  const selectedDocuments = useMemo(
    () => documents.filter((document) => document.applicationId === selectedApplicationId),
    [documents, selectedApplicationId],
  );

  const selectedDriverLicenceDocument = useMemo(
    () => selectedDocuments.find((document) => document.documentType === "driversLicense") ?? null,
    [selectedDocuments],
  );

  const selectedIdentityDocument = useMemo(
    () => selectedDocuments.find((document) => document.documentType === "greenIdBook" || document.documentType === "smartIdCard") ?? null,
    [selectedDocuments],
  );

  const selectedPayslipDocument = useMemo(
    () => selectedDocuments.find((document) => document.documentType === "payslip") ?? null,
    [selectedDocuments],
  );

  const selectedBankStatementDocument = useMemo(
    () => selectedDocuments.find((document) => document.documentType === "bankStatement") ?? null,
    [selectedDocuments],
  );

  const selectedDriverLicenceIntelligence = useMemo(
    () => (selectedDriverLicenceDocument?.aiAnalysis as any)?.driverLicenceIntelligence ?? null,
    [selectedDriverLicenceDocument],
  );

  const selectedIdentityIntelligence = useMemo(
    () => (selectedIdentityDocument?.aiAnalysis as any)?.identityIntelligence ?? null,
    [selectedIdentityDocument],
  );

  const selectedPayslipIntelligence = useMemo(
    () => (selectedPayslipDocument?.aiAnalysis as any)?.payslipIntelligence ?? null,
    [selectedPayslipDocument],
  );

  const selectedBankStatementIntelligence = useMemo(
    () => (selectedBankStatementDocument?.aiAnalysis as any)?.bankStatementIntelligence ?? null,
    [selectedBankStatementDocument],
  );

  const financeDecision = useMemo(
    () =>
      buildVehicleFinanceDecisionFromIntelligence({
        driverLicence: selectedDriverLicenceIntelligence,
        identity: selectedIdentityIntelligence,
        payslip: selectedPayslipIntelligence,
        bankStatement: selectedBankStatementIntelligence,
      }),
    [
      selectedDriverLicenceIntelligence,
      selectedIdentityIntelligence,
      selectedPayslipIntelligence,
      selectedBankStatementIntelligence,
    ],
  );

  const certificateByApplicationId = useMemo(() => {
    return new Map(certificates.map((certificate) => [certificate.applicationId, certificate]));
  }, [certificates]);

  async function refresh(preferredApplicationId?: string) {
    await loadOverview(preferredApplicationId);
    const timelineApplicationId = preferredApplicationId || selectedApplicationId;
    if (timelineApplicationId) {
      await loadTimeline(timelineApplicationId);
    }
  }

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("customer");
      const response = await authFetch("/api/vehicle-finance/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: customerForm.firstName.trim(),
          lastName: customerForm.lastName.trim(),
          idNumber: customerForm.idNumber.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          address: customerForm.address.trim(),
          employer: customerForm.employer.trim(),
          monthlyIncome: Number(customerForm.monthlyIncome) || 0,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Customer create failed (${response.status})`);
      }
      setCustomerForm(EMPTY_CUSTOMER_FORM);
      await refresh();
    } catch (customerError) {
      setError(customerError instanceof Error ? customerError.message : "Customer creation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("application");
      const clientSubmissionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const vehicleId = applicationForm.vehicleId.trim() || selectedInventoryVehicle?.id || "";
      const vehicleSnapshot = selectedInventoryVehicle
        ? {
            vehicleInventoryId: selectedInventoryVehicle.id,
            vehicleTitle: selectedInventoryVehicle.title,
            vehiclePrice: selectedInventoryVehicle.priceNumber ?? selectedInventoryVehicle.price ?? null,
            vehicleYear: selectedInventoryVehicle.year,
            vehicleMileage: selectedInventoryVehicle.mileageNumber ?? selectedInventoryVehicle.mileage ?? null,
            vehicleImageUrl: selectedInventoryVehicle.imageUrl,
            vehicleListingUrl: selectedInventoryVehicle.listingUrl,
            inventorySource: "roarcarssa.com",
          }
        : null;

      const response = await authFetch("/api/vehicle-finance/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: applicationForm.customerId.trim(),
          vehicleId,
          clientSubmissionId,
          dealerName: applicationForm.dealerName.trim(),
          dealValue: Number(applicationForm.dealValue) || 0,
          ...(vehicleSnapshot ?? {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; application?: VehicleFinanceApplication } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Application create failed (${response.status})`);
      }
      const createdApplicationId = payload?.application?.applicationId ?? "";
      if (createdApplicationId) {
        setSelectedApplicationId(createdApplicationId);
      }
      setApplicationForm(EMPTY_APPLICATION_FORM);
      setSelectedInventoryVehicleId("");
      await refresh(createdApplicationId);
    } catch (applicationError) {
      setError(applicationError instanceof Error ? applicationError.message : "Application creation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitBusinessClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("businessClient");
      const response = await authFetch("/api/vehicle-finance/business-clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(businessClientForm) });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Business client create failed (${response.status})`);
      setBusinessClientForm(EMPTY_BUSINESS_CLIENT_FORM);
      await refresh();
    } catch (businessClientError) {
      setError(businessClientError instanceof Error ? businessClientError.message : "Business client creation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("supplier");
      const response = await authFetch("/api/vehicle-finance/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...supplierForm, brandsRepresented: supplierForm.brandsRepresented.split(",").map((item) => item.trim()).filter(Boolean) }) });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Supplier create failed (${response.status})`);
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      await refresh();
    } catch (supplierError) {
      setError(supplierError instanceof Error ? supplierError.message : "Supplier creation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitProcurementCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("procurementCase");
      const response = await authFetch("/api/vehicle-finance/procurement-cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...procurementCaseForm, vehicleQuantity: Number(procurementCaseForm.vehicleQuantity) || 1, budget: Number(procurementCaseForm.budget) || null }) });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Procurement case create failed (${response.status})`);
      setProcurementCaseForm(EMPTY_PROCUREMENT_CASE_FORM);
      await refresh();
    } catch (procurementCaseError) {
      setError(procurementCaseError instanceof Error ? procurementCaseError.message : "Procurement case creation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitSupplierQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("supplierQuote");
      const response = await authFetch("/api/vehicle-finance/supplier-quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...supplierQuoteForm, quotedAmount: Number(supplierQuoteForm.quotedAmount) || 0 }) });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Supplier quote create failed (${response.status})`);
      setSupplierQuoteForm(EMPTY_SUPPLIER_QUOTE_FORM);
      await refresh();
    } catch (supplierQuoteError) {
      setError(supplierQuoteError instanceof Error ? supplierQuoteError.message : "Supplier quote creation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitPartnerStatusPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy("partnerStatusPublication");
      const response = await authFetch("/api/vehicle-finance/supplier-quotes/" + encodeURIComponent(partnerStatusPublicationForm.supplierQuoteId) + "/partner-visible-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partnerStatusPublicationForm) });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Partner-visible status publication failed (" + response.status + ")");
      setPartnerStatusPublicationForm(EMPTY_PARTNER_STATUS_PUBLICATION_FORM);
      await refresh();
    } catch (publicationError) {
      setError(publicationError instanceof Error ? publicationError.message : "Partner-visible status publication failed");
    } finally {
      setBusy(null);
    }
  }

  async function uploadDocument(documentType: VehicleFinanceDocumentType) {
    if (!selectedApplicationId) return;
    const file = documentFiles[documentType];
    if (!file) {
      setError("Choose a PDF before uploading.");
      return;
    }
    const documentLabel = getVehicleFinanceDocumentLabel(documentType);

    try {
      setBusy(`upload:${documentType}`);
      const formData = new FormData();
      formData.append("documentType", documentType);
      formData.append("file", file);
      const response = await authFetch(
        `/api/vehicle-finance/applications/${encodeURIComponent(selectedApplicationId)}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            document?: VehicleFinanceDocument & {
              intelligenceJob?: VehicleFinanceDriverLicenceIntelligenceJobResponse | null;
            };
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Document upload failed (${response.status})`);
      }
      const intelligenceJob = payload?.document?.intelligenceJob ?? null;
      setDocumentFiles((current) => ({ ...current, [documentType]: undefined }));
      if (response.status === 202 && intelligenceJob?.jobId) {
        let currentStatus = intelligenceJob.status;
        let attempts = 0;

        while (currentStatus === "QUEUED" || currentStatus === "PROCESSING") {
          // Sequential polling keeps the request path short while the worker completes.
          // eslint-disable-next-line no-await-in-loop
          await sleep(1000);
          attempts += 1;
          // eslint-disable-next-line no-await-in-loop
          const statusResponse = await authFetch(
            `/api/vehicle-finance/applications/${encodeURIComponent(selectedApplicationId)}/documents/${encodeURIComponent(
              payload?.document?.documentId ?? "",
            )}/intelligence?jobId=${encodeURIComponent(intelligenceJob.jobId)}`,
            { cache: "no-store" },
          );
          // eslint-disable-next-line no-await-in-loop
          const statusPayload = (await statusResponse.json().catch(() => null)) as VehicleFinanceDriverLicenceIntelligenceStatusResponse | null;
          if (!statusResponse.ok || !statusPayload?.job) {
            throw new Error(statusPayload?.job?.errorMessage ?? `${documentLabel} intelligence status failed (${statusResponse.status})`);
          }
          currentStatus = statusPayload.job.status;
          if (attempts >= 30 && (currentStatus === "QUEUED" || currentStatus === "PROCESSING")) {
            throw new Error(`${documentLabel} intelligence is still processing.`);
          }
        }
        if (currentStatus === "FAILED") {
          throw new Error(`${documentLabel} intelligence failed.`);
        }
      }
      await refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function verifySelectedApplication() {
    if (!selectedApplicationId) return;
    try {
      setBusy("verify");
      const response = await authFetch(`/api/vehicle-finance/applications/${encodeURIComponent(selectedApplicationId)}/verify`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Verification failed (${response.status})`);
      }
      await refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateCertificate(applicationId: string) {
    try {
      setBusy(`certificate:${applicationId}`);
      const response = await authFetch(
        `/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}/certificate`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Certificate generation failed (${response.status})`);
      }
      await refresh();
      if (payload && typeof (payload as { certificate?: { certificateUrl?: string } }).certificate?.certificateUrl === "string") {
        window.open((payload as { certificate: { certificateUrl: string } }).certificate.certificateUrl, "_blank", "noopener,noreferrer");
      }
    } catch (certificateError) {
      setError(certificateError instanceof Error ? certificateError.message : "Certificate generation failed");
    } finally {
      setBusy(null);
    }
  }

  const reportLinks = {
    csv: "/api/vehicle-finance/reports?format=csv&period=monthly",
    excel: "/api/vehicle-finance/reports?format=excel&period=monthly",
    pdf: "/api/vehicle-finance/reports?format=pdf&period=monthly",
  } as const;

  return (
    <div data-module="vehicle-finance" className="tex-shell space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-200/70">Torque Empire Car Division</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{SECTION_TITLES[section]}</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Torque Empire Car Division operations for individual finance, business clients, supplier sourcing, procurement cases, and reporting.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}

      {loading && !overview ? (
        <Card>
          <p className="text-sm text-slate-300">Loading vehicle finance workspace...</p>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap gap-2">
          {[
            ["/dashboard/vehicle-finance/customers", "Individual Customers"],
            ["/dashboard/vehicle-finance/business-clients", "Business Clients"],
            ["/dashboard/vehicle-finance/supply-chain", "Supply Chain"],
            ["/dashboard/vehicle-finance/procurement-cases", "Procurement Cases"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100">
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          {[
            ["Active Business Clients", procurementSummary.activeBusinessClients],
            ["Active Procurement Cases", procurementSummary.activeProcurementCases],
            ["Registered Suppliers", procurementSummary.registeredSuppliers],
            ["Quotes Awaiting Client Decision", procurementSummary.quotesAwaitingClientDecision],
            ["Vehicles Pending Delivery", procurementSummary.vehiclesPendingDelivery],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {section === "dashboard" ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Object.entries(overview?.metrics ?? {}).map(([key, value]) => (
              <Card key={key}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {key.replace(/([A-Z])/g, " $1")}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950">{String(value)}</h2>
              </Card>
            ))}
          </div>

          <Card>
            <IdentityCardHeader title="Executive Summary" subtitle="Single finance recommendation from all intelligence layers">
              <div className="flex flex-wrap gap-2">
                <Badge tone={financeDecision.riskLevel === "LOW" ? "success" : financeDecision.riskLevel === "MEDIUM" ? "warning" : "danger"}>
                  {financeDecision.riskLevel}
                </Badge>
                <Badge tone={financeDecision.recommendedDecision === "PROCEED" ? "success" : financeDecision.recommendedDecision === "REFER" ? "warning" : "danger"}>
                  {financeDecision.recommendedDecision}
                </Badge>
              </div>
            </IdentityCardHeader>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance Readiness Score</p>
                <p className="mt-2 text-3xl font-semibold text-slate-50">{financeDecision.financeReadinessScore}</p>
                <p className="mt-2 text-sm text-slate-400">{financeDecision.decisionReason}</p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verified Income</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{financeDecision.incomeVerified ? "YES" : "NO"}</p>
                <p className="mt-2 text-sm text-slate-400">Match score: {financeDecision.incomeVerificationScore}%</p>
                <p className="mt-2 text-sm text-slate-400">Disposable income: R {financeDecision.disposableIncome.toLocaleString("en-ZA")}</p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Instalment</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">R {financeDecision.recommendedInstalment.toLocaleString("en-ZA")}</p>
                <p className="mt-2 text-sm text-slate-400">Fraud score: {financeDecision.fraudRiskScore}%</p>
                <p className="mt-2 text-sm text-slate-400">Risk level: {financeDecision.riskLevel}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Certification Requirements</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {financeDecision.certificationRequirements.map((item) => (
                  <Badge key={item} tone={item === "All certification requirements satisfied" ? "success" : "warning"}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <IdentityCardHeader title="Recent Applications" subtitle="Current pipeline and fraud status">
              <Badge tone={overview && overview.metrics.fraudAlerts > 0 ? "warning" : "success"}>
                {overview ? `${overview.metrics.fraudAlerts} Fraud Alerts` : "No Data"}
              </Badge>
            </IdentityCardHeader>
            <Table>
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Dealer</th>
                  <th>Status</th>
                  <th>Fraud Score</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 8).map((application) => (
                  <tr key={application.applicationId}>
                    <td>{application.applicationId}</td>
                    <td>{application.dealerName}</td>
                    <td>{application.applicationStatus}</td>
                    <td>{application.fraudScore}</td>
                    <td>{application.verificationStatus}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ) : null}

      {section === "customers" ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <IdentityCardHeader title="Create Customer" subtitle="Capture finance lead details" />
            <form className="mt-4 grid gap-3" onSubmit={submitCustomer}>
              {[
                ["firstName", "First Name"],
                ["lastName", "Last Name"],
                ["idNumber", "ID Number"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["address", "Address"],
                ["employer", "Employer"],
                ["monthlyIncome", "Monthly Income"],
              ].map(([field, label]) => (
                <label key={field} className="grid gap-1 text-sm text-slate-300">
                  <span>{label}</span>
                  <input
                    value={customerForm[field as keyof CustomerForm]}
                    onChange={(event) =>
                      setCustomerForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    type={field === "email" ? "email" : field === "monthlyIncome" ? "number" : "text"}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={busy === "customer"}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {busy === "customer" ? "Saving..." : "Save Customer"}
              </button>
            </form>
          </Card>

          <Card>
            <IdentityCardHeader title="Customers" subtitle="Stored in vehicleFinanceCustomers" />
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID Number</th>
                  <th>Employer</th>
                  <th>Income</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.customerId}>
                    <td>{`${customer.firstName} ${customer.lastName}`}</td>
                    <td>{customer.idNumber}</td>
                    <td>{customer.employer || "n/a"}</td>
                    <td>{customer.monthlyIncome.toLocaleString("en-ZA")}</td>
                    <td>{formatDate(customer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      ) : null}

      {section === "business-clients" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <IdentityCardHeader title="Create Business Client" subtitle="Separate governed B2B procurement account" />
            <form className="mt-4 grid gap-3" onSubmit={submitBusinessClient}>
              {[
                ["legalName", "Legal / Business Name"], ["tradingName", "Trading Name"], ["registrationNumber", "Registration Number"], ["vatNumber", "VAT Number"], ["industry", "Industry"], ["primaryContact", "Primary Contact"], ["procurementContact", "Procurement Contact"], ["phone", "Phone"], ["email", "Email"], ["registeredAddress", "Registered Address"], ["billingAddress", "Billing Address"], ["accountManager", "Account Manager"], ["preferredTransactionMethod", "Preferred Payment Method"], ["procurementNotes", "Commercial Notes"]
              ].map(([field, label]) => (
                <label key={field} className="grid gap-1 text-sm text-slate-300">
                  <span>{label}</span>
                  <input value={businessClientForm[field as keyof BusinessClientForm] as string} onChange={(event) => setBusinessClientForm((current) => ({ ...current, [field]: event.target.value }))} type={field === "email" ? "email" : "text"} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
              ))}
              <label className="grid gap-1 text-sm text-slate-300"><span>Client / Account Status</span><select value={businessClientForm.accountStatus} onChange={(event) => setBusinessClientForm((current) => ({ ...current, accountStatus: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="ACTIVE">Active</option><option value="ON_HOLD">On Hold</option><option value="SUSPENDED">Suspended</option></select></label>
              <button type="submit" disabled={busy === "businessClient"} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">{busy === "businessClient" ? "Saving..." : "Save Business Client"}</button>
            </form>
          </Card>
          <Card>
            <IdentityCardHeader title="Business Clients" subtitle="Commercial clients remain separate from individual applicants"><Badge tone="neutral">{businessClients.length} total</Badge></IdentityCardHeader>
            <Table className="mt-4"><thead><tr><th>Client</th><th>Status</th><th>Contacts</th><th>Procurement History</th></tr></thead><tbody>
              {businessClients.map((client) => {
                const clientCases = procurementCases.filter((item) => item.businessClientId === client.businessClientId);
                return <tr key={client.businessClientId}><td><p className="font-medium text-slate-100">{client.legalName}</p><p className="text-xs text-slate-400">{client.tradingName || client.registrationNumber}</p></td><td><Badge tone={client.accountStatus === "ACTIVE" ? "success" : "warning"}>{client.accountStatus}</Badge></td><td>{client.primaryContact}<p className="text-xs text-slate-400">{client.email}</p></td><td>{clientCases.length} total / {clientCases.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.lifecycleStatus)).length} active</td></tr>;
              })}
            </tbody></Table>
          </Card>
        </div>
      ) : null}

      {section === "supply-chain" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card><IdentityCardHeader title="Register Supplier" subtitle="Dealer and supplier canonical registry" /><form className="mt-4 grid gap-3" onSubmit={submitSupplier}>
            {[ ["legalName", "Supplier / Dealer Legal Name"], ["tradingName", "Trading / Branch Name"], ["brandsRepresented", "Brands Represented"], ["branchLocation", "Branch / Location"], ["primarySalesContact", "Primary Sales Contact"], ["fleetContact", "Fleet / Corporate Contact"], ["email", "Email"], ["phone", "Phone"], ["quoteTurnaroundNotes", "Quote Turnaround Notes"], ["geographicCoverage", "Geographic Coverage"], ["commercialNotes", "Commercial Notes"] ].map(([field, label]) => <label key={field} className="grid gap-1 text-sm text-slate-300"><span>{label}</span><input value={supplierForm[field as keyof SupplierForm] as string} onChange={(event) => setSupplierForm((current) => ({ ...current, [field]: event.target.value }))} type={field === "email" ? "email" : "text"} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>)}
            <label className="grid gap-1 text-sm text-slate-300"><span>Supplier Category</span><select value={supplierForm.supplierCategory} onChange={(event) => setSupplierForm((current) => ({ ...current, supplierCategory: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="DEALER">Dealer</option><option value="OEM">OEM</option><option value="BROKER">Broker</option><option value="FLEET_PARTNER">Fleet Partner</option><option value="OTHER">Other</option></select></label>
            <label className="grid gap-1 text-sm text-slate-300"><span>Classification</span><select value={supplierForm.classification} onChange={(event) => setSupplierForm((current) => ({ ...current, classification: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="FRANCHISE">Franchise</option><option value="INDEPENDENT">Independent</option><option value="OTHER">Other</option></select></label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={supplierForm.preferredSupplier} onChange={(event) => setSupplierForm((current) => ({ ...current, preferredSupplier: event.target.checked }))} /> Preferred supplier</label>
            <button type="submit" disabled={busy === "supplier"} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">{busy === "supplier" ? "Saving..." : "Save Supplier"}</button>
          </form></Card>
          <Card><IdentityCardHeader title="Supply Chain Registry" subtitle="Supplier opportunities and quotations"><Badge tone="neutral">{suppliers.length} total</Badge></IdentityCardHeader><Table className="mt-4"><thead><tr><th>Supplier</th><th>Relationship</th><th>Coverage</th><th>Opportunities</th></tr></thead><tbody>{suppliers.map((supplier) => { const quotes = supplierQuotes.filter((quote) => quote.supplierId === supplier.supplierId); return <tr key={supplier.supplierId}><td><p className="font-medium text-slate-100">{supplier.legalName}</p><p className="text-xs text-slate-400">{supplier.tradingName || supplier.brandsRepresented.join(", ") || "No brands recorded"}</p></td><td><Badge tone={supplier.preferredSupplier ? "success" : "info"}>{supplier.relationshipStatus}</Badge></td><td>{supplier.geographicCoverage || supplier.branchLocation || "Not recorded"}</td><td>{quotes.length} quotes / {quotes.filter((quote) => quote.quoteState === "SELECTED").length} selected</td></tr>; })}</tbody></Table></Card>
        </div>
      ) : null}

      {section === "procurement-cases" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card><IdentityCardHeader title="Create Procurement Case" subtitle="Governed corporate vehicle requirement" /><form className="mt-4 grid gap-3" onSubmit={submitProcurementCase}>
              <label className="grid gap-1 text-sm text-slate-300"><span>Business Client</span><select value={procurementCaseForm.businessClientId} onChange={(event) => setProcurementCaseForm((current) => ({ ...current, businessClientId: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Select business client</option>{businessClients.map((client) => <option key={client.businessClientId} value={client.businessClientId}>{client.legalName}</option>)}</select></label>
              {[ ["clientRequestor", "Client Contact / Requestor"], ["internalReference", "Internal Reference"], ["clientReferenceNumber", "Client RFQ / PO / Reference"], ["accountOwner", "Torque Empire Account Owner"], ["vehicleQuantity", "Vehicle Quantity"], ["make", "Make"], ["model", "Model"], ["variant", "Variant"], ["fuelType", "Fuel Type"], ["colour", "Colour"], ["requiredSpecifications", "Required Specifications"], ["budget", "Budget"], ["requiredDeliveryDate", "Required Delivery Date"], ["notes", "Notes"] ].map(([field, label]) => <label key={field} className="grid gap-1 text-sm text-slate-300"><span>{label}</span><input value={procurementCaseForm[field as keyof ProcurementCaseForm]} onChange={(event) => setProcurementCaseForm((current) => ({ ...current, [field]: event.target.value }))} type={field === "vehicleQuantity" || field === "budget" ? "number" : field === "requiredDeliveryDate" ? "date" : "text"} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>)}
              <label className="grid gap-1 text-sm text-slate-300"><span>Purchase Method</span><select value={procurementCaseForm.purchaseMethod} onChange={(event) => setProcurementCaseForm((current) => ({ ...current, purchaseMethod: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="CASH">Cash</option><option value="FINANCE">Finance</option><option value="LEASE">Lease</option><option value="PURCHASE_ORDER">Purchase Order</option><option value="OTHER">Other</option></select></label>
              <label className="grid gap-1 text-sm text-slate-300"><span>Condition</span><select value={procurementCaseForm.condition} onChange={(event) => setProcurementCaseForm((current) => ({ ...current, condition: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="NEW">New</option><option value="DEMO">Demo</option><option value="USED">Used</option></select></label>
              <button type="submit" disabled={busy === "procurementCase"} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">{busy === "procurementCase" ? "Saving..." : "Save Procurement Case"}</button>
            </form></Card>
            <Card><IdentityCardHeader title="Link Supplier Quote" subtitle="Quote must reference registered supplier and case" /><form className="mt-4 grid gap-3" onSubmit={submitSupplierQuote}>
              <label className="grid gap-1 text-sm text-slate-300"><span>Procurement Case</span><select value={supplierQuoteForm.procurementCaseId} onChange={(event) => setSupplierQuoteForm((current) => ({ ...current, procurementCaseId: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Select case</option>{procurementCases.map((item) => <option key={item.procurementCaseId} value={item.procurementCaseId}>{item.internalReference} / {item.make} {item.model}</option>)}</select></label>
              <label className="grid gap-1 text-sm text-slate-300"><span>Supplier</span><select value={supplierQuoteForm.supplierId} onChange={(event) => setSupplierQuoteForm((current) => ({ ...current, supplierId: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.legalName}</option>)}</select></label>
              {[ ["vehicleDescription", "Vehicle Description"], ["quotedAmount", "Quoted Amount"], ["availability", "Availability"], ["quoteDate", "Quote Date"], ["quoteExpiry", "Quote Expiry"], ["supplierReference", "Supplier Reference"], ["colourSpecification", "Colour / Specification"], ["notes", "Notes"] ].map(([field, label]) => <label key={field} className="grid gap-1 text-sm text-slate-300"><span>{label}</span><input value={supplierQuoteForm[field as keyof SupplierQuoteForm]} onChange={(event) => setSupplierQuoteForm((current) => ({ ...current, [field]: event.target.value }))} type={field === "quotedAmount" ? "number" : field === "quoteDate" || field === "quoteExpiry" ? "date" : "text"} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>)}
              <button type="submit" disabled={busy === "supplierQuote"} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">{busy === "supplierQuote" ? "Saving..." : "Save Supplier Quote"}</button>
            </form></Card>
            <Card><IdentityCardHeader title="Publish Partner Status" subtitle="Internal supplier-visible status publication" />
              <form className="mt-4 grid gap-3" onSubmit={submitPartnerStatusPublication}>
                <label className="grid gap-1 text-sm text-slate-300"><span>Supplier Quote</span><select value={partnerStatusPublicationForm.supplierQuoteId} onChange={(event) => setPartnerStatusPublicationForm((current) => ({ ...current, supplierQuoteId: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Select quote</option>{supplierQuotes.map((quote) => { const supplier = suppliers.find((entry) => entry.supplierId === quote.supplierId); const procurementCase = procurementCases.find((entry) => entry.procurementCaseId === quote.procurementCaseId); return <option key={quote.supplierQuoteId} value={quote.supplierQuoteId}>{supplier?.legalName ?? quote.supplierId} / {procurementCase?.internalReference ?? quote.procurementCaseId} / {quote.vehicleDescription}</option>; })}</select></label>
                <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300"><p><span className="text-slate-500">Current internal status:</span> {selectedPartnerStatusCase?.internalStatus ?? selectedPartnerStatusCase?.lifecycleStatus ?? "No quote selected"}</p><p><span className="text-slate-500">Current partner-visible status:</span> {selectedPartnerStatusQuote?.partnerVisibleStatus ?? "No quote selected"}</p><p><span className="text-slate-500">Supplier:</span> {selectedPartnerStatusSupplier?.legalName ?? "No quote selected"}</p></div>
                <label className="grid gap-1 text-sm text-slate-300"><span>Proposed Partner-Visible Status</span><select value={partnerStatusPublicationForm.partnerVisibleStatus} onChange={(event) => { const nextStatus = event.target.value; const defaultTemplate = VEHICLE_FINANCE_PARTNER_MESSAGE_TEMPLATES.find((template) => template.status === nextStatus); setPartnerStatusPublicationForm((current) => ({ ...current, partnerVisibleStatus: nextStatus, messageTemplateId: defaultTemplate?.messageTemplateId ?? "", reviewedCustomMessage: "", reviewedCustomMessageApproved: false })); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{VEHICLE_FINANCE_PARTNER_VISIBLE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label className="grid gap-1 text-sm text-slate-300"><span>Message Template</span><select value={partnerStatusPublicationForm.messageTemplateId} onChange={(event) => setPartnerStatusPublicationForm((current) => ({ ...current, messageTemplateId: event.target.value, reviewedCustomMessage: "", reviewedCustomMessageApproved: false }))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{partnerMessageTemplatesForStatus.map((template) => <option key={template.messageTemplateId} value={template.messageTemplateId}>{template.message}</option>)}</select></label>
                {selectedPartnerMessageTemplate?.reviewedCustomTextAllowed ? <label className="grid gap-1 text-sm text-slate-300"><span>Reviewed Custom Message</span><textarea value={partnerStatusPublicationForm.reviewedCustomMessage} onChange={(event) => setPartnerStatusPublicationForm((current) => ({ ...current, reviewedCustomMessage: event.target.value }))} rows={3} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label> : null}
                {selectedPartnerMessageTemplate?.reviewedCustomTextAllowed ? <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={partnerStatusPublicationForm.reviewedCustomMessageApproved} onChange={(event) => setPartnerStatusPublicationForm((current) => ({ ...current, reviewedCustomMessageApproved: event.target.checked }))} /> Reviewed custom supplier message approved</label> : null}
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300"><span className="text-slate-500">Rendered partner message:</span> {partnerStatusPublicationForm.reviewedCustomMessage && selectedPartnerMessageTemplate?.reviewedCustomTextAllowed && partnerStatusPublicationForm.reviewedCustomMessageApproved ? partnerStatusPublicationForm.reviewedCustomMessage : selectedPartnerMessageTemplate?.message ?? "Select a template"}</div>
                <button type="submit" disabled={!partnerStatusPublicationForm.supplierQuoteId || !partnerStatusPublicationForm.messageTemplateId || busy === "partnerStatusPublication"} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700">{busy === "partnerStatusPublication" ? "Publishing..." : "Publish Partner Status"}</button>
              </form>
            </Card>
          </div>
          <Card><IdentityCardHeader title="Procurement Cases" subtitle="Requirement, lifecycle and supplier quote comparison"><Badge tone="neutral">{procurementCases.length} total</Badge></IdentityCardHeader><div className="mt-4 space-y-4">{procurementCases.map((item) => { const client = businessClients.find((businessClient) => businessClient.businessClientId === item.businessClientId); const caseQuotes = supplierQuotes.filter((quote) => quote.procurementCaseId === item.procurementCaseId); return <div key={item.procurementCaseId} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-100">{item.internalReference} / {item.vehicleQuantity} x {item.make} {item.model}</p><p className="text-xs text-slate-400">{client?.legalName ?? item.businessClientId} / {item.clientRequestor}</p></div><Badge tone={item.lifecycleStatus === "COMPLETED" ? "success" : item.lifecycleStatus === "CANCELLED" ? "warning" : "info"}>{item.lifecycleStatus}</Badge></div><p className="mt-3 text-sm text-slate-300">{item.requiredSpecifications || item.notes || "No detailed specification recorded"}</p><Table className="mt-4"><thead><tr><th>Supplier</th><th>Quote</th><th>Availability</th><th>State</th></tr></thead><tbody>{caseQuotes.map((quote) => { const supplier = suppliers.find((entry) => entry.supplierId === quote.supplierId); return <tr key={quote.supplierQuoteId}><td>{supplier?.legalName ?? quote.supplierId}</td><td>{quote.quotedAmount.toLocaleString("en-ZA")}</td><td>{quote.availability}</td><td><Badge tone={quote.quoteState === "SELECTED" ? "success" : quote.quoteState === "DECLINED" ? "warning" : "neutral"}>{quote.quoteState}</Badge></td></tr>; })}</tbody></Table><p className="mt-3 text-xs text-slate-500">Activity events: {item.activityHistory.length}</p></div>; })}</div></Card>
        </div>
      ) : null}

      {section === "applications" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <IdentityCardHeader title="Create Application" subtitle="Start a structured vehicle finance case" />
            <form className="mt-4 grid gap-3" onSubmit={submitApplication}>
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inventory Feed</p>
                <p className="mt-2 text-sm text-slate-200">
                  {inventoryLoading
                    ? "Loading synchronized vehicle inventory..."
                    : inventory?.status === "LIVE" || inventory?.status === "CACHED"
                      ? `${inventory.metrics.activeVehicles} synchronized vehicles available for Torque Empire Car Division`
                      : "Vehicle inventory feed is being prepared."}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {inventory?.warning ?? inventoryError ?? (inventory ? `Last synced ${formatDate(inventory.syncedAt)}` : "Live inventory will appear here when available.")}
                </p>
              </div>
              <label className="grid gap-1 text-sm text-slate-300">
                <span>Customer</span>
                <select
                  value={applicationForm.customerId}
                  onChange={(event) =>
                    setApplicationForm((current) => ({ ...current, customerId: event.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.firstName} {customer.lastName}
                    </option>
                  ))}
                </select>
              </label>
              {inventoryVehicles.length ? (
                <label className="grid gap-1 text-sm text-slate-300">
                  <span>Vehicle from Inventory</span>
                  <select
                    value={selectedInventoryVehicleId}
                    required
                    onChange={(event) => {
                      const vehicle = inventoryVehicles.find((item) => item.id === event.target.value) ?? null;
                      setSelectedInventoryVehicleId(event.target.value);
                      setApplicationForm((current) => ({
                        ...current,
                        vehicleId: vehicle?.id ?? current.vehicleId,
                        dealValue: vehicle ? String(vehicle.priceNumber ?? vehicle.price ?? current.dealValue) : current.dealValue,
                      }));
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select live vehicle</option>
                    {inventoryVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.title} - {vehicle.year ?? "n/a"} - {vehicle.priceNumber ?? vehicle.price ? `R ${Number(vehicle.priceNumber ?? vehicle.price).toLocaleString("en-ZA")}` : "Price on request"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="grid gap-1 text-sm text-slate-300">
                  <span>Vehicle ID</span>
                  <input
                    value={applicationForm.vehicleId}
                    required
                    onChange={(event) =>
                      setApplicationForm((current) => ({ ...current, vehicleId: event.target.value }))
                    }
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              )}
              {selectedInventoryVehicle ? (
                <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.06] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/75">Selected Vehicle</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedInventoryVehicle.title}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {selectedInventoryVehicle.year ?? "n/a"} Â· {selectedInventoryVehicle.transmission ?? "n/a"} Â· {selectedInventoryVehicle.mileageNumber ?? selectedInventoryVehicle.mileage ?? "n/a"} km
                  </p>
                </div>
              ) : null}
              <label className="grid gap-1 text-sm text-slate-300">
                <span>Dealer Name</span>
                <input
                  value={applicationForm.dealerName}
                  onChange={(event) =>
                    setApplicationForm((current) => ({ ...current, dealerName: event.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-300">
                <span>Deal Value</span>
                <input
                  type="number"
                  value={applicationForm.dealValue}
                  onChange={(event) =>
                    setApplicationForm((current) => ({ ...current, dealValue: event.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="submit"
                disabled={busy === "application"}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {busy === "application" ? "Saving..." : "Save Application"}
              </button>
            </form>
          </Card>

          <Card>
            <IdentityCardHeader title="Applications" subtitle="Finance pipeline and current application status">
              <Badge tone="neutral">{applications.length} total</Badge>
            </IdentityCardHeader>

            {selectedApplicationId ? (
              <div className="mt-4 space-y-4">
                <TimelineStatusPanel
                  loading={timelineLoading}
                  syncPending={timelineSyncPending}
                  hasActivity={Boolean((timeline?.auditLogs.length ?? 0) + (timeline?.decisionLogs.length ?? 0))}
                  onRetry={() => void loadTimeline(selectedApplicationId)}
                />
                <WorkflowProgressSummary application={selectedApplication ?? undefined} />
                <VehicleFinanceApplicationOperationsPanel
                  application={selectedApplication}
                  documents={selectedDocuments}
                  timelineEventCount={(timeline?.auditLogs.length ?? 0) + (timeline?.decisionLogs.length ?? 0)}
                />
              </div>
            ) : null}

            <Table className="mt-4 table-fixed">
              <thead>
                <tr>
                  <th className="w-[19%]">Application</th>
                  <th className="w-[21%]">Customer & Dealer</th>
                  <th className="w-[20%]">Workflow Step</th>
                  <th className="w-[15%]">Progress</th>
                  <th className="w-[13%]">Updated</th>
                  <th className="w-[12%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => {
                  const customer = customers.find((item) => item.customerId === application.customerId);
                  const workflowSnapshot = application.workflowSnapshot ?? null;
                  const currentStep = application.workflowStageLabel ?? workflowSnapshot?.stageLabel ?? "New Application";
                  const workflowProgress = application.workflowProgressPercentage ?? workflowSnapshot?.progressPercentage ?? 0;
                  const completedSteps = workflowSnapshot?.completedStageIds?.length ?? 0;
                  const lastUpdated = workflowSnapshot?.updatedAt ?? application.updatedAt;
                  return (
                    <tr key={application.applicationId}>
                      <td className="break-words font-medium text-slate-100">{application.applicationId}</td>
                      <td className="break-words">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-100">{customer ? `${customer.firstName} ${customer.lastName}` : application.customerId}</p>
                          <p className="text-xs text-slate-400">{application.dealerName}</p>
                        </div>
                      </td>
                      <td className="break-words">
                        <div className="space-y-1">
                          <Badge tone={workflowProgress >= 100 ? "success" : workflowProgress > 0 ? "info" : "notStarted"}>{currentStep}</Badge>
                          <p className="text-xs text-slate-400">Next: {application.workflowNextRequiredAction ?? workflowSnapshot?.nextRequiredAction ?? "Awaiting workflow sync"}</p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <Badge tone={workflowProgress >= 100 ? "completed" : workflowProgress > 0 ? "inProgress" : "notStarted"}>{workflowProgress}%</Badge>
                          <p className="text-xs text-slate-500">{completedSteps} steps complete</p>
                        </div>
                      </td>
                      <td className="text-sm text-slate-300">{formatDate(lastUpdated)}</td>
                      <td className="text-right">
                        <Link
                          href={`/dashboard/vehicle-finance/applications/${encodeURIComponent(application.applicationId)}`}
                          className="inline-flex rounded-md border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-sky-300/30 hover:text-sky-100"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </div>
      ) : null}

      {section === "document-verification" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <IdentityCardHeader title="Application Selection" subtitle="Choose the finance file to verify" />
            <label className="mt-4 grid gap-1 text-sm text-slate-300">
              <span>Application</span>
              <select
                value={selectedApplicationId}
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">Select application</option>
                {applications.map((application) => (
                  <option key={application.applicationId} value={application.applicationId}>
                    {application.applicationId} - {application.dealerName}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Application</p>
              <p className="mt-2 text-sm text-slate-100">
                {selectedApplication ? `${selectedApplication.dealerName} / ${selectedApplication.vehicleTitle ?? selectedApplication.vehicleId}` : "None selected"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {timeline?.assessment ? `Risk: ${timeline.assessment.riskLevel} | Fraud Score: ${timeline.assessment.overallFraudScore}` : "No assessment yet"}
              </p>
            </div>

            {selectedApplicationId ? (
              <div className="mt-4 space-y-4">
                <TimelineStatusPanel
                  loading={timelineLoading}
                  syncPending={timelineSyncPending}
                  hasActivity={Boolean((timeline?.auditLogs.length ?? 0) + (timeline?.decisionLogs.length ?? 0))}
                  onRetry={() => void loadTimeline(selectedApplicationId)}
                />
                <WorkflowProgressSummary application={selectedApplication ?? undefined} />
                <VehicleFinanceApplicationOperationsPanel
                  application={selectedApplication}
                  documents={selectedDocuments}
                  timelineEventCount={(timeline?.auditLogs.length ?? 0) + (timeline?.decisionLogs.length ?? 0)}
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={verifySelectedApplication}
              disabled={!selectedApplicationId || busy === "verify"}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {busy === "verify" ? "Verifying..." : "Run Verification"}
            </button>
          </Card>

          <div className="space-y-6">
            <Card>
              <IdentityCardHeader title="Document Uploads" subtitle="Upload one PDF per required document type" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {VEHICLE_FINANCE_DOCUMENT_TYPES.map((documentType) => {
                  const currentDocument = selectedDocuments.find((document) => document.documentType === documentType);
                  const analysis = currentDocument?.aiAnalysis as Partial<VehicleFinanceDocument & { documentIntegrityScore?: number }>;
                  return (
                    <div key={documentType} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-50">{getVehicleFinanceDocumentLabel(documentType)}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {currentDocument ? `Uploaded ${formatDate(currentDocument.uploadedAt)}` : "Not uploaded"}
                          </p>
                        </div>
                        <Badge tone={currentDocument ? "success" : "warning"}>{currentDocument ? "Ready" : "Missing"}</Badge>
                      </div>

                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="mt-4 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setDocumentFiles((current) => ({ ...current, [documentType]: file }));
                        }}
                      />

                      <button
                        type="button"
                        disabled={!selectedApplicationId || !documentFiles[documentType] || busy === `upload:${documentType}`}
                        onClick={() => void uploadDocument(documentType)}
                        className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                      >
                        {busy === `upload:${documentType}` ? "Uploading..." : "Upload"}
                      </button>

                      {currentDocument ? (
                        <div className="mt-3 space-y-1 text-xs text-slate-400">
                          <p>Extraction: {currentDocument.extractionSource}</p>
                          <p>Text: {currentDocument.extractedTextLength} chars</p>
                          <p>Integrity Score: {(analysis as { documentIntegrityScore?: number } | undefined)?.documentIntegrityScore ?? "n/a"}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <IdentityCardHeader title="Vehicle Finance Verification" subtitle="Driver licence intelligence and fraud flags" />
              {selectedDriverLicenceDocument ? (
                (() => {
                  const intelligence = (selectedDriverLicenceDocument.aiAnalysis as {
                    driverLicenceIntelligence?: {
                      enabled?: boolean;
                      classification?: { documentType?: string; confidence?: number; reasons?: string[] };
                      extraction?: {
                        name?: string | null;
                        surname?: string | null;
                        idNumber?: string | null;
                        licenceNumber?: string | null;
                        dateOfBirth?: string | null;
                        expiryDate?: string | null;
                        issueDate?: string | null;
                        gender?: string | null;
                        restriction?: string | null;
                        country?: string | null;
                        confidence?: number;
                        fields?: Record<
                          string,
                          { value?: string | null; confidence?: number; sourceText?: string }
                        >;
                      };
                      verification?: { passed?: boolean; score?: number; flags?: string[] };
                      applicationComparison?: { passed?: boolean; flags?: string[] } | null;
                      crossDocumentVerification?: {
                        sourceDocumentType?: string;
                        comparedDocumentType?: string;
                        flags?: string[];
                        fraudFlags?: string[];
                        passed?: boolean;
                        identityVerificationScore?: number;
                        riskLevel?: string;
                      } | null;
                      textQuality?: { confidence?: number; reasons?: string[]; flags?: string[] };
                      selectedText?: string;
                    } | null;
                  })?.driverLicenceIntelligence ?? null;

                  const extractionFields = intelligence.extraction?.fields ?? {};
                  const fieldValue = (key: string, fallback?: unknown) =>
                    renderPrimitive(extractionFields[key]?.value ?? fallback, "Not detected");
                  const fieldConfidence = (key: string, fallback?: number | null) =>
                    extractionFields[key]?.confidence ?? fallback ?? 0;
                  const fieldEvidence = (key: string, fallback?: unknown) =>
                    renderExtractedField(
                      extractionFields[key] ?? {
                        value: fallback,
                        confidence: intelligence.extraction?.confidence ?? null,
                        sourceText: "",
                      },
                    );
                  const nameEvidence = fieldEvidence("name", intelligence.extraction?.name);
                  const surnameEvidence = fieldEvidence("surname", intelligence.extraction?.surname);

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
                        <p className="mt-2 text-sm text-slate-100">{nameEvidence.value}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={nameEvidence.isLowConfidence ? "warning" : "neutral"}>{nameEvidence.confidenceLabel}</Badge>
                          {nameEvidence.isLowConfidence ? <Badge tone="warning">Low confidence</Badge> : null}
                        </div>
                        {nameEvidence.sourceText ? <p className="mt-2 text-xs text-slate-400">{nameEvidence.sourceText}</p> : null}
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Surname</p>
                        <p className="mt-2 text-sm text-slate-100">{surnameEvidence.value}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={surnameEvidence.isLowConfidence ? "warning" : "neutral"}>{surnameEvidence.confidenceLabel}</Badge>
                          {surnameEvidence.isLowConfidence ? <Badge tone="warning">Low confidence</Badge> : null}
                        </div>
                        {surnameEvidence.sourceText ? <p className="mt-2 text-xs text-slate-400">{surnameEvidence.sourceText}</p> : null}
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ID Number</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("idNumber", intelligence.extraction?.idNumber)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Licence Number</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("licenceNumber", intelligence.extraction?.licenceNumber)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date Of Birth</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("dateOfBirth", intelligence.extraction?.dateOfBirth)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Issue Date</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("issueDate", intelligence.extraction?.issueDate)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expiry Date</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("expiryDate", intelligence.extraction?.expiryDate)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">OCR Confidence</p>
                        <p className="mt-2 text-sm text-slate-100">{formatConfidence(intelligence.textQuality?.confidence ?? intelligence.extraction?.confidence ?? null)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gender</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("gender", intelligence.extraction?.gender)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Restriction</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("restriction", intelligence.extraction?.restriction)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Country</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("country", intelligence.extraction?.country)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Result</p>
                        <p className="mt-2 text-sm text-slate-100">{intelligence.verification?.passed ? "PASS" : "REVIEW"}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Score</p>
                        <p className="mt-2 text-sm text-slate-100">{renderPrimitive(intelligence.verification?.score ?? 0, "Pending analysis")}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 md:col-span-2 xl:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fraud Flags</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.verification?.flags ?? []).length ? (
                            intelligence.verification?.flags?.map((flag) => (
                              <Badge key={flag} tone="warning">
                                {flag}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="success">None</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cross-check</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.applicationComparison?.flags ?? []).length ? (
                            intelligence.applicationComparison?.flags?.map((flag) => (
                              <Badge key={flag} tone="danger">
                                {flag}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="success">Matched</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Identity Cross-check</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {intelligence.crossDocumentVerification ? (
                            <>
                              <Badge tone={intelligence.crossDocumentVerification.passed ? "success" : "warning"}>
                                {renderPrimitive(intelligence.crossDocumentVerification.riskLevel ?? "UNKNOWN", "Pending analysis")}
                              </Badge>
                              <Badge tone="neutral">
                                Score: {renderPrimitive(intelligence.crossDocumentVerification.identityVerificationScore ?? 0, "Pending analysis")}
                              </Badge>
                              {(intelligence.crossDocumentVerification.flags ?? []).length ? (
                                intelligence.crossDocumentVerification.flags?.map((flag) => (
                                  <Badge key={flag} tone="success">
                                    {flag}
                                  </Badge>
                                ))
                              ) : (
                                <Badge tone="warning">No Match Flags</Badge>
                              )}
                              {(intelligence.crossDocumentVerification.fraudFlags ?? []).length ? (
                                intelligence.crossDocumentVerification.fraudFlags?.map((flag) => (
                                  <Badge key={flag} tone="danger">
                                    {flag}
                                  </Badge>
                                ))
                              ) : (
                                <Badge tone="success">No Fraud Flags</Badge>
                              )}
                            </>
                          ) : (
                            <Badge tone="neutral">Pending identity comparison</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Field Confidence</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ["Name", fieldConfidence("name", intelligence.extraction?.confidence)],
                            ["Surname", fieldConfidence("surname", intelligence.extraction?.confidence)],
                            ["ID", fieldConfidence("idNumber", intelligence.extraction?.confidence)],
                            ["DOB", fieldConfidence("dateOfBirth", intelligence.extraction?.confidence)],
                            ["Licence", fieldConfidence("licenceNumber", intelligence.extraction?.confidence)],
                            ["Expiry", fieldConfidence("expiryDate", intelligence.extraction?.confidence)],
                            ["Gender", fieldConfidence("gender", intelligence.extraction?.confidence)],
                          ].map(([label, score]) => (
                            <Badge key={label as string} tone="neutral">
                              {label}: {formatConfidence(score as number)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Driver licence intelligence is not available for this application yet.
                    </p>
                  );
                })()
              ) : (
                <p className="mt-4 text-sm text-slate-400">Upload a driver&apos;s licence to view intelligence results.</p>
              )}
            </Card>

            <Card>
              <IdentityCardHeader title="Identity Intelligence" subtitle="Green ID book and Smart ID card fields" />
              {selectedIdentityDocument ? (
                (() => {
                  const intelligence = (selectedIdentityDocument.aiAnalysis as {
                    identityIntelligence?: {
                      documentType?: string;
                      classification?: { documentType?: string; confidence?: number; reasons?: string[] };
                      extraction?: {
                        idNumber?: string | null;
                        surname?: string | null;
                        forenames?: string | null;
                        dateOfBirth?: string | null;
                        countryOfBirth?: string | null;
                        citizenship?: string | null;
                        dateIssued?: string | null;
                        issueNumber?: string | null;
                        gender?: string | null;
                        confidence?: number;
                        overallConfidence?: number;
                        fields?: Record<string, { value?: string | null; confidence?: number; sourceText?: string }>;
                      };
                      verification?: { passed?: boolean; score?: number; flags?: string[] };
                      integrityIndicators?: { photoDetected?: boolean; barcodeDetected?: boolean; cardNumberDetected?: boolean };
                      crossDocumentVerification?: {
                        sourceDocumentType?: string;
                        comparedDocumentType?: string;
                        flags?: string[];
                        fraudFlags?: string[];
                        passed?: boolean;
                        identityVerificationScore?: number;
                        riskLevel?: string;
                      } | null;
                      sourceText?: string;
                    } | null;
                  })?.identityIntelligence ?? null;

                  const extractionFields = intelligence?.extraction?.fields ?? {};
                  const idField = (key: string, fallback?: unknown) =>
                    renderPrimitive(extractionFields[key]?.value ?? fallback, "Not detected");
                  const idConfidence = (key: string, fallback?: number | null) =>
                    extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document Type</p>
                        <p className="mt-2 text-sm text-slate-100">{renderPrimitive(intelligence.documentType ?? "n/a", "Pending analysis")}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ID Number</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("idNumber", intelligence.extraction?.idNumber)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Surname</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("surname", intelligence.extraction?.surname)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Forenames</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("forenames", intelligence.extraction?.forenames)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date Of Birth</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("dateOfBirth", intelligence.extraction?.dateOfBirth)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date Issued</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("dateIssued", intelligence.extraction?.dateIssued)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Country Of Birth</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("countryOfBirth", intelligence.extraction?.countryOfBirth)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Citizenship</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("citizenship", intelligence.extraction?.citizenship)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gender</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("gender", intelligence.extraction?.gender)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Issue Number</p>
                        <p className="mt-2 text-sm text-slate-100">{idField("issueNumber", intelligence.extraction?.issueNumber)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 md:col-span-2 xl:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Integrity Indicators</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone={intelligence.integrityIndicators?.photoDetected ? "success" : "warning"}>
                            Photo: {intelligence.integrityIndicators?.photoDetected ? "Detected" : "Missing"}
                          </Badge>
                          <Badge tone={intelligence.integrityIndicators?.barcodeDetected ? "success" : "warning"}>
                            Barcode: {intelligence.integrityIndicators?.barcodeDetected ? "Detected" : "Missing"}
                          </Badge>
                          <Badge tone={intelligence.integrityIndicators?.cardNumberDetected ? "success" : "warning"}>
                            Card No: {intelligence.integrityIndicators?.cardNumberDetected ? "Detected" : "Missing"}
                          </Badge>
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {intelligence.verification?.flags?.length ? (
                            intelligence.verification.flags.map((flag) => (
                              <Badge key={flag} tone="warning">
                                {flag}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="success">PASS</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confidence</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ["ID", idConfidence("idNumber", intelligence.extraction?.confidence)],
                            ["Surname", idConfidence("surname", intelligence.extraction?.confidence)],
                            ["Forenames", idConfidence("forenames", intelligence.extraction?.confidence)],
                            ["DOB", idConfidence("dateOfBirth", intelligence.extraction?.confidence)],
                            ["Country", idConfidence("countryOfBirth", intelligence.extraction?.confidence)],
                            ["Citizenship", idConfidence("citizenship", intelligence.extraction?.confidence)],
                          ].map(([label, score]) => (
                            <Badge key={label as string} tone="neutral">
                              {label}: {score as number}%
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cross-document verification</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {intelligence.crossDocumentVerification ? (
                            <>
                              <Badge tone={intelligence.crossDocumentVerification.passed ? "success" : "warning"}>
                              {renderPrimitive(intelligence.crossDocumentVerification.riskLevel ?? "UNKNOWN", "Pending analysis")}
                              </Badge>
                              <Badge tone="neutral">
                                Score: {renderPrimitive(intelligence.crossDocumentVerification.identityVerificationScore ?? 0, "Pending analysis")}
                              </Badge>
                              {(intelligence.crossDocumentVerification.flags ?? []).length ? (
                                intelligence.crossDocumentVerification.flags?.map((flag) => (
                                  <Badge key={flag} tone="success">
                                    {flag}
                                  </Badge>
                                ))
                              ) : (
                                <Badge tone="warning">No Match Flags</Badge>
                              )}
                              {(intelligence.crossDocumentVerification.fraudFlags ?? []).length ? (
                                intelligence.crossDocumentVerification.fraudFlags?.map((flag) => (
                                  <Badge key={flag} tone="danger">
                                    {flag}
                                  </Badge>
                                ))
                              ) : (
                                <Badge tone="success">No Fraud Flags</Badge>
                              )}
                            </>
                          ) : (
                            <Badge tone="neutral">Pending driver comparison</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Upload a Green ID Book or Smart ID Card to view identity intelligence.
                    </p>
                  );
                })()
              ) : (
                <p className="mt-4 text-sm text-slate-400">Upload a Green ID Book or Smart ID Card to view identity intelligence.</p>
              )}
            </Card>

            <Card>
              <IdentityCardHeader title="Payslip Intelligence" subtitle="Employment, income, deductions, and affordability inputs" />
              {selectedPayslipDocument ? (
                (() => {
                  const intelligence = (selectedPayslipDocument.aiAnalysis as {
                    payslipIntelligence?: {
                      documentType?: string;
                      classification?: { documentType?: string; confidence?: number; reasons?: string[] };
                      extraction?: {
                        employerName?: string | number | null;
                        employeeName?: string | number | null;
                        employeeNumber?: string | number | null;
                        designation?: string | number | null;
                        grossEarnings?: string | number | null;
                        totalDeductions?: string | number | null;
                        netPay?: string | number | null;
                        payDate?: string | null;
                        payPeriod?: string | null;
                        benefits?: Array<{ type?: string; amount?: number | null; confidence?: number; sourceText?: string }>;
                        deductions?: Array<{ type?: string; amount?: number | null; confidence?: number; sourceText?: string }>;
                        confidence?: number;
                        overallConfidence?: number;
                        fields?: Record<string, { value?: string | number | null; confidence?: number; sourceText?: string }>;
                      };
                      verification?: { passed?: boolean; verificationScore?: number; flags?: string[] };
                      crossDocumentPreparation?: {
                        employeeName?: { value?: string | number | null; confidence?: number; sourceText?: string };
                        surname?: { value?: string | number | null; confidence?: number; sourceText?: string };
                      } | null;
                      selectedText?: string;
                    } | null;
                  })?.payslipIntelligence ?? null;

                  const extractionFields = intelligence?.extraction?.fields ?? {};
                  const fieldValue = (key: string, fallback?: unknown) =>
                    renderPrimitive(extractionFields[key]?.value ?? fallback, "Not detected");
                  const fieldConfidence = (key: string, fallback?: number | null) =>
                    extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employer</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("employerName", intelligence.extraction?.employerName)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employee Name</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("employeeName", intelligence.extraction?.employeeName)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employee Number</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("employeeNumber", intelligence.extraction?.employeeNumber)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Designation</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("designation", intelligence.extraction?.designation)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gross Earnings</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("grossEarnings", intelligence.extraction?.grossEarnings)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Pay</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("netPay", intelligence.extraction?.netPay)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Deductions</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("totalDeductions", intelligence.extraction?.totalDeductions)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pay Date</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("payDate", intelligence.extraction?.payDate)}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pay Period</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("payPeriod", intelligence.extraction?.payPeriod)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Score</p>
                        <p className="mt-2 text-sm text-slate-100">{intelligence.verification?.verificationScore ?? 0}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 md:col-span-2 xl:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confidence</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ["Employer", fieldConfidence("employerName", intelligence.extraction?.confidence)],
                            ["Employee", fieldConfidence("employeeName", intelligence.extraction?.confidence)],
                            ["Number", fieldConfidence("employeeNumber", intelligence.extraction?.confidence)],
                            ["Gross", fieldConfidence("grossEarnings", intelligence.extraction?.confidence)],
                            ["Deductions", fieldConfidence("totalDeductions", intelligence.extraction?.confidence)],
                            ["Net", fieldConfidence("netPay", intelligence.extraction?.confidence)],
                            ["Pay Date", fieldConfidence("payDate", intelligence.extraction?.confidence)],
                          ].map(([label, score]) => (
                            <Badge key={label as string} tone="neutral">
                              {label}: {formatConfidence(score as number)}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Flags</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {intelligence.verification?.flags?.length ? (
                            intelligence.verification.flags.map((flag) => (
                              <Badge key={flag} tone="warning">
                                {flag}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="success">PASS</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Benefits</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.extraction?.benefits ?? []).length ? (
                            intelligence.extraction?.benefits?.map((benefit) => (
                              <Badge key={`${benefit.type}-${benefit.sourceText}`} tone="success">
                                {benefit.type}: {benefit.amount ?? "n/a"}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="neutral">None detected</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deductions</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.extraction?.deductions ?? []).length ? (
                            intelligence.extraction?.deductions?.map((deduction) => (
                              <Badge key={`${deduction.type}-${deduction.sourceText}`} tone="danger">
                                {deduction.type}: {deduction.amount ?? "n/a"}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="neutral">None detected</Badge>
                          )}
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cross-document prep</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="neutral">
                            Employee: {renderPrimitive(intelligence.crossDocumentPreparation?.employeeName?.value ?? "Not detected")}
                          </Badge>
                          <Badge tone="neutral">
                            Surname: {renderPrimitive(intelligence.crossDocumentPreparation?.surname?.value ?? "Not detected")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">Upload a payslip to view payslip intelligence.</p>
                  );
                })()
              ) : (
                <p className="mt-4 text-sm text-slate-400">Upload a payslip to view payslip intelligence.</p>
              )}
            </Card>

            <Card>
              <IdentityCardHeader title="Bank Statement Intelligence" subtitle="Income, commitments, and affordability inputs" />
              {selectedBankStatementDocument ? (
                (() => {
                  const intelligence = (selectedBankStatementDocument.aiAnalysis as any)?.bankStatementIntelligence ?? null;

                  const extractionFields = intelligence?.extraction?.fields ?? {};
                  const fieldValue = (key: string, fallback?: unknown) =>
                    renderPrimitive(extractionFields[key]?.value ?? fallback, "Not detected");
                  const fieldConfidence = (key: string, fallback?: number | null) =>
                    extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bank Name</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("bankName", intelligence.classification?.bankName ?? null)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fingerprint</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {renderPrimitive(intelligence.bankFingerprint?.bankName ?? intelligence.classification?.bankName ?? "n/a")}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document Version</p>
                        <p className="mt-2 text-sm text-slate-100">{renderPrimitive(intelligence.bankFingerprint?.documentVersion ?? "n/a")}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Statement Layout</p>
                        <p className="mt-2 text-sm text-slate-100">{renderPrimitive(intelligence.bankFingerprint?.statementLayout ?? "n/a")}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account Holder</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("accountHolder", intelligence.extraction?.accountHolder?.value ?? null)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account Number</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("accountNumber", intelligence.extraction?.accountNumber?.value ?? null)}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Statement Period</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("statementPeriod", intelligence.extraction?.statementPeriod?.value ?? null)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Opening Balance</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("openingBalance", intelligence.extraction?.openingBalance?.value ?? null)}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Closing Balance</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("closingBalance", intelligence.extraction?.closingBalance?.value ?? null)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Average Monthly Income</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("averageMonthlyIncome", intelligence.extraction?.averageMonthlyIncome?.value ?? null)}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disposable Income Estimate</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {fieldValue("disposableIncomeEstimate", intelligence.extraction?.disposableIncomeEstimate?.value ?? null)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Score</p>
                        <p className="mt-2 text-sm text-slate-100">{intelligence.verification?.verificationScore ?? 0}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Flags</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {intelligence.verification?.flags?.length ? (
                            intelligence.verification.flags.map((flag) => (
                              <Badge key={flag} tone="warning">
                                {flag}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="success">PASS</Badge>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 md:col-span-2 xl:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transaction Intelligence</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="neutral">Transactions: {intelligence.extraction?.transactions?.length ?? 0}</Badge>
                          <Badge tone="success">
                            Salary Deposits: {intelligence.extraction?.salaryIntelligence?.salaryDeposits?.length ?? intelligence.extraction?.salaryDeposits?.length ?? 0}
                          </Badge>
                          <Badge tone="warning">
                            Recurring Commitments: {intelligence.extraction?.commitmentSummary?.recurringCommitments?.length ?? intelligence.extraction?.recurringCommitments?.length ?? 0}
                          </Badge>
                          <Badge tone="danger">
                            Gambling Tx: {intelligence.extraction?.gamblingTransactions?.length ?? 0}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <p className="text-sm text-slate-200">
                            Average Salary: {String(intelligence.extraction?.salaryIntelligence?.averageSalary?.value ?? intelligence.extraction?.averageMonthlyIncome?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Salary Frequency: {String(intelligence.extraction?.salaryIntelligence?.salaryFrequency?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Salary Trend: {String(intelligence.extraction?.salaryIntelligence?.salaryTrend?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Salary Consistency: {String(intelligence.extraction?.salaryIntelligence?.salaryConsistency?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Debt Commitments: {String(intelligence.extraction?.commitmentSummary?.monthlyDebtCommitments?.value ?? intelligence.extraction?.monthlyDebtCommitments?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Insurance Commitments: {String(intelligence.extraction?.commitmentSummary?.monthlyInsuranceCommitments?.value ?? intelligence.extraction?.monthlyInsuranceCommitments?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Telecom Commitments: {String(intelligence.extraction?.commitmentSummary?.monthlyTelecomCommitments?.value ?? intelligence.extraction?.monthlyTelecomCommitments?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Gambling Risk: {String(intelligence.extraction?.gamblingRisk?.riskLevel ?? "LOW")}
                          </p>
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Affordability</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          <p className="text-sm text-slate-200">
                            Gross Income: {String(intelligence.extraction?.affordability?.grossIncome?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Net Income: {String(intelligence.extraction?.affordability?.netIncome?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Monthly Commitments: {String(intelligence.extraction?.affordability?.monthlyCommitments?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Disposable Income: {String(intelligence.extraction?.affordability?.disposableIncome?.value ?? "n/a")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Affordability Score: {String(intelligence.extraction?.affordability?.affordabilityScore?.value ?? intelligence.overallConfidence ?? 0)}
                          </p>
                          <p className="text-sm text-slate-200">
                            Max Instalment: {String(intelligence.extraction?.affordability?.maxAffordableInstalment?.value ?? "n/a")}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="success">{String(intelligence.extraction?.affordability?.starterVehicle?.value ?? "Starter band unavailable")}</Badge>
                          <Badge tone="warning">{String(intelligence.extraction?.affordability?.midRangeVehicle?.value ?? "Mid-range band unavailable")}</Badge>
                          <Badge tone="neutral">{String(intelligence.extraction?.affordability?.premiumVehicle?.value ?? "Premium band unavailable")}</Badge>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 md:col-span-2 xl:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confidence</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ["Bank", fieldConfidence("bankName", intelligence.extraction?.confidence)],
                            ["Holder", fieldConfidence("accountHolder", intelligence.extraction?.confidence)],
                            ["Account", fieldConfidence("accountNumber", intelligence.extraction?.confidence)],
                            ["Period", fieldConfidence("statementPeriod", intelligence.extraction?.confidence)],
                            ["Opening", fieldConfidence("openingBalance", intelligence.extraction?.confidence)],
                            ["Closing", fieldConfidence("closingBalance", intelligence.extraction?.confidence)],
                            ["Income", fieldConfidence("averageMonthlyIncome", intelligence.extraction?.confidence)],
                            ["Disposable", fieldConfidence("disposableIncomeEstimate", intelligence.extraction?.confidence)],
                            ["Salary", intelligence.extraction?.salaryIntelligence?.averageSalary?.confidence ?? 0],
                            ["Debt", intelligence.extraction?.commitmentSummary?.totalMonthlyCommitments?.confidence ?? 0],
                            ["Gambling", intelligence.extraction?.gamblingRisk?.gamblingSpend?.confidence ?? 0],
                            ["Affordability", intelligence.extraction?.affordability?.affordabilityScore?.confidence ?? 0],
                          ].map(([label, score]) => (
                            <Badge key={label as string} tone="neutral">
                              {label}: {formatConfidence(score as number)}
                            </Badge>
                          ))}
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="neutral">{String(intelligence.bankFingerprint?.sourceText ?? intelligence.extraction?.bankName?.sourceText ?? "n/a")}</Badge>
                          <Badge tone="neutral">{String(intelligence.extraction?.accountHolder?.sourceText ?? "n/a")}</Badge>
                          <Badge tone="neutral">{String(intelligence.extraction?.statementPeriod?.sourceText ?? "n/a")}</Badge>
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salary Deposits</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.extraction?.salaryDeposits ?? []).length ? (
                            intelligence.extraction?.salaryDeposits?.map((deposit, index) => (
                              <Badge key={`${deposit.type}-${deposit.date ?? "date"}-${index}`} tone="success">
                                {deposit.type}: {deposit.amount ?? "n/a"}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="neutral">None detected</Badge>
                          )}
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recurring Commitments</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.extraction?.recurringCommitments ?? []).length ? (
                            intelligence.extraction?.recurringCommitments?.map((commitment, index) => (
                              <Badge key={`${commitment.type}-${commitment.date ?? "date"}-${index}`} tone="warning">
                                {commitment.type}: {commitment.amount ?? "n/a"}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="neutral">None detected</Badge>
                          )}
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gambling Transactions</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.extraction?.gamblingTransactions ?? []).length ? (
                            intelligence.extraction?.gamblingTransactions?.map((transaction, index) => (
                              <Badge key={`${transaction.type}-${transaction.date ?? "date"}-${index}`} tone="danger">
                                {transaction.type}: {transaction.amount ?? "n/a"}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="success">None detected</Badge>
                          )}
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cross-document prep</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="neutral">
                            Employee: {String(intelligence.crossDocumentPreparation?.employeeName?.value ?? "n/a")}
                          </Badge>
                          <Badge tone="neutral">
                            Employer: {String(intelligence.crossDocumentPreparation?.employerName?.value ?? "n/a")}
                          </Badge>
                          <Badge tone="neutral">
                            Net Pay: {String(intelligence.crossDocumentPreparation?.netPay?.value ?? "n/a")}
                          </Badge>
                        </div>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transactions</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(intelligence.extraction?.transactions ?? []).slice(0, 12).map((transaction: any, index: number) => (
                            <Badge
                              key={`${transaction.date ?? "date"}-${transaction.description ?? "tx"}-${index}`}
                              tone={transaction.direction === "CREDIT" ? "success" : transaction.direction === "DEBIT" ? "danger" : "neutral"}
                            >
                              {String(transaction.date ?? "n/a")} {String(transaction.description ?? transaction.category ?? "Transaction")} {String(transaction.amount ?? "n/a")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">Upload a bank statement to view bank statement intelligence.</p>
                  );
                })()
              ) : (
                <p className="mt-4 text-sm text-slate-400">Upload a bank statement to view bank statement intelligence.</p>
              )}
            </Card>

            <Card>
              <IdentityCardHeader title="Verification History" subtitle="Assessment, audit logs, and decision trail" />
              <Table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(timeline?.decisionLogs ?? []).slice(0, 6).map((decision) => (
                    <tr key={decision.id}>
                      <td>{formatDate(decision.timestamp ?? null)}</td>
                      <td>{decision.triggerEvent ?? "Decision"}</td>
                      <td>{decision.previousReadinessScore ?? "n/a"}</td>
                      <td>{decision.newReadinessScore ?? "n/a"}</td>
                      <td>{decision.reasonForChange ?? "n/a"}</td>
                    </tr>
                  ))}
                  {!timelineLoading && (timeline?.decisionLogs.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                        Timeline activity will appear here when synchronization completes.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </Card>
          </div>
        </div>
      ) : null}

      {section === "certificates" ? (
        <Card>
          <IdentityCardHeader title="Verification Certificates" subtitle="Generated after vehicle finance verification" />
          <Table>
            <thead>
              <tr>
                <th>Certificate</th>
                <th>Application</th>
                <th>Verified By</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((certificate) => (
                <tr key={certificate.certificateId}>
                  <td>{certificate.certificateId}</td>
                  <td>{certificate.applicationId}</td>
                  <td>{certificate.verifiedBy}</td>
                  <td>{formatDate(certificate.createdAt)}</td>
                  <td>
                    <a href={certificate.certificateUrl} target="_blank" rel="noreferrer" className="text-cyan-300">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedApplicationId || busy === `certificate:${selectedApplicationId}`}
              onClick={() => void generateCertificate(selectedApplicationId)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {busy === `certificate:${selectedApplicationId}` ? "Generating..." : "Generate Certificate"}
            </button>
            {certificateByApplicationId.get(selectedApplicationId) ? (
              <Badge tone="success">Certificate ready for selected application</Badge>
            ) : null}
          </div>
        </Card>
      ) : null}

      {section === "reports" ? (
        <Card>
          <IdentityCardHeader title="Reports" subtitle="Export vehicle finance operational snapshots" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={reportLinks.csv} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white no-underline">
              CSV
            </Link>
            <Link href={reportLinks.excel} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white no-underline">
              Excel
            </Link>
            <Link href={reportLinks.pdf} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white no-underline">
              PDF
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
