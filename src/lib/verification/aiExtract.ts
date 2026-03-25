import OpenAI from "openai";

export type AiRiskLevel = "low" | "medium" | "high" | "unknown";

export type AiExtractResult = {
  companyName?: string | null;
  registrationNumber?: string | null;
  documentType?: string | null;
  expiryDate?: string | null;
  riskLevel?: AiRiskLevel;
  issues?: string[];
  error?: string;
};

let client: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}

function normalizeRiskLevel(value: unknown): AiRiskLevel {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "low" || normalized === "medium" || normalized === "high" ? normalized : "unknown";
}

function sanitizeAiResult(value: unknown): AiExtractResult {
  if (!value || typeof value !== "object") {
    return { error: "AI parsing failed", riskLevel: "unknown", issues: [] };
  }

  const raw = value as Record<string, unknown>;

  return {
    companyName: typeof raw.companyName === "string" ? raw.companyName.trim() || null : null,
    registrationNumber:
      typeof raw.registrationNumber === "string" ? raw.registrationNumber.trim() || null : null,
    documentType: typeof raw.documentType === "string" ? raw.documentType.trim() || null : null,
    expiryDate: typeof raw.expiryDate === "string" ? raw.expiryDate.trim() || null : null,
    riskLevel: normalizeRiskLevel(raw.riskLevel),
    issues: Array.isArray(raw.issues)
      ? raw.issues.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    error: typeof raw.error === "string" ? raw.error : undefined,
  };
}

function extractJsonBlock(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return content.trim();
}

export async function aiExtractDocument(text: string): Promise<AiExtractResult> {
  if (!text.trim()) {
    return {
      riskLevel: "unknown",
      issues: ["No extracted text available for AI analysis"],
      error: "No extracted text available",
    };
  }

  const openai = getClient();

  if (!openai) {
    return {
      riskLevel: "unknown",
      issues: ["AI analysis unavailable"],
      error: "OPENAI_API_KEY is not configured",
    };
  }

  const prompt = `
You are a tender compliance expert.

Extract the following from this document:
- companyName
- registrationNumber
- documentType
- expiryDate (if any)
- riskLevel (low, medium, high)
- issues (array of problems)

Return JSON only.

Document:
${text}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.3",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      return {
        riskLevel: "unknown",
        issues: ["AI returned an empty response"],
        error: "AI parsing failed",
      };
    }

    return sanitizeAiResult(JSON.parse(extractJsonBlock(content)));
  } catch (error) {
    console.error("AI document extraction failed", error);

    return {
      riskLevel: "unknown",
      issues: ["AI analysis failed"],
      error: "AI parsing failed",
    };
  }
}
