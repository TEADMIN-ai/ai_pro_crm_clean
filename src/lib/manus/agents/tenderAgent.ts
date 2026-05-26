import { BaseAgent } from "@/lib/manus/agents/baseAgent";
import { PdfTool } from "@/lib/manus/tools/pdfTool";
import type { StandardAgentOutput } from "@/lib/manus/types/agentOutputs";
import type { AgentExecutionPayload, AgentExecutionResult } from "@/lib/manus/types/manus.types";

function pickDocumentRequirements(text: string): string[] {
  const normalized = text.toLowerCase();
  const candidates = [
    { token: "tax", label: "taxClearance" },
    { token: "bbbee", label: "bbbee" },
    { token: "coida", label: "coida" },
    { token: "cipc", label: "cipc" },
    { token: "bank", label: "bankConfirmation" },
  ];

  return candidates.filter((item) => normalized.includes(item.token)).map((item) => item.label);
}

export class TenderAgent extends BaseAgent<Record<string, unknown>> {
  readonly role = "tender_analyst" as const;

  async execute(payload: AgentExecutionPayload): Promise<AgentExecutionResult<Record<string, unknown>, StandardAgentOutput>> {
    await this.validate(payload);

    const buffer = payload.input.documentBuffer;
    if (!(buffer instanceof Buffer)) {
      throw new Error("TenderAgent requires documentBuffer");
    }

    const pdfTool = new PdfTool();
    const extracted = await pdfTool.execute({ mode: "extractText", buffer }, payload.context);
    const text = typeof extracted.data?.text === "string" ? extracted.data.text : "";
    const metadata = await pdfTool.execute(
      {
        mode: "extractMetadata",
        text,
        documentType: typeof payload.input.documentType === "string" ? payload.input.documentType : undefined,
      },
      payload.context
    );

    const requirements =
      Array.isArray(metadata.data?.requirements) && metadata.data.requirements.length > 0
        ? (metadata.data.requirements as string[])
        : pickDocumentRequirements(text);
    const structuredData = {
      extractedText: text,
      requirements,
      deadlines: metadata.data?.deadlines ?? [],
      mandatoryDocuments: metadata.data?.mandatoryDocuments ?? requirements,
      industry: metadata.data?.industry ?? "general",
      risks: metadata.data?.risks ?? [],
    };
    const output: StandardAgentOutput = {
      status: "success",
      confidence: text.length > 0 ? 0.82 : 0.35,
      nextActions: ["Run compliance validation against contractor documents"],
      warnings: [...extracted.warnings, ...metadata.warnings],
      structuredData,
      auditPayload: {
        extractedTextLength: text.length,
        requirementCount: requirements.length,
      },
    };

    return {
      agentRole: this.role,
      ok: true,
      summary: typeof metadata.data?.summary === "string" ? metadata.data.summary : "Tender analyzed",
      nextAction: output.nextActions[0],
      warnings: output.warnings,
      data: structuredData,
      output,
    };
  }
}
