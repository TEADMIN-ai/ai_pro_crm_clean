"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { authFetch } from "@/lib/client/authFetch";
import {
  getVehicleFinanceTrainingCategoryLabel,
} from "@/lib/vehicle-finance/training/datasets";
import {
  VEHICLE_FINANCE_TRAINING_CATEGORIES,
  VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS,
} from "@/lib/vehicle-finance/training/types";
import type {
  VehicleFinanceTrainingCategory,
  VehicleFinanceTrainingOverview,
  VehicleFinanceTrainingResult,
} from "@/lib/vehicle-finance/training/types";

type TrainingTab = "dataset" | "ocr-results" | "extraction-accuracy" | "validation-results";

type VehicleFinanceValidationJobStatus = "QUEUED" | "PROCESSING" | "PROCESSED" | "FAILED";

type ValidationQueueResponse = {
  jobId: string;
  documentId: string;
  status: VehicleFinanceValidationJobStatus;
  message?: string;
  error?: string;
};

type ValidationStatusResponse = {
  job: {
    jobId: string;
    documentId: string;
    status: VehicleFinanceValidationJobStatus;
    errorMessage?: string | null;
  };
  status: VehicleFinanceValidationJobStatus;
};

const EMPTY_OVERVIEW: VehicleFinanceTrainingOverview = {
  metrics: {
    ocrSuccessRate: 0,
    averageConfidence: 0,
    extractionAccuracy: 0,
    failedDocuments: 0,
    failedExtractions: 0,
    missingFields: 0,
    totalDocuments: 0,
    validatedDocuments: 0,
  },
  documents: [],
  results: [],
};

