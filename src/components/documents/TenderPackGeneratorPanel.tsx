"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import Card from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import {
  generateTenderPackWithValidation,
  type GenerateTenderPackInput,
} from "@/lib/pdf/tenderPack";
import type { SBD1ValidationResult } from "@/lib/pdf/sbd1AutoFill";
import {
  CRITICAL_TENDER_FIELD_LABELS,
  type CriticalTenderField,
} from "@/lib/tender/criticalTenderFields";
import { API_ROUTES } from "@/lib/routes";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { downloadTenderReport } from "@/lib/reports/downloadTenderReport";
import { generateTenderReport } from "@/lib/reports/generateTenderReport";
import { generateSBD4Overlay } from "@/lib/pdf/sbd4Overlay";

type GenerateResponse = {
  packId: string;
  downloadURL: string;
  missingFields: string[];
  warnings: string[];
};

type ValidateResponse = {
  missingFields: CriticalTenderField[];
};

type ContractorDetailResponse = Record<string, unknown> & {
  success?: boolean;
  error?: string;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildInitials(value: string): string {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildTenderPackData(contractor: ContractorDetailResponse): GenerateTenderPackInput {
  const companyName = getString(contractor.companyName) || getString(contractor.name);
  const address =
    getString(contractor.streetAddress) ||
    getString(contractor.address) ||
    getString(contractor.physicalAddress) ||
    getString(contractor.postalAddress);
  const phone =
    getString(contractor.phone) ||
    getString(contractor.contactPhone) ||
    getString(contractor.telephone);
  const contactPerson =
    getString(contractor.contactPerson) ||
    getString(contractor.contactName) ||
    companyName;

  return {
    sbd1: {
      companyName,
      postalAddress: getString(contractor.postalAddress) || address,
      streetAddress: getString(contractor.streetAddress) || address,
      telephone: phone,
      cellphone: getString(contractor.cellphone) || phone,
      email: getString(contractor.email) || getString(contractor.contactEmail),
      vatNumber: getString(contractor.vatNumber) || getString(contractor.vat),
      taxPin: getString(contractor.taxPin) || getString(contractor.taxNumber),
      csdNumber: getString(contractor.csdNumber) || getString(contractor.csd),
    },
    sbd4: {
      bidder: {
        companyName,
      },
      declarations: {
        isEmployee: false,
        isDirector: false,
        relatedToStateEmployee: false,
        details: "",
      },
      signoff: {
        name: contactPerson,
        capacity: getString(contractor.capacity) || "Authorized Signatory",
        initials: buildInitials(contactPerson || companyName),
      },
    },
  };
}

function downloadPdfBytes(pdfBytes: Uint8Array) {
  const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
  normalizedBytes.set(pdfBytes);

  const blob = new Blob([normalizedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "TenderPack.pdf";
  anchor.click();

  URL.revokeObjectURL(url);
}

export default function TenderPackGeneratorPanel() {
  const params = useParams();
  const { user } = useAuth();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : "";

  const [templateKey, setTemplateKey] = useState<SbdFormKey>(SBD_TEMPLATE_KEYS[0]);
  const [loading, setLoading] = useState(false);
  const [savingMissingFields, setSavingMissingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [validation, setValidation] = useState<SBD1ValidationResult | null>(null);
  const [missingFieldsModalOpen, setMissingFieldsModalOpen] = useState(false);
  const [criticalMissingFields, setCriticalMissingFields] = useState<CriticalTenderField[]>([]);
  const [form, setForm] = useState<Partial<Record<CriticalTenderField, string>>>({});

  function updateField(field: CriticalTenderField, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function fetchCriticalMissingFields(): Promise<CriticalTenderField[]> {
    const response = await authFetch(API_ROUTES.TENDER_PACK_VALIDATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contractorId,
        templateKey,
      }),
    });

    const payload = (await response.json()) as ValidateResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to validate tender pack");
    }

    return payload.missingFields ?? [];
  }

  async function loadContractorFormValues(fields: CriticalTenderField[]) {
    const payload = await fetchContractorDetail();
    const nextForm: Partial<Record<CriticalTenderField, string>> = {};

    for (const field of fields) {
      if (field === "address") {
        nextForm[field] =
          getString(payload.address) ||
          getString(payload.streetAddress) ||
          getString(payload.physicalAddress) ||
          getString(payload.postalAddress);
        continue;
      }

      const rawValue = payload[field];
      nextForm[field] = typeof rawValue === "string" ? rawValue : "";
    }

    setForm(nextForm);
  }

  async function fetchContractorDetail(): Promise<ContractorDetailResponse> {
    const response = await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractorId));
    const payload = (await response.json()) as ContractorDetailResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load contractor");
    }

    return payload;
  }

  async function openMissingFieldsModal(fields: CriticalTenderField[]) {
    await loadContractorFormValues(fields);
    setCriticalMissingFields(fields);
    setMissingFieldsModalOpen(true);
  }

  async function requestGeneration() {
    const response = await authFetch(API_ROUTES.TENDER_PACK_GENERATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contractorId,
        templateKey,
      }),
    });

    const payload = (await response.json()) as Partial<GenerateResponse> & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to generate tender pack");
    }

    setResult({
      packId: payload.packId ?? "",
      downloadURL: payload.downloadURL ?? "",
      missingFields: payload.missingFields ?? [],
      warnings: payload.warnings ?? [],
    });
  }

  async function handleGeneratePack() {
    if (!user) {
      throw new Error("User not authenticated");
    }
    if (!contractorId) {
      throw new Error("Missing contractorId");
    }

    const missingFields = await fetchCriticalMissingFields();
    if (missingFields.length > 0) {
      await openMissingFieldsModal(missingFields);
      return;
    }

    const contractor = await fetchContractorDetail();
    const localResult = await generateTenderPackWithValidation(buildTenderPackData(contractor));

    setValidation(localResult.validation?.sbd1 ?? null);
    if (!localResult.validation?.sbd1.isValid) {
      return;
    }

    await requestGeneration();
    downloadPdfBytes(localResult.pdfBytes);
  }

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setValidation(null);
      await handleGeneratePack();
    } catch (generateError) {
      console.error(generateError);
      setError(generateError instanceof Error ? generateError.message : "Failed to generate tender pack");
    } finally {
      setLoading(false);
    }
  }

  async function handleMissingFieldsSubmit() {
    try {
      if (!contractorId) {
        throw new Error("Missing contractorId");
      }

      setSavingMissingFields(true);
      setError(null);

      const updates = criticalMissingFields.reduce<Record<string, string>>((accumulator, field) => {
        accumulator[field] = (form[field] ?? "").trim();
        return accumulator;
      }, {});

      const updateResponse = await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractorId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const updatePayload = (await updateResponse.json()) as { error?: string };
      if (!updateResponse.ok) {
        throw new Error(updatePayload.error ?? "Failed to save contractor details");
      }

      const remainingMissingFields = await fetchCriticalMissingFields();
      if (remainingMissingFields.length > 0) {
        setCriticalMissingFields(remainingMissingFields);
        throw new Error("Complete all required contractor fields before generating the tender pack");
      }

      setMissingFieldsModalOpen(false);
      setCriticalMissingFields([]);
      setValidation(null);
      await handleGeneratePack();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to save missing fields");
    } finally {
      setSavingMissingFields(false);
    }
  }

  async function handleGenerateReport() {
    try {
      const report = await generateTenderReport({
        clientName: "Test Client",
        documents: [],
        complianceScore: 100,
        approvedBy: "Torque Empire",
      });

      if (!report) {
        alert("Report generation failed");
        return;
      }

      downloadTenderReport(report);
    } catch (err) {
      console.error("Report error:", err);
      alert("Error generating report");
    }
  }

  const handleGenerateSBD4 = async () => {
    const pdfBytes = await generateSBD4Overlay({
      directors: [
        {
          name: "Chadwin Karanie",
          id: "9001011234087",
          entity: "Torque Empire Pty Ltd",
        },
        {
          name: "Shane Karanie",
          id: "9202025678087",
          entity: "Torque Empire Pty Ltd",
        },
      ],
      hasRelationship: "NO",
      declarationName: "Chadwin Karanie",
    });

    if (!pdfBytes) return;

    const normalizedBytes = new Uint8Array(pdfBytes.byteLength);
    normalizedBytes.set(pdfBytes);

    const blob = new Blob([normalizedBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    window.open(url);
  };

  return (
    <Card>
      <h2>Generate Tender Pack</h2>
      <p>Generate an autofilled tender pack from contractor profile and document intelligence.</p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
        <label htmlFor="templateKey">Template</label>
        <select
          id="templateKey"
          value={templateKey}
          onChange={(event) => setTemplateKey(event.target.value as SbdFormKey)}
          disabled={loading}
        >
          {SBD_TEMPLATE_KEYS.map((key) => (
            <option key={key} value={key}>
              {key.toUpperCase()}
            </option>
          ))}
        </select>

        <button onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating..." : "Generate Tender Pack"}
        </button>
      </div>
      <button
        onClick={handleGenerateReport}
        className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
      >
        Generate Report
      </button>
      <button
        onClick={handleGenerateSBD4}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Generate SBD4
      </button>

      {error && <p style={{ marginTop: "12px" }}>{error}</p>}

      {validation && !validation.isValid && (
        <div style={{ marginTop: "12px" }}>
          <h3 style={{ marginBottom: "8px" }}>Missing Fields:</h3>
          <ul>
            {validation.missingLabels.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      )}

      {missingFieldsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 1000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="missing-fields-title"
            style={{
              width: "100%",
              maxWidth: "560px",
              background: "#fff",
              color: "#111827",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h3 id="missing-fields-title" style={{ margin: 0 }}>
              Complete contractor data
            </h3>
            <p style={{ marginTop: "8px" }}>
              Fill the missing contractor fields below to continue generating the tender pack.
            </p>
            <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
              {criticalMissingFields.map((field) => (
                <label key={field} style={{ display: "grid", gap: "6px" }}>
                  <span>{CRITICAL_TENDER_FIELD_LABELS[field]}</span>
                  <input
                    value={form[field] ?? ""}
                    onChange={(event) => updateField(field, event.target.value)}
                    disabled={savingMissingFields}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      font: "inherit",
                    }}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setMissingFieldsModalOpen(false)}
                disabled={savingMissingFields}
              >
                Cancel
              </button>
              <button type="button" onClick={handleMissingFieldsSubmit} disabled={savingMissingFields}>
                {savingMissingFields ? "Saving..." : "Save and Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: "12px" }}>
          <p>Pack ID: {result.packId}</p>
          {result.downloadURL && (
            <p>
              <a href={result.downloadURL} target="_blank" rel="noreferrer noopener">
                Download Generated Tender Pack
              </a>
            </p>
          )}
          {result.missingFields.length > 0 && (
            <div>
              <p>Missing fields:</p>
              <ul>
                {result.missingFields.map((field) => (
                  <li key={field}>{field in CRITICAL_TENDER_FIELD_LABELS ? CRITICAL_TENDER_FIELD_LABELS[field as CriticalTenderField] : field}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div>
              <p>Warnings:</p>
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
