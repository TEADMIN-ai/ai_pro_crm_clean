"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import Card from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import {
  CRITICAL_TENDER_FIELD_LABELS,
  type CriticalTenderField,
} from "@/lib/tender/criticalTenderFields";
import { API_ROUTES } from "@/lib/routes";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { downloadTenderReport } from "@/lib/reports/downloadTenderReport";
import { generateTenderReport } from "@/lib/reports/generateTenderReport";

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

export default function TenderPackGeneratorPanel() {
  const params = useParams();
  const { user } = useAuth();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : "";

  const [templateKey, setTemplateKey] = useState<SbdFormKey>(SBD_TEMPLATE_KEYS[0]);
  const [loading, setLoading] = useState(false);
  const [savingMissingFields, setSavingMissingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
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
    const response = await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractorId));
    const payload = (await response.json()) as ContractorDetailResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load contractor");
    }

    const nextForm: Partial<Record<CriticalTenderField, string>> = {};
    for (const field of fields) {
      const rawValue = payload[field];
      nextForm[field] = typeof rawValue === "string" ? rawValue : "";
    }

    setForm(nextForm);
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

  async function handleGenerate() {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }
      if (!contractorId) {
        throw new Error("Missing contractorId");
      }

      setLoading(true);
      setError(null);
      setResult(null);
      const missingFields = await fetchCriticalMissingFields();
      if (missingFields.length > 0) {
        await openMissingFieldsModal(missingFields);
        return;
      }

      await requestGeneration();
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
      await requestGeneration();
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

      {error && <p style={{ marginTop: "12px" }}>{error}</p>}

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
