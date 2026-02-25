"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import Card from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { API_ROUTES } from "@/lib/routes";
import { SBD_TEMPLATE_KEYS, type SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

type GenerateResponse = {
  packId: string;
  downloadURL: string;
  missingFields: string[];
  warnings: string[];
};

export default function TenderPackGeneratorPanel() {
  const params = useParams();
  const { user } = useAuth();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : "";

  const [templateKey, setTemplateKey] = useState<SbdFormKey>(SBD_TEMPLATE_KEYS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

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

      const token = await user.getIdToken(true);
      const response = await fetch(API_ROUTES.TENDER_PACK_GENERATE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
    } catch (generateError) {
      console.error(generateError);
      setError(generateError instanceof Error ? generateError.message : "Failed to generate tender pack");
    } finally {
      setLoading(false);
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

      {error && <p style={{ marginTop: "12px" }}>{error}</p>}

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
                  <li key={field}>{field}</li>
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
