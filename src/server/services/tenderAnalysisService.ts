import OpenAI from "openai";
import { getStorage } from "firebase-admin/storage";
import { PDFParse } from "pdf-parse";
import { getAdminApp, getFirebaseAdmin } from "@/lib/firebase/admin";
import { listContractorDocuments } from "@/server/services/contractorService";
import { extractTextOCR } from "@/server/services/ocrService";

type TenderDocumentType = "tender" | "rfq" | "rfp" | "quotation" | "unknown";
type TenderRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type TenderAnalysisInput = {
  contractorId: string;
  documentPath: string;
  documentType?: string | null;
};

type TenderStructuredExtraction = {
  issuingAuthority: string | null;
  tenderNumber: string | null;
  submissionDeadline: string | null;
  scopeOfWork: string | null;
  requiredCertificates: string[];
  estimatedValue: number | null;
  location: string | null;
};

type TenderAnalysisRecord = {
  issuingAuthority: string | null;
  tenderNumber: string | null;
  deadline: string | null;
  scope: string | null;
  requiredCertificates: string[];
  estimatedValue: number | null;
  location: string | null;
  aiAnalyzedAt: string;
};

export type TenderAnalysisResult = {
  tenderId: string;
  documentType: TenderDocumentType;
  analysis: TenderAnalysisRecord;
  complianceMatch: boolean;
  missingRequirements: string[];
  readinessScore: number;
  riskLevel: TenderRiskLevel;
};

const DEFAULT_MODEL = process.env.OPENAI_TENDER_MODEL || process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function getBucketName(): string | undefined {
  const value = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function inferTenderId(documentPath: string): string {
  const segments = documentPath.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "tenders") {
    return segments[1];
  }

  if (segments.length >= 2 && segments[0] === "deals") {
    return segments[1];
  }

  throw new Error("Unable to infer tenderId from documentPath");
}

function normalizeTenderDocumentType(value: string | null | undefined): TenderDocumentType {
  switch ((value ?? "").trim().toLowerCase()) {
    case "tender":
    case "rfq":
    case "rfp":
    case "quotation":
      return value!.trim().toLowerCase() as TenderDocumentType;
    default:
      return "unknown";
  }
}

function normalizeRequirementToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function normalizeRequiredCertificates(values: string[]): string[] {
  const mapped = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const token = normalizeRequirementToken(value);
      if (token.includes("coida") || token.includes("compensation fund")) {
        return "COIDA";
      }
      if (token.includes("bbbee") || token.includes("b bee") || token.includes("bee level")) {
        return "BBBEE";
      }
      if (token.includes("tax")) {
        return "Tax Clearance";
      }
      if (token.includes("bank")) {
        return "Bank Confirmation";
      }
      if (token.includes("cipc") || token.includes("registration")) {
        return "CIPC";
      }
      return value;
    });

  return Array.from(new Set(mapped));
}

async function downloadPdfBuffer(documentPath: string): Promise<Buffer> {
  const storage = getStorage(getAdminApp());
  const bucketName = getBucketName();
  const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();
  const [buffer] = await bucket.file(documentPath).download();
  return Buffer.from(buffer);
}

async function extractPdfText(documentPath: string): Promise<string> {
  const fileBuffer = await downloadPdfBuffer(documentPath);
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const parsed = await parser.getText();
    const text = parsed.text.trim();

    if (!text || text.length < 100) {
      console.log("FALLBACK: OCR triggered");
      return extractTextOCR(fileBuffer);
    }

    return text;
  } finally {
    await parser.destroy();
  }
}

