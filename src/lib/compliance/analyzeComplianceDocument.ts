import OpenAI from "openai";
import { isSupportedDocumentType, type SupportedDocumentType } from "@/lib/compliance/contractorCompliance";

const DEFAULT_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

type FieldSchema = {
  type: ["string", "null"];
};

export type ComplianceAnalysisResult = {
  documentType: SupportedDocumentType;
  extractedFields: Record<string, string | null>;
  confidenceScore: number;
};

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function getFieldDefinitions(documentType: SupportedDocumentType): Record<string, FieldSchema> {
  switch (documentType) {
    case "cipc":
      return {
        companyRegistrationNumber: { type: ["string", "null"] },
        companyName: { type: ["string", "null"] },
        registrationDate: { type: ["string", "null"] },
      };
    case "bbbee":
      return {
        beeLevel: { type: ["string", "null"] },
        certificateNumber: { type: ["string", "null"] },
        expiryDate: { type: ["string", "null"] },
      };
    case "taxClearance":
      return {
        taxPin: { type: ["string", "null"] },
        taxpayerName: { type: ["string", "null"] },
        expiryDate: { type: ["string", "null"] },
      };
    case "coida":
      return {
        employerRegistrationNumber: { type: ["string", "null"] },
        employerName: { type: ["string", "null"] },
        expiryDate: { type: ["string", "null"] },
      };
    case "bankConfirmation":
      return {
        bankName: { type: ["string", "null"] },
        accountHolder: { type: ["string", "null"] },
        accountNumber: { type: ["string", "null"] },
        branchCode: { type: ["string", "null"] },
      };
  }
}

function getRequiredFields(documentType: SupportedDocumentType): string[] {
  return Object.keys(getFieldDefinitions(documentType));
}

function normalizeStringRecord(
  value: unknown,
  allowedFields: string[]
): Record<string, string | null> {
  const output: Record<string, string | null> = {};

  for (const field of allowedFields) {
    output[field] = null;
  }

  if (!value || typeof value !== "object") {
    return output;
  }

  for (const field of allowedFields) {
    const raw = (value as Record<string, unknown>)[field];
    output[field] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  return output;
}

function normalizeConfidenceScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function analyzeComplianceDocument(
  documentType: string,
  text: string
): Promise<ComplianceAnalysisResult> {
  if (!isSupportedDocumentType(documentType)) {
    throw new Error(`Unsupported document type: ${documentType}`);
  }

  const allowedFields = getRequiredFields(documentType);
  const emptyResult: ComplianceAnalysisResult = {
    documentType,
    extractedFields: normalizeStringRecord(null, allowedFields),
    confidenceScore: 0,
  };

  if (!text.trim()) {
    return emptyResult;
  }

  const client = getOpenAIClient();
  if (!client) {
    return emptyResult;
  }

  const fieldDefinitions = getFieldDefinitions(documentType);

  try {
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "compliance_document_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              extractedFields: {
                type: "object",
                additionalProperties: false,
                properties: fieldDefinitions,
                required: allowedFields,
              },
              confidenceScore: {
                type: "number",
              },
            },
            required: ["extractedFields", "confidenceScore"],
          },
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Extract structured fields from South African contractor compliance documents. " +
                "Return only fields present in the schema. Use null when a value is missing or unreadable. " +
                "Normalize dates to YYYY-MM-DD. Return confidenceScore as 0 to 100.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Document type: ${documentType}\n\n` +
                `Extract these fields: ${allowedFields.join(", ")}\n\n` +
                `Document text:\n${text.slice(0, 15000)}`,
            },
          ],
        },
      ],
    });

    if (!response.output_text) {
      return emptyResult;
    }

    const parsed = JSON.parse(response.output_text) as {
      extractedFields?: unknown;
      confidenceScore?: unknown;
    };

    return {
      documentType,
      extractedFields: normalizeStringRecord(parsed.extractedFields, allowedFields),
      confidenceScore: normalizeConfidenceScore(parsed.confidenceScore),
    };
  } catch (error) {
    console.error("Compliance document analysis failed", {
      documentType,
      error,
    });
    return emptyResult;
  }
}
