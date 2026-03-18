/**
 * AI Document Extraction Pipeline
 * --------------------------------
 *
 * PURPOSE:
 * Extract structured compliance data from contractor documents stored in Firebase Storage.
 *
 * This module performs:
 *
 * 1. Secure download from Firebase Storage (Admin SDK)
 * 2. Text extraction:
 *    - Direct UTF-8 decode for text-based files
 *    - OpenAI OCR for binary files (PDF, JPG, PNG, etc.)
 *
 * 3. Expiry detection using:
 *    - Regex fallback (fast, deterministic)
 *    - OpenAI structured extraction (more accurate)
 *
 * OUTPUT:
 * Returns ExtractedDocumentData object containing:
 *   - text: extracted document text
 *   - expiresAt: timestamp in milliseconds (number | null)
 *   - mimeType: optional detected mime type
 *
 * DESIGN PRINCIPLES:
 *
 * FAIL-SAFE:
 *   OpenAI failures NEVER break document upload pipeline.
 *
 * TYPE-SAFE:
 *   Expiry is always returned as timestamp number, never Date object.
 *
 * STORAGE-SAFE:
 *   Original file always remains source of truth.
 *
 * PRODUCTION-SAFE:
 *   Missing OPENAI_API_KEY does not cause system failure.
 *
 * ARCHITECTURE ROLE:
 *   Firebase Storage  extractDocumentData  classifyDocument  Firestore metadata update
 *
 */
import OpenAI from "openai";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { runOCR } from "@/server/services/ocrService";

/**
 * ExtractedDocumentData
 *
 * Represents normalized AI extraction result.
 *
 * expiresAt MUST be number timestamp (ms since epoch), not Date.
 * This ensures compatibility with:
 *
 * - Firestore numeric indexing
 * - expiration comparisons
 * - client rendering
 * - JSON serialization
 *
 */
export type ExtractedDocumentData = {
  text: string;
  mimeType?: string;
};

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

function getConfiguredBucketName(): string | undefined {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName && bucketName.trim().length > 0 ? bucketName.trim() : undefined;
}

function initFirebaseAdminForStorage(): void {
  if (getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = getConfiguredBucketName();

  if (projectId && clientEmail && privateKeyRaw) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
      }),
      ...(storageBucket ? { storageBucket } : {}),
    });
    return;
  }

  initializeApp(storageBucket ? { storageBucket } : undefined);
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function selectBucket() {
  const bucketName = getConfiguredBucketName();
  return bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
}

function isLikelyPlainText(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 5000);
  if (sample.length < 40) return false;

  let printable = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      printable += 1;
    }
  }

  return printable / sample.length > 0.85;
}

function parseDateToTimestamp(value: string): number | null {
  const normalized = value.replace(/[.]/g, "/");

  const isoMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  const usMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  return null;
}

function extractExpiryFallbackFromText(text: string): number | null {
  if (!text.trim()) {
    return null;
  }

  const matches = text.match(
    /\b(?:\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})\b/g
  );
  if (!matches) {
    return null;
  }

  let latest: number | null = null;
  for (const match of matches) {
    const ts = parseDateToTimestamp(match);
    if (ts && (!latest || ts > latest)) {
      latest = ts;
    }
  }

  return latest;
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

async function extractTextWithOpenAI(args: {
  bytes: Uint8Array;
  filename: string;
  mimeType?: string;
}): Promise<string> {
  return runOCR(Buffer.from(args.bytes), {
    filename: args.filename,
    mimeType: args.mimeType,
  });
}

async function extractExpiryWithOpenAI(args: {
  client: OpenAI;
  text: string;
  fileName?: string;
  docType?: string | null;
}): Promise<number | null> {
  const trimmed = args.text.trim();
  if (!trimmed) {
    return null;
  }

  const response = await args.client.responses.create({
    model: DEFAULT_OPENAI_MODEL,
    text: {
      format: {
        type: "json_schema",
        name: "document_expiry",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            expiresAt: {
              type: ["number", "null"],
            },
          },
          required: ["expiresAt"],
        },
      },
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "Return the document expiry date as unix timestamp milliseconds, or null if no expiry date exists.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `File name: ${args.fileName ?? "unknown"}\n` +
              `Document type: ${args.docType ?? "unknown"}\n\n` +
              `Document text:\n${trimmed.slice(0, 12000)}`,
          },
        ],
      },
    ],
  });

  if (!response.output_text) {
    return null;
  }

  try {
    const parsed = JSON.parse(response.output_text) as { expiresAt?: unknown };
    return normalizeTimestamp(parsed.expiresAt);
  } catch {
    return null;
  }
}

