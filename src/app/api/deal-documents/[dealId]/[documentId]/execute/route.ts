import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getStorage } from "firebase-admin/storage";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getDealById } from "@/server/services/dealService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DealDocumentAnalysis = {
  issuingAuthority: string | null;
  submissionDeadline: string | null;
  requiredCertificates: string[];
  estimatedDealValue: number | null;
  projectScope: string | null;
};

const DEFAULT_MODEL =
  process.env.OPENAI_TENDER_MODEL || process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStoragePath(pathValue: string): string | null {
  const trimmed = pathValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice("gs://".length);
    const slashIndex = withoutScheme.indexOf("/");
    const resolved = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
    return resolved.trim() || null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.includes("/o/")) {
        return null;
      }

      const encodedPath = parsed.pathname.split("/o/")[1] ?? "";
      const decoded = decodeURIComponent(encodedPath);
      return decoded.trim() || null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\/+/, "");
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function normalizeRequiredCertificates(values: string[]): string[] {
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const token = value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
      if (token.includes("coida") || token.includes("compensation fund")) return "COIDA";
      if (token.includes("bbbee") || token.includes("b bee") || token.includes("bee level")) return "BBBEE";
      if (token.includes("tax")) return "Tax Clearance";
      if (token.includes("bank")) return "Bank Confirmation";
      if (token.includes("cipc") || token.includes("registration")) return "CIPC";
      return value;
    });

  return Array.from(new Set(normalized));
}

function fallbackAnalysis(text: string): DealDocumentAnalysis {
  const issuingAuthority =
    text.match(/(?:issued by|issuing authority|department|municipality)[:\s-]+([^\n]+)/i)?.[1]?.trim() ?? null;
  const submissionDeadline =
    text.match(/(?:submission deadline|closing date|closing time|deadline)[:\s-]+([^\n]+)/i)?.[1]?.trim() ?? null;
  const estimatedDealValueMatch =
    text.match(/(?:estimated value|contract value|tender value|budget)[:\s-]*R?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1] ??
    null;
  const estimatedDealValue = estimatedDealValueMatch
    ? Number(estimatedDealValueMatch.replace(/,/g, ""))
    : null;
  const projectScope =
    text.match(/(?:scope of work|project scope|services required|work description)[:\s-]+([^\n]+)/i)?.[1]?.trim() ??
    null;

  const requiredCertificates = normalizeRequiredCertificates([
    ...(text.match(/coida/gi) ?? []).map(() => "COIDA"),
    ...(text.match(/b[\s-]?bbbee/gi) ?? []).map(() => "BBBEE"),
    ...(text.match(/tax (?:clearance|compliance)/gi) ?? []).map(() => "Tax Clearance"),
    ...(text.match(/bank (?:confirmation|letter)/gi) ?? []).map(() => "Bank Confirmation"),
    ...(text.match(/cipc/gi) ?? []).map(() => "CIPC"),
  ]);

  return {
    issuingAuthority,
    submissionDeadline,
    requiredCertificates,
    estimatedDealValue:
      typeof estimatedDealValue === "number" && Number.isFinite(estimatedDealValue)
        ? estimatedDealValue
        : null,
    projectScope,
  };
}

async function extractStructuredAnalysis(text: string): Promise<DealDocumentAnalysis> {
  const client = getOpenAIClient();
  if (!client || !text.trim()) {
    return fallbackAnalysis(text);
  }

  try {
    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "deal_document_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              issuingAuthority: { type: ["string", "null"] },
              submissionDeadline: { type: ["string", "null"] },
              requiredCertificates: {
                type: "array",
                items: { type: "string" },
              },
              estimatedDealValue: { type: ["number", "null"] },
              projectScope: { type: ["string", "null"] },
            },
            required: [
              "issuingAuthority",
              "submissionDeadline",
              "requiredCertificates",
              "estimatedDealValue",
              "projectScope",
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
                "Extract structured tender information from the provided deal document. " +
                "Return only the requested JSON. Normalize certificate names where possible.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract the following fields from this deal document:\n" +
                "- issuingAuthority\n" +
                "- submissionDeadline\n" +
                "- requiredCertificates\n" +
                "- estimatedDealValue\n" +
                "- projectScope\n\n" +
                `Document text:\n${text.slice(0, 18000)}`,
            },
          ],
        },
      ],
    });

    if (!response.output_text) {
      return fallbackAnalysis(text);
    }

    const parsed = JSON.parse(response.output_text) as Partial<DealDocumentAnalysis>;
    return {
      issuingAuthority: typeof parsed.issuingAuthority === "string" ? parsed.issuingAuthority.trim() || null : null,
      submissionDeadline:
        typeof parsed.submissionDeadline === "string" ? parsed.submissionDeadline.trim() || null : null,
      requiredCertificates: normalizeRequiredCertificates(
        Array.isArray(parsed.requiredCertificates)
          ? parsed.requiredCertificates.filter((value): value is string => typeof value === "string")
          : []
      ),
      estimatedDealValue:
        typeof parsed.estimatedDealValue === "number" && Number.isFinite(parsed.estimatedDealValue)
          ? parsed.estimatedDealValue
          : null,
      projectScope: typeof parsed.projectScope === "string" ? parsed.projectScope.trim() || null : null,
    };
  } catch {
    return fallbackAnalysis(text);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string; documentId: string }> }
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId, documentId } = await context.params;

    if (!dealId || !documentId) {
      return jsonError("Missing dealId or documentId", 400);
    }

    const deal = await getDealById(dealId);
    if (!deal) {
      return jsonError("Deal not found", 404);
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    const documentSnapshot = await getFirebaseAdmin()
      .collection("deals")
      .doc(dealId)
      .collection("documents")
      .doc(documentId)
      .get();

    if (!documentSnapshot.exists) {
      return jsonError("Document not found", 404);
    }

    const metadata = (documentSnapshot.data() ?? {}) as Record<string, unknown>;
    const storagePathSource =
      asString(metadata.storagePath) ??
      asString(metadata.filePath) ??
      asString(metadata.downloadURL) ??
      asString(metadata.downloadUrl) ??
      asString(metadata.url);
    const storagePath = storagePathSource ? normalizeStoragePath(storagePathSource) : null;

    if (!storagePath) {
      return jsonError("Document is missing storagePath", 500);
    }

    const bucket = getStorage().bucket();
    const [buffer] = await bucket.file(storagePath).download();
    const text = await extractTextFromPdf(Buffer.from(buffer));

    const analysis = await extractStructuredAnalysis(text);
    const analyzedAt = new Date().toISOString();

    await getFirebaseAdmin()
      .collection("deals")
      .doc(dealId)
      .collection("analysis")
      .doc(documentId)
      .set(
        {
          dealId,
          documentId,
          source: {
            name:
              asString(metadata.name) ??
              asString(metadata.fileName) ??
              asString(metadata.filename) ??
              documentId,
            storagePath,
          },
          analysis,
          extractedTextLength: text.length,
          analyzedAt,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json(
      {
        success: true,
        dealId,
        documentId,
        analysis,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Deal document execution failed:", error);
    return jsonError("Failed to execute deal document analysis", 500);
  }
}
