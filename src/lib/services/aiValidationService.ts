import OpenAI from "openai";

export type AiValidationResult = {
  status: "valid" | "warning" | "invalid";
  issues: string[];
  suggestion: string;
};

let client: OpenAI | null = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

function extractJsonBlock(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return content.trim();
}

function sanitizeValidationResult(value: unknown): AiValidationResult {
  if (!value || typeof value !== "object") {
    return {
      status: "warning",
      issues: ["Validation failed"],
      suggestion: "Manual review required",
    };
  }

  const raw = value as Record<string, unknown>;
  const status =
    raw.status === "valid" || raw.status === "warning" || raw.status === "invalid"
      ? raw.status
      : "warning";

  return {
    status,
    issues: Array.isArray(raw.issues)
      ? raw.issues.filter((issue): issue is string => typeof issue === "string" && issue.trim().length > 0)
      : [],
    suggestion:
      typeof raw.suggestion === "string" && raw.suggestion.trim().length > 0
        ? raw.suggestion.trim()
        : "Manual review required",
  };
}

export async function validateDocument(text: string, type: string): Promise<AiValidationResult> {
  try {
    const openai = getClient();
    if (!openai) {
      return {
        status: "warning",
        issues: ["Validation unavailable"],
        suggestion: "Manual review required",
      };
    }

    const prompt = `
You are validating a contractor compliance document.

Document Type: ${type}

Text:
${text.slice(0, 3000)}

Check:
1. Is it valid?
2. Any issues?
3. Expiry problems?
4. Missing information?

Return JSON:
{
  "status": "valid | warning | invalid",
  "issues": ["..."],
  "suggestion": "..."
}
`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const content = res.choices[0]?.message?.content || "{}";
    return sanitizeValidationResult(JSON.parse(extractJsonBlock(content)));
  } catch (err) {
    console.error("AI VALIDATION ERROR:", err);
    return {
      status: "warning",
      issues: ["Validation failed"],
      suggestion: "Manual review required",
    };
  }
}