function fallbackExtraction(text: string): TenderStructuredExtraction {
  const tenderNumber =
    text.match(/(?:tender|bid|rfq|rfp)\s*(?:number|no\.?|#)?[:\s-]*([A-Z0-9/-]{4,})/i)?.[1] ?? null;
  const issuingAuthority =
    text.match(/(?:issued by|issuing authority|department|municipality)[:\s-]+([A-Z][A-Z0-9 '&(),.-]{4,})/i)?.[1]?.trim() ??
    null;
  const submissionDeadline =
    text.match(/(?:submission deadline|closing date|closing time|deadline)[:\s-]+([^\n]+)/i)?.[1]?.trim() ?? null;
  const location =
    text.match(/(?:location|site|place of delivery|delivery location)[:\s-]+([^\n]+)/i)?.[1]?.trim() ?? null;
  const estimatedValueMatch =
    text.match(/(?:estimated value|contract value|tender value|budget)[:\s-]*R?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1] ??
    null;
  const estimatedValue = estimatedValueMatch ? Number(estimatedValueMatch.replace(/,/g, "")) : null;

  const requiredCertificates = normalizeRequiredCertificates([
    ...(text.match(/coida/gi) ?? []).map(() => "COIDA"),
    ...(text.match(/b[\s-]?bbbee/gi) ?? []).map(() => "BBBEE"),
    ...(text.match(/tax (?:clearance|compliance)/gi) ?? []).map(() => "Tax Clearance"),
  ]);

  return {
    issuingAuthority,
    tenderNumber,
    submissionDeadline,
    scopeOfWork: null,
    requiredCertificates,
    estimatedValue: Number.isFinite(estimatedValue ?? NaN) ? estimatedValue : null,
    location,
  };
}

async function extractStructuredTenderData(text: string, documentType: TenderDocumentType): Promise<TenderStructuredExtraction> {
  const client = getOpenAIClient();
  if (!client || !text.trim()) {
    return fallbackExtraction(text);
  }

  try {
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "tender_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              issuingAuthority: { type: ["string", "null"] },
              tenderNumber: { type: ["string", "null"] },
              submissionDeadline: { type: ["string", "null"] },
              scopeOfWork: { type: ["string", "null"] },
              requiredCertificates: {
                type: "array",
                items: { type: "string" },
              },
              estimatedValue: { type: ["number", "null"] },
              location: { type: ["string", "null"] },
            },
            required: [
              "issuingAuthority",
              "tenderNumber",
              "submissionDeadline",
              "scopeOfWork",
              "requiredCertificates",
              "estimatedValue",
              "location",
            ],
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
                "Analyze tender documents and return only the requested JSON fields. " +
                "Normalize required certificates to plain names like COIDA, BBBEE, Tax Clearance, CIPC, Bank Confirmation where possible.",
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
                "Analyze the following tender document text and extract the key structured fields.\n\n" +
                "Return valid JSON with:\n" +
                "- issuingAuthority\n" +
                "- tenderNumber\n" +
                "- submissionDeadline\n" +
                "- scopeOfWork\n" +
                "- requiredCertificates\n" +
                "- estimatedValue\n" +
                "- location\n\n" +
                `Tender text:\n${text.slice(0, 18000)}`,
            },
          ],
        },
      ],
    });

    if (!response.output_text) {
      return fallbackExtraction(text);
    }

    const parsed = JSON.parse(response.output_text) as Partial<TenderStructuredExtraction>;
    return {
      issuingAuthority: typeof parsed.issuingAuthority === "string" ? parsed.issuingAuthority.trim() || null : null,
      tenderNumber: typeof parsed.tenderNumber === "string" ? parsed.tenderNumber.trim() || null : null,
      submissionDeadline:
        typeof parsed.submissionDeadline === "string" ? parsed.submissionDeadline.trim() || null : null,
      scopeOfWork: typeof parsed.scopeOfWork === "string" ? parsed.scopeOfWork.trim() || null : null,
      requiredCertificates: normalizeRequiredCertificates(
        Array.isArray(parsed.requiredCertificates)
          ? parsed.requiredCertificates.filter((value): value is string => typeof value === "string")
          : []
      ),
      estimatedValue: typeof parsed.estimatedValue === "number" && Number.isFinite(parsed.estimatedValue)
        ? parsed.estimatedValue
        : null,
      location: typeof parsed.location === "string" ? parsed.location.trim() || null : null,
    };
  } catch {
    return fallbackExtraction(text);
  }
}

function hasValidDocument(contractorDocument: {
  documentType?: string;
  docType?: string;
  status?: string;
  verified?: boolean;
}): boolean {
  const type = (contractorDocument.documentType ?? contractorDocument.docType ?? "").toLowerCase();
  const status = (contractorDocument.status ?? "").toLowerCase();
  return Boolean(type) && (contractorDocument.verified === true || status === "verified" || status === "expiringsoon");
}

