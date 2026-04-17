import OpenAI from "openai";

import { runOCR } from "@/server/services/ocrService";

const DEFAULT_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

export type DocumentValidationResult = {
  valid: boolean;
  extractedFields: {
    registrationNumber?: string;
    expiryDate?: string;
    companyName?: string;
  };
  issues: string[];
  confidenceScore: number;
  fraudIndicators: string[];
};

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function clampConfidenceScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function sanitizeValidationResult(value: unknown): DocumentValidationResult {
  const fallback: DocumentValidationResult = {
    valid: false,
    extractedFields: {},
    issues: ["AI validation returned an invalid payload"],
    confidenceScore: 0,
    fraudIndicators: [],
  };

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const raw = value as Record<string, unknown>;
  const extractedFields =
    raw.extractedFields && typeof raw.extractedFields === "object"
      ? (raw.extractedFields as Record<string, unknown>)
      : {};

  return {
    valid: raw.valid === true,
    extractedFields: {
      registrationNumber: normalizeString(extractedFields.registrationNumber),
      expiryDate: normalizeString(extractedFields.expiryDate),
      companyName: normalizeString(extractedFields.companyName),
    },
    issues: Array.isArray(raw.issues)
      ? raw.issues.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    confidenceScore: clampConfidenceScore(raw.confidenceScore),
    fraudIndicators: Array.isArray(raw.fraudIndicators)
      ? raw.fraudIndicators.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
  };
}

function extractJsonPayload(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || content.trim();
}

async function fetchDocumentBuffer(fileUrl: string) {
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Document fetch failed with ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type")?.trim() || undefined,
  };
}

async function extractDocumentText(fileUrl: string, documentType: string) {
  const { buffer, mimeType } = await fetchDocumentBuffer(fileUrl);
  const filename = `${documentType || "document"}.pdf`;
  return runOCR(buffer, { filename, mimeType });
}

export async function validateDocument(
  fileUrl: string,
  documentType: string
): Promise<DocumentValidationResult> {
  if (!fileUrl.trim()) {
    return {
      valid: false,
      extractedFields: {},
      issues: ["Missing file URL"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return {
      valid: false,
      extractedFields: {},
      issues: ["AI validation unavailable"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  let extractedText = "";

  try {
    extractedText = await extractDocumentText(fileUrl, documentType);
  } catch (error) {
    console.error("Document text extraction failed", {
      fileUrl,
      documentType,
      error,
    });

    return {
      valid: false,
      extractedFields: {},
      issues: ["Document text extraction failed"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  if (!extractedText.trim()) {
    return {
      valid: false,
      extractedFields: {},
      issues: ["No readable text extracted from document"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }

  try {
    const response = await openai.responses.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "document_validation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              valid: { type: "boolean" },
              extractedFields: {
                type: "object",
                additionalProperties: false,
                properties: {
                  registrationNumber: { type: ["string", "null"] },
                  expiryDate: { type: ["string", "null"] },
                  companyName: { type: ["string", "null"] },
                },
                required: ["registrationNumber", "expiryDate", "companyName"],
              },
              issues: {
                type: "array",
                items: { type: "string" },
              },
              confidenceScore: { type: "number" },
              fraudIndicators: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["valid", "extractedFields", "issues", "confidenceScore", "fraudIndicators"],
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
                "You validate contractor compliance documents. " +
                "Return only structured JSON. " +
                "Mark valid true only when the document appears authentic, complete, and fit for compliance use. " +
                "Flag inconsistencies, missing identifiers, expired dates, and fraud indicators.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Document type: ${documentType}\n` +
                `File URL: ${fileUrl}\n\n` +
                "Extract and validate:\n" +
                "- registrationNumber\n" +
                "- expiryDate\n" +
                "- companyName\n" +
                "- validity\n" +
                "- issues\n" +
                "- fraudIndicators\n" +
                "- confidenceScore (0-100)\n\n" +
                `Document text:\n${extractedText.slice(0, 16000)}`,
            },
          ],
        },
      ],
    });

    if (!response.output_text) {
      return {
        valid: false,
        extractedFields: {},
        issues: ["AI validation returned an empty response"],
        confidenceScore: 0,
        fraudIndicators: [],
      };
    }

    return sanitizeValidationResult(JSON.parse(extractJsonPayload(response.output_text)));
  } catch (error) {
    console.error("Document AI validation failed", {
      fileUrl,
      documentType,
      error,
    });

    return {
      valid: false,
      extractedFields: {},
      issues: ["AI validation failed"],
      confidenceScore: 0,
      fraudIndicators: [],
    };
  }
}
