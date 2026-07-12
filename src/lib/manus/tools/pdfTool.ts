import type { SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { buildTenderAnalysisPrompt, TENDER_ANALYSIS_SYSTEM_PROMPT } from "@/lib/manus/prompts/tenderPrompts";
import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { OpenAITool } from "@/lib/manus/tools/openaiTool";
import { assertToolAccess } from "@/lib/manus/utils/permissionGuard";

type PdfToolInput =
  | { mode: "extractText"; buffer: Buffer }
  | { mode: "extractMetadata"; text: string; documentType?: string }
  | {
      mode: "empirePdfPreview";
      templateKey: SbdFormKey;
      profile: Record<string, unknown>;
    };

function safeParseJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inferIndustry(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("construction")) return "construction";
  if (normalized.includes("cleaning")) return "facilities";
  if (normalized.includes("security")) return "security";
  if (normalized.includes("transport")) return "logistics";
  return "general";
}

export class PdfTool extends BaseTool<PdfToolInput, Record<string, unknown>> {
  readonly name = "pdfTool";

  validate(input: PdfToolInput, _context: ManusContext) {
    if (input.mode === "extractText" && input.buffer.length === 0) {
      throw new Error("PDF buffer is empty");
    }

    if (input.mode === "extractMetadata" && !input.text.trim()) {
      throw new Error("PDF text is required");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  async execute(input: PdfToolInput, context: ManusContext): Promise<ToolExecutionResult<Record<string, unknown>>> {
    this.validate(input, context);
    this.permissions(context);

    if (input.mode === "extractText") {
      const { extractTextFromPdf } = await import("@/lib/pdf/extractTextFromPdf");
      const text = await extractTextFromPdf(input.buffer);
      return {
        ok: true,
        toolName: this.name,
        data: {
          text,
          textLength: text.length,
          extractionMethod: "pdf-parse",
          ocrFallbackAvailable: true,
        },
        warnings: [],
        audit: { mode: input.mode },
      };
    }

    if (input.mode === "empirePdfPreview") {
      const { fillTenderPack } = await import("@/lib/pdfs/empirePdfFill");
      const result = await fillTenderPack({
        templateKey: input.templateKey,
        profile: input.profile as never,
        outputMode: "preview",
      });

      if (result.ok) {
        return {
          ok: true,
          toolName: this.name,
          data: {
            fieldMapUsed: result.fieldMapUsed,
            warningCount: result.warnings.length,
            byteLength: result.filledPdfBuffer.length,
          },
          warnings: result.warnings,
          audit: { mode: input.mode, templateKey: input.templateKey },
        };
      }

      const errorResult = result as Extract<typeof result, { ok: false }>;

      return {
        ok: false,
        toolName: this.name,
        data: {
          error: errorResult.error,
          fieldMapUsed: errorResult.fieldMapUsed,
        },
        warnings: errorResult.warnings,
        audit: { mode: input.mode, templateKey: input.templateKey },
        error: errorResult.error,
      };
    }

    const openaiTool = new OpenAITool();
    const aiResult = await openaiTool.execute(
      {
        systemPrompt: TENDER_ANALYSIS_SYSTEM_PROMPT,
        prompt: buildTenderAnalysisPrompt(input.text, input.documentType),
      },
      context
    );

    const parsed = aiResult.data?.outputText ? safeParseJson(aiResult.data.outputText) : null;
    const requirements = Array.isArray(parsed?.requirements)
      ? parsed.requirements.filter((item): item is string => typeof item === "string")
      : [];
    const mandatoryDocuments = Array.isArray(parsed?.mandatoryDocuments)
      ? parsed.mandatoryDocuments.filter((item): item is string => typeof item === "string")
      : [];
    const deadlines = Array.isArray(parsed?.deadlines)
      ? parsed.deadlines.filter((item): item is string => typeof item === "string")
      : [];

    return {
      ok: true,
      toolName: this.name,
      data: {
        summary: typeof parsed?.summary === "string" ? parsed.summary : input.text.slice(0, 400),
        requirements,
        deadlines,
        mandatoryDocuments,
        industry: typeof parsed?.industry === "string" ? parsed.industry : inferIndustry(input.text),
        risks: Array.isArray(parsed?.risks) ? parsed.risks : [],
        metadata: {
          extractionMethod: "pdf-parse",
          ocrFallbackHook: true,
        },
      },
      warnings: aiResult.warnings,
      audit: { mode: input.mode },
    };
  }
}