async function buildComplianceMatch(contractorId: string, requiredCertificates: string[]) {
  const documents = await listContractorDocuments(contractorId);
  const verifiedTypes = new Set(
    documents
      .filter((document) => hasValidDocument(document))
      .map((document) => (document.documentType ?? document.docType ?? "").toLowerCase())
  );

  const requiredMappings: Array<{ label: string; acceptedTypes: string[] }> = [
    { label: "COIDA", acceptedTypes: ["coida"] },
    { label: "BBBEE", acceptedTypes: ["bbbee"] },
    { label: "Tax Clearance", acceptedTypes: ["taxclearance"] },
    { label: "Bank Confirmation", acceptedTypes: ["bankconfirmation"] },
    { label: "CIPC", acceptedTypes: ["cipc"] },
  ];

  const missingRequirements = requiredCertificates.filter((requirement) => {
    const mapping = requiredMappings.find((item) => item.label.toLowerCase() === requirement.toLowerCase());
    if (!mapping) {
      return false;
    }

    return !mapping.acceptedTypes.some((type) => verifiedTypes.has(type));
  });

  const matchedCount = Math.max(requiredCertificates.length - missingRequirements.length, 0);
  const readinessScore =
    requiredCertificates.length > 0
      ? Math.round((matchedCount / requiredCertificates.length) * 100)
      : documents.some((document) => hasValidDocument(document))
        ? 100
        : 0;

  return {
    complianceMatch: missingRequirements.length === 0,
    missingRequirements,
    readinessScore,
  };
}

function resolveRiskLevel(readinessScore: number, missingRequirements: string[], deadline: string | null): TenderRiskLevel {
  let riskScore = 0;

  if (readinessScore < 80) {
    riskScore += 25;
  }
  if (readinessScore < 60) {
    riskScore += 25;
  }
  if (missingRequirements.length > 0) {
    riskScore += Math.min(30, missingRequirements.length * 10);
  }

  if (deadline) {
    const parsed = new Date(deadline);
    const millis = parsed.getTime();
    if (Number.isFinite(millis)) {
      const daysUntilDeadline = Math.ceil((millis - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysUntilDeadline <= 7) {
        riskScore += 15;
      }
      if (daysUntilDeadline <= 3) {
        riskScore += 15;
      }
    }
  }

  if (riskScore >= 80) {
    return "CRITICAL";
  }
  if (riskScore >= 60) {
    return "HIGH";
  }
  if (riskScore >= 30) {
    return "MEDIUM";
  }
  return "LOW";
}

export async function analyzeTenderDocument(input: TenderAnalysisInput): Promise<TenderAnalysisResult> {
  const normalizedPath = input.documentPath.trim().replace(/^\/+/, "");
  if (!input.contractorId.trim()) {
    throw new Error("Missing contractorId");
  }
  if (!normalizedPath) {
    throw new Error("Missing documentPath");
  }

  const tenderId = inferTenderId(normalizedPath);
  const normalizedDocumentType = normalizeTenderDocumentType(input.documentType);
  const text = await extractPdfText(normalizedPath);
  const extracted = await extractStructuredTenderData(text, normalizedDocumentType);
  const requiredCertificates = normalizeRequiredCertificates(extracted.requiredCertificates);
  const compliance = await buildComplianceMatch(input.contractorId, requiredCertificates);
  const aiAnalyzedAt = new Date().toISOString();
  const analysis: TenderAnalysisRecord = {
    issuingAuthority: extracted.issuingAuthority,
    tenderNumber: extracted.tenderNumber,
    deadline: extracted.submissionDeadline,
    scope: extracted.scopeOfWork,
    requiredCertificates,
    estimatedValue: extracted.estimatedValue,
    location: extracted.location,
    aiAnalyzedAt,
  };
  const riskLevel = resolveRiskLevel(
    compliance.readinessScore,
    compliance.missingRequirements,
    analysis.deadline
  );

  const payload: TenderAnalysisResult = {
    tenderId,
    documentType: normalizedDocumentType,
    analysis,
    complianceMatch: compliance.complianceMatch,
    missingRequirements: compliance.missingRequirements,
    readinessScore: compliance.readinessScore,
    riskLevel,
  };

  const db = getFirebaseAdmin();
  await db.collection("tenders").doc(tenderId).set(
    {
      contractorId: input.contractorId,
      documentPath: normalizedPath,
      documentType: normalizedDocumentType,
      analysis,
      complianceMatch: payload.complianceMatch,
      missingRequirements: payload.missingRequirements,
      readinessScore: payload.readinessScore,
      riskLevel: payload.riskLevel,
      updatedAt: aiAnalyzedAt,
    },
    { merge: true }
  );

  await db.collection("deals").doc(tenderId).set(
    {
      tenderAnalysis: analysis,
      complianceMatch: payload.complianceMatch,
      missingRequirements: payload.missingRequirements,
      readinessScore: payload.readinessScore,
      estimatedDealValue: analysis.estimatedValue,
      riskLevel: payload.riskLevel,
      tenderLockStatus:
        payload.readinessScore >= 80
          ? "READY"
          : payload.readinessScore >= 60
            ? "RISK"
            : "BLOCKED",
      isTenderLocked: payload.readinessScore < 80,
      readinessUpdatedAt: aiAnalyzedAt,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return payload;
}