/**
 * extractDocumentData
 *
 * Downloads document from Firebase Storage and extracts readable text.
 *
 * FLOW:
 * 1. Download file buffer
 * 2. Attempt UTF-8 decode
 * 3. If decode fails  use OpenAI OCR fallback
 *
 * RETURNS:
 * ExtractedDocumentData
 *
 * SAFETY:
 * Never throws due to AI failure.
 * Always returns safe fallback result.
 *
 */
export async function extractDocumentData(args: {
  storagePath: string;
  filename?: string;
}): Promise<ExtractedDocumentData> {
  if (!args.storagePath || !args.storagePath.trim()) {
    return { text: "" };
  }

  try {
    initFirebaseAdminForStorage();
  } catch (initError) {
    console.error("Firebase admin storage initialization failed", {
      storagePath: args.storagePath,
      initError,
    });
    return { text: "" };
  }

  try {
    const bucket = selectBucket();
    const file = bucket.file(args.storagePath.trim());

    const [metadataResult, fileResult] = await Promise.allSettled([file.getMetadata(), file.download()]);

    const mimeType =
      metadataResult.status === "fulfilled" &&
      typeof metadataResult.value?.[0]?.contentType === "string" &&
      metadataResult.value[0].contentType.trim().length > 0
        ? metadataResult.value[0].contentType.trim()
        : undefined;

    if (fileResult.status !== "fulfilled") {
      console.error("Storage file download failed", {
        storagePath: args.storagePath,
        error: fileResult.reason,
      });
      return { text: "", mimeType };
    }

    const fileBuffer = Buffer.from(fileResult.value[0] as Uint8Array);
    const bytes = new Uint8Array(fileBuffer);

    const utf8Text = fileBuffer.toString("utf8").trim();
    if (isLikelyPlainText(utf8Text)) {
      return { text: utf8Text, mimeType };
    }

    if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
      return { text: "", mimeType };
    }

    const client = getOpenAIClient();
    if (!client) {
      return { text: "", mimeType };
    }

    try {
      const text = await extractTextWithOpenAI({
        bytes,
        filename: args.filename?.trim() || "document",
        mimeType,
      });
      return { text, mimeType };
    } catch (openAiError) {
      console.error("OpenAI text extraction failed", {
        storagePath: args.storagePath,
        openAiError,
      });
      return { text: "", mimeType };
    }
  } catch (storageError) {
    console.error("Document extraction failed", {
      storagePath: args.storagePath,
      storageError,
    });
    return { text: "" };
  }
}

/**
 * extractExpiryFromDocumentText
 *
 * Extracts expiry date from document text.
 *
 * STRATEGY:
 *
 * 1. Fast regex detection (primary method)
 * 2. OpenAI structured extraction (fallback)
 *
 * RETURNS:
 *
 * number timestamp (ms) or null
 *
 * NEVER RETURNS Date object.
 *
 * This ensures Firestore and client compatibility.
 *
 */
export async function extractExpiryFromDocumentText(args: {
  text: string;
  fileName?: string;
  docType?: string | null;
}): Promise<number | null> {
  const fallback = extractExpiryFallbackFromText(args.text || "");
  if (fallback !== null) {
    return fallback;
  }

  const client = getOpenAIClient();
  if (!client || !args.text || !args.text.trim()) {
    return null;
  }

  try {
    return await extractExpiryWithOpenAI({
      client,
      text: args.text,
      fileName: args.fileName,
      docType: args.docType,
    });
  } catch (openAiError) {
    console.error("OpenAI expiry extraction failed", {
      fileName: args.fileName,
      docType: args.docType,
      openAiError,
    });
    return null;
  }
}
