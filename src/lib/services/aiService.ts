import OpenAI from "openai";

type AIAnalysisResult = {
  finalStatus: "PASS" | "FAIL";
  suggestions: string[];
  extractedFields: {
    expiryDate: string;
    companyName: string;
    registrationNumber: string;
  };
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function extractJsonBlock(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return content.trim();
}

function normalizeResult(value: unknown): AIAnalysisResult {
  if (!value || typeof value !== "object") {
    return {
      finalStatus: "FAIL",
      suggestions: ["AI parsing failed"],
      extractedFields: {
        expiryDate: "",
        companyName: "",
        registrationNumber: "",
      },
    };
  }

  const raw = value as Record<string, unknown>;
  const extractedFields =
    raw.extractedFields && typeof raw.extractedFields === "object"
      ? (raw.extractedFields as Record<string, unknown>)
      : {};

  return {
    finalStatus: raw.finalStatus === "PASS" ? "PASS" : "FAIL",
    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    extractedFields: {
      expiryDate: typeof extractedFields.expiryDate === "string" ? extractedFields.expiryDate.trim() : "",
      companyName: typeof extractedFields.companyName === "string" ? extractedFields.companyName.trim() : "",
      registrationNumber:
        typeof extractedFields.registrationNumber === "string"
          ? extractedFields.registrationNumber.trim()
          : "",
    },
  };
}

export async function runAIAnalysis(text: string): Promise<AIAnalysisResult> {
  const prompt = `
Extract the following from this document:

1. Document type (BBBEE, CIPC, Tax, COIDA, Bank)
2. Expiry date (if present)
3. Company name
4. Registration number

Then determine:
- PASS if document is valid
- FAIL if missing or expired

Respond in JSON:
{
  "finalStatus": "PASS or FAIL",
  "suggestions": [],
  "extractedFields": {
    "expiryDate": "",
    "companyName": "",
    "registrationNumber": ""
  }
}

Document:
${text}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;

  try {
    return normalizeResult(JSON.parse(extractJsonBlock(content || "{}")));
  } catch {
    return {
      finalStatus: "FAIL",
      suggestions: ["AI parsing failed"],
      extractedFields: {
        expiryDate: "",
        companyName: "",
        registrationNumber: "",
      },
    };
  }
}