const TABS: Array<{ key: TrainingTab; label: string }> = [
  { key: "dataset", label: "Dataset" },
  { key: "ocr-results", label: "OCR Results" },
  { key: "extraction-accuracy", label: "Extraction Accuracy" },
  { key: "validation-results", label: "Validation Results" },
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

function getResultBadgeTone(result?: VehicleFinanceTrainingResult | null) {
  if (!result) return "warning" as const;
  return result.passedValidation ? "success" : "danger" as const;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function VehicleFinanceTrainingWorkspace() {
  const [activeTab, setActiveTab] = useState<TrainingTab>("dataset");
  const [overview, setOverview] = useState<VehicleFinanceTrainingOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [category, setCategory] = useState<VehicleFinanceTrainingCategory>("ids");
  const [file, setFile] = useState<File | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/vehicle-finance/training/overview", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as VehicleFinanceTrainingOverview & { error?: string } | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? `Training overview request failed (${response.status})`);
      }
      setOverview(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Vehicle finance training overview unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const documents = overview.documents;
  const results = overview.results;

  const categoryCounts = useMemo(() => {
    return VEHICLE_FINANCE_TRAINING_CATEGORIES.map((item) => {
      const count = documents.filter((document) => document.category === item).length;
      const templateFields = overview.results
        .filter((result) => result.category === item)
        .reduce((sum, result) => sum + (result.expectedFields?.length ?? 0), 0);
      const matchedFields = overview.results
        .filter((result) => result.category === item)
        .reduce((sum, result) => sum + (result.expectedFields?.filter((field) => (result.extractedFields[field] ?? "").trim()).length ?? 0), 0);
      return {
        category: item,
        label: getVehicleFinanceTrainingCategoryLabel(item),
        count,
        accuracy: templateFields > 0 ? Math.round((matchedFields / templateFields) * 100) : 0,
      };
    });
  }, [documents, overview.results]);

  async function refresh() {
    await loadOverview();
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF before uploading.");
      return;
    }

    try {
      setBusy("upload");
      const formData = new FormData();
      formData.append("category", category);
      formData.append("file", file);
      const response = await authFetch("/api/vehicle-finance/training/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Training upload failed (${response.status})`);
      }
      setFile(null);
      await refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Training upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function validateDocument(
    documentId: string,
    options?: { refreshAfter?: boolean; manageBusy?: boolean },
  ) {
    try {
      if (options?.manageBusy ?? true) {
        setBusy(`run:${documentId}`);
      }
      const response = await authFetch(`/api/vehicle-finance/training/documents/${encodeURIComponent(documentId)}/validate`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ValidationQueueResponse | null;
      if (!response.ok && response.status !== 202) {
        throw new Error(payload?.error ?? `Training validation failed (${response.status})`);
      }
      if (!payload?.jobId) {
        throw new Error("Training validation job was not created.");
      }

      let currentStatus = payload.status;
      let attempts = 0;
      while (currentStatus === "QUEUED" || currentStatus === "PROCESSING") {
        // Sequential polling keeps the request path short while the worker completes.
        // eslint-disable-next-line no-await-in-loop
        await sleep(1000);
        attempts += 1;
        // eslint-disable-next-line no-await-in-loop
        const statusResponse = await authFetch(
          `/api/vehicle-finance/training/documents/${encodeURIComponent(documentId)}/validate?jobId=${encodeURIComponent(payload.jobId)}`,
          { cache: "no-store" },
        );
        // eslint-disable-next-line no-await-in-loop
        const statusPayload = (await statusResponse.json().catch(() => null)) as ValidationStatusResponse | null;
        if (!statusResponse.ok || !statusPayload?.job) {
          throw new Error(statusPayload?.job?.errorMessage ?? `Training validation status failed (${statusResponse.status})`);
        }
        currentStatus = statusPayload.job.status;
        if (attempts >= 30 && (currentStatus === "QUEUED" || currentStatus === "PROCESSING")) {
          throw new Error("Training validation is still processing.");
        }
      }
      if (currentStatus === "FAILED") {
        throw new Error("Training validation failed.");
      }
      if (options?.refreshAfter ?? true) {
        await refresh();
      }
      return payload;
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Training validation failed");
      return null;
    } finally {
      if (options?.manageBusy ?? true) {
        setBusy(null);
      }
    }
  }

  async function runRegression() {
    try {
      setBusy("run-all");
      for (const document of documents) {
        // Sequential on purpose: keeps each server request short and bounded.
        // eslint-disable-next-line no-await-in-loop
        await validateDocument(document.documentId, { refreshAfter: false, manageBusy: false });
      }
      await refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Training validation failed");
    } finally {
      setBusy(null);
    }
  }

  const storageFolders = VEHICLE_FINANCE_TRAINING_CATEGORIES.map((categoryItem) => ({
    category: categoryItem,
    label: getVehicleFinanceTrainingCategoryLabel(categoryItem),
    path: `${VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS[categoryItem]}/`,
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Vehicle Finance Training</h1>
            <Badge tone="info">Golden Dataset</Badge>
          </div>
          <p className="max-w-3xl text-sm text-slate-400">
            Standalone training library for OCR regression, document recognition, extraction templates, and validation runs.
          </p>
        </div>

        <Link href="/dashboard/vehicle-finance" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 no-underline">
          Back to Vehicle Finance
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-slate-700 bg-slate-900/40 text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-slate-300">Loading training library...</p>
        </Card>
      ) : null}

      {activeTab === "dataset" ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <IdentityCardHeader title="Upload Training Document" subtitle="Populate the golden dataset" />
            <form className="mt-4 grid gap-3" onSubmit={submitUpload}>
              <label className="grid gap-1 text-sm text-slate-300">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as VehicleFinanceTrainingCategory)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  {VEHICLE_FINANCE_TRAINING_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {getVehicleFinanceTrainingCategoryLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm text-slate-300">
                <span>PDF File</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                />
              </label>

              <button
                type="submit"
                disabled={busy === "upload" || !file}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {busy === "upload" ? "Uploading..." : "Upload Training Document"}
              </button>
            </form>
          </Card>

          <Card>
            <IdentityCardHeader title="Dataset" subtitle="Training documents and storage paths" />
            <Table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Documents</th>
                  <th>Storage Folder</th>
                  <th>Latest Status</th>
                </tr>
              </thead>
              <tbody>
                {storageFolders.map((folder) => {
                  const latestDocument = documents.find((document) => document.category === folder.category) ?? null;
                  return (
                    <tr key={folder.category}>
                      <td>{folder.label}</td>
                      <td>{documents.filter((document) => document.category === folder.category).length}</td>
                      <td>{folder.path}</td>
                      <td>
                        {latestDocument ? (
                          <Badge tone={latestDocument.status === "VALIDATED" ? "success" : latestDocument.status === "NEEDS_REVIEW" ? "warning" : latestDocument.status === "FAILED" ? "danger" : "info"}>
                            {latestDocument.status}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Empty</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <div className="mt-6">
              <IdentityCardHeader title="Uploaded Documents" subtitle="Manage the active dataset" />
              <Table className="mt-4">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Category</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th>OCR/Text</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length ? (
                    documents.map((document) => {
                      const result = results.find((item) => item.documentId === document.documentId) ?? null;
                      return (
                        <tr key={document.documentId}>
                          <td>{document.filename}</td>
                          <td>{getVehicleFinanceTrainingCategoryLabel(document.category)}</td>
                          <td>{formatDate(document.uploadedAt)}</td>
                          <td>
                            <Badge
                              tone={
                                document.status === "VALIDATED"
                                  ? "success"
                                  : document.status === "NEEDS_REVIEW"
                                    ? "warning"
                                    : document.status === "FAILED"
                                      ? "danger"
                                      : "info"
                              }
                            >
                              {document.status}
                            </Badge>
                          </td>
                          <td>{result ? `${result.extractedTextLength} chars | ${result.extractionMethod}` : "Not processed"}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void validateDocument(document.documentId)}
                              disabled={busy === `run:${document.documentId}`}
                              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200"
                            >
                              {busy === `run:${document.documentId}` ? "Running..." : "Validate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-sm text-slate-400">
                        No training documents available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "ocr-results" ? (
        <Card>
          <IdentityCardHeader
            title="OCR Results"
            subtitle="Compare PDF text, OpenAI OCR, and Tesseract OCR"
          />
          <Table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Method</th>
                <th>PDF Text</th>
                <th>OpenAI OCR</th>
                <th>Tesseract OCR</th>
                <th>Selected</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const document = documents.find((item) => item.documentId === result.documentId);
                return (
                  <tr key={result.documentId}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-100">{document?.filename ?? result.documentId}</p>
                        <p className="text-xs text-slate-400">{getVehicleFinanceTrainingCategoryLabel(result.category)}</p>
                      </div>
                    </td>
                    <td>{result.extractionMethod}</td>
                    <td>{result.pdfTextLength ?? 0}</td>
                    <td>{result.openAiOcrTextLength ?? 0}</td>
                    <td>{result.tesseractOcrTextLength ?? 0}</td>
                    <td>
                      <div className="space-y-1">
                        <Badge tone={getResultBadgeTone(result)}>
                          {result.passedValidation ? "PASS" : "FAIL"}
                        </Badge>
                        <p className="text-xs text-slate-400">{result.selectedTextPreview ?? "No text selected"}</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {activeTab === "extraction-accuracy" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["OCR Success Rate", `${overview.metrics.ocrSuccessRate}%`],
              ["Average Confidence", `${overview.metrics.averageConfidence}%`],
              ["Extraction Accuracy", `${overview.metrics.extractionAccuracy}%`],
              ["Failed Extractions", String(overview.metrics.failedExtractions)],
              ["Total Documents", String(overview.metrics.totalDocuments)],
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-50">{value}</h2>
              </Card>
            ))}
          </div>

          <Card>
            <IdentityCardHeader title="Accuracy by Category" subtitle="Field coverage against expected templates" />
            <Table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Documents</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {categoryCounts.map((item) => (
                  <tr key={item.category}>
                    <td>{item.label}</td>
                    <td>{item.count}</td>
                    <td>{item.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      ) : null}

      {activeTab === "validation-results" ? (
        <Card>
          <IdentityCardHeader title="Validation Results" subtitle="Regression pass/fail and missing fields" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runRegression()}
              disabled={busy === "run-all"}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {busy === "run-all" ? "Running..." : "Run Regression"}
            </button>
            <Badge tone="info">{overview.metrics.validatedDocuments} validated</Badge>
            <Badge tone="warning">{overview.metrics.missingFields} missing fields</Badge>
            <Badge tone="neutral">{overview.metrics.totalDocuments} total documents</Badge>
          </div>

          <Table className="mt-4">
            <thead>
              <tr>
                <th>Document</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Validation Errors</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const document = documents.find((item) => item.documentId === result.documentId);
                return (
                  <tr key={result.documentId}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-100">{document?.filename ?? result.documentId}</p>
                        <p className="text-xs text-slate-400">{formatDate(result.createdAt)}</p>
                      </div>
                    </td>
                    <td>{result.confidenceScore}%</td>
                    <td>
                      <Badge tone={result.passedValidation ? "success" : "danger"}>
                        {result.passedValidation ? "PASS" : "FAIL"}
                      </Badge>
                    </td>
                    <td>{result.validationErrors.join(", ") || "None"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void validateDocument(result.documentId)}
                        disabled={busy === `run:${result.documentId}`}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200"
                      >
                        {busy === `run:${result.documentId}` ? "Running..." : "Re-run"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
