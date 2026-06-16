"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { authFetch } from "@/lib/client/authFetch";
import {
  getVehicleFinanceDocumentLabel,
  VEHICLE_FINANCE_DOCUMENT_TYPES,
  type VehicleFinanceApplication,
  type VehicleFinanceAssessment,
  type VehicleFinanceCertificate,
  type VehicleFinanceCustomer,
  type VehicleFinanceDocument,
  type VehicleFinanceDocumentType,
} from "@/types/vehicleFinance";

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

type Section = "dashboard" | "customers" | "applications" | "document-verification" | "certificates" | "reports";

type Props = {
  initialSection: Section;
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

const EMPTY_CUSTOMERS: VehicleFinanceCustomer[] = [];
const EMPTY_APPLICATIONS: VehicleFinanceApplication[] = [];
const EMPTY_DOCUMENTS: VehicleFinanceDocument[] = [];
const EMPTY_CERTIFICATES: VehicleFinanceCertificate[] = [];

const SECTION_LINKS: Array<{ section: Section; href: string; label: string }> = [
  { section: "dashboard", href: "/dashboard/vehicle-finance", label: "Dashboard" },
  { section: "customers", href: "/dashboard/vehicle-finance/customers", label: "Customers" },
  { section: "applications", href: "/dashboard/vehicle-finance/applications", label: "Applications" },
  {
    section: "document-verification",
    href: "/dashboard/vehicle-finance/document-verification",
    label: "Document Verification",
  },
  { section: "certificates", href: "/dashboard/vehicle-finance/certificates", label: "Certificates" },
  { section: "reports", href: "/dashboard/vehicle-finance/reports", label: "Reports" },
];

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function VehicleFinanceWorkspace({ initialSection }: Props) {
  const section = initialSection;
  const [overview, setOverview] = useState<VehicleFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);
  const [applicationForm, setApplicationForm] = useState<ApplicationForm>(EMPTY_APPLICATION_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<VehicleFinanceDocumentType, File>>>({});
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [timeline, setTimeline] = useState<{
    auditLogs: Array<{ id: string; eventType?: string; timestamp?: string; metadata?: Record<string, unknown>; targetId?: string }>;
    decisionLogs: Array<{ id: string; triggerEvent?: string; reasonForChange?: string; timestamp?: string; previousReadinessScore?: number | null; newReadinessScore?: number | null }>;
    assessment: VehicleFinanceAssessment | null;
  } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/vehicle-finance/overview", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as VehicleFinanceOverview & { error?: string } | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? `Vehicle finance overview request failed (${response.status})`);
      }

      setOverview(payload);
      setError(null);
      if (payload.applications[0]?.applicationId) {
        const initialApplicationId = payload.applications[0].applicationId;
        setSelectedApplicationId((current) => current || initialApplicationId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Vehicle finance overview unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async (applicationId: string) => {
    if (!applicationId) {
      setTimeline(null);
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
    } catch (timelineError) {
      setTimeline({
        auditLogs: [],
        decisionLogs: [],
        assessment: null,
      });
      setError(timelineError instanceof Error ? timelineError.message : "Vehicle finance timeline unavailable");
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

  const selectedApplication = useMemo(
    () => applications.find((application) => application.applicationId === selectedApplicationId) ?? null,
    [applications, selectedApplicationId],
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

  const certificateByApplicationId = useMemo(() => {
    return new Map(certificates.map((certificate) => [certificate.applicationId, certificate]));
  }, [certificates]);

  async function refresh() {
    await loadOverview();
    if (selectedApplicationId) {
      await loadTimeline(selectedApplicationId);
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
      const response = await authFetch("/api/vehicle-finance/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: applicationForm.customerId.trim(),
          vehicleId: applicationForm.vehicleId.trim(),
          dealerName: applicationForm.dealerName.trim(),
          dealValue: Number(applicationForm.dealValue) || 0,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Application create failed (${response.status})`);
      }
      setApplicationForm(EMPTY_APPLICATION_FORM);
      await refresh();
    } catch (applicationError) {
      setError(applicationError instanceof Error ? applicationError.message : "Application creation failed");
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
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Vehicle Finance</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Roar Cars SA pilot workspace for applications, supporting documents, verification, fraud scoring, certificates, and reporting.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTION_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-4 py-2 text-sm font-medium no-underline ${
              item.section === section
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-slate-700 bg-slate-900/40 text-slate-300"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/dashboard/vehicle-finance/training"
          className="rounded-full border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-300 no-underline"
        >
          Training Library
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}

      {loading && !overview ? (
        <Card>
          <p className="text-sm text-slate-300">Loading vehicle finance workspace...</p>
        </Card>
      ) : null}

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

      {section === "applications" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card>
            <IdentityCardHeader title="Create Application" subtitle="Link a customer to a vehicle finance case" />
            <form className="mt-4 grid gap-3" onSubmit={submitApplication}>
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
              <label className="grid gap-1 text-sm text-slate-300">
                <span>Vehicle ID</span>
                <input
                  value={applicationForm.vehicleId}
                  onChange={(event) =>
                    setApplicationForm((current) => ({ ...current, vehicleId: event.target.value }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
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
            <IdentityCardHeader title="Applications" subtitle="Stored in vehicleFinanceApplications" />
            <Table>
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Customer</th>
                  <th>Dealer</th>
                  <th>Status</th>
                  <th>Fraud Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => {
                  const customer = customers.find((item) => item.customerId === application.customerId);
                  return (
                    <tr key={application.applicationId}>
                      <td>{application.applicationId}</td>
                      <td>{customer ? `${customer.firstName} ${customer.lastName}` : application.customerId}</td>
                      <td>{application.dealerName}</td>
                      <td>{application.applicationStatus}</td>
                      <td>{application.fraudScore}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedApplicationId(application.applicationId)}
                          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200"
                        >
                          Open
                        </button>
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
                {selectedApplication ? `${selectedApplication.dealerName} / ${selectedApplication.vehicleId}` : "None selected"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {timelineLoading ? "Loading timeline..." : timeline?.assessment ? `Risk: ${timeline.assessment.riskLevel} | Fraud Score: ${timeline.assessment.overallFraudScore}` : "No assessment yet"}
              </p>
            </div>

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
                  const fieldValue = (key: string, fallback?: string | null) =>
                    extractionFields[key]?.value ?? fallback ?? "n/a";
                  const fieldConfidence = (key: string, fallback?: number | null) =>
                    extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("name", intelligence.extraction?.name)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Surname</p>
                        <p className="mt-2 text-sm text-slate-100">{fieldValue("surname", intelligence.extraction?.surname)}</p>
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
                        <p className="mt-2 text-sm text-slate-100">{intelligence.textQuality?.confidence ?? intelligence.extraction?.confidence ?? 0}%</p>
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
                        <p className="mt-2 text-sm text-slate-100">{intelligence.verification?.score ?? 0}</p>
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
                                {intelligence.crossDocumentVerification.riskLevel ?? "UNKNOWN"}
                              </Badge>
                              <Badge tone="neutral">
                                Score: {intelligence.crossDocumentVerification.identityVerificationScore ?? 0}
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
                              {label}: {score as number}%
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
                <p className="mt-4 text-sm text-slate-400">Upload a driver's licence to view intelligence results.</p>
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
                  const idField = (key: string, fallback?: string | null) => extractionFields[key]?.value ?? fallback ?? "n/a";
                  const idConfidence = (key: string, fallback?: number | null) => extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document Type</p>
                        <p className="mt-2 text-sm text-slate-100">{intelligence.documentType ?? "n/a"}</p>
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
                                {intelligence.crossDocumentVerification.riskLevel ?? "UNKNOWN"}
                              </Badge>
                              <Badge tone="neutral">
                                Score: {intelligence.crossDocumentVerification.identityVerificationScore ?? 0}
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
                  const fieldValue = (key: string, fallback?: string | number | null) => extractionFields[key]?.value ?? fallback ?? "n/a";
                  const fieldConfidence = (key: string, fallback?: number | null) => extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employer</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("employerName", intelligence.extraction?.employerName))}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employee Name</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("employeeName", intelligence.extraction?.employeeName))}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employee Number</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("employeeNumber", intelligence.extraction?.employeeNumber))}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Designation</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("designation", intelligence.extraction?.designation))}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gross Earnings</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("grossEarnings", intelligence.extraction?.grossEarnings))}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Pay</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("netPay", intelligence.extraction?.netPay))}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Deductions</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("totalDeductions", intelligence.extraction?.totalDeductions))}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pay Date</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("payDate", intelligence.extraction?.payDate))}</p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pay Period</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("payPeriod", intelligence.extraction?.payPeriod))}</p>
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
                              {label}: {score as number}%
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
                            Employee: {String(intelligence.crossDocumentPreparation?.employeeName?.value ?? "n/a")}
                          </Badge>
                          <Badge tone="neutral">
                            Surname: {String(intelligence.crossDocumentPreparation?.surname?.value ?? "n/a")}
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
                  const fieldValue = (key: string, fallback?: string | number | null) => extractionFields[key]?.value ?? fallback ?? "n/a";
                  const fieldConfidence = (key: string, fallback?: number | null) => extractionFields[key]?.confidence ?? fallback ?? 0;

                  return intelligence ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bank Name</p>
                        <p className="mt-2 text-sm text-slate-100">{String(fieldValue("bankName", intelligence.classification?.bankName ?? null))}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fingerprint</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(intelligence.bankFingerprint?.bankName ?? intelligence.classification?.bankName ?? "n/a")}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document Version</p>
                        <p className="mt-2 text-sm text-slate-100">{String(intelligence.bankFingerprint?.documentVersion ?? "n/a")}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Statement Layout</p>
                        <p className="mt-2 text-sm text-slate-100">{String(intelligence.bankFingerprint?.statementLayout ?? "n/a")}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account Holder</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("accountHolder", intelligence.extraction?.accountHolder?.value ?? null))}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account Number</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("accountNumber", intelligence.extraction?.accountNumber?.value ?? null))}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Statement Period</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("statementPeriod", intelligence.extraction?.statementPeriod?.value ?? null))}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Opening Balance</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("openingBalance", intelligence.extraction?.openingBalance?.value ?? null))}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Closing Balance</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("closingBalance", intelligence.extraction?.closingBalance?.value ?? null))}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Average Monthly Income</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("averageMonthlyIncome", intelligence.extraction?.averageMonthlyIncome?.value ?? null))}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disposable Income Estimate</p>
                        <p className="mt-2 text-sm text-slate-100">
                          {String(fieldValue("disposableIncomeEstimate", intelligence.extraction?.disposableIncomeEstimate?.value ?? null))}
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
                              {label}: {score as number}%
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
