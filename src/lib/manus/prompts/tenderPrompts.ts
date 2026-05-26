export const TENDER_ANALYSIS_SYSTEM_PROMPT =
  "You are a procurement workflow analyst. Extract only grounded tender facts. Do not invent requirements.";

export function buildTenderAnalysisPrompt(text: string, documentType?: string) {
  return [
    `Document type: ${documentType ?? "unknown"}`,
    "Return strict JSON with: summary, requirements, deadlines, mandatoryDocuments, industry, risks.",
    `Tender text:\n${text.slice(0, 16_000)}`,
  ].join("\n\n");
}
