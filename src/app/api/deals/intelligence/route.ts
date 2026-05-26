import OpenAI from "openai";

export const runtime = "nodejs";

type DealIntelligenceRequest = {
  readinessScore?: unknown;
  status?: unknown;
  missingDocs?: unknown;
};

type DealIntelligenceResponse = {
  status: string;
  reason: string;
  priorityFixes: string[];
};

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "UNKNOWN";
}

function normalizeReadinessScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function normalizeMissingDocs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 10);
}

function buildFallbackResponse(input: {
  status: string;
  readinessScore: number;
  missingDocs: string[];
}): DealIntelligenceResponse {
  if (input.status === "UNKNOWN") {
    return {
      status: input.status,
      reason: "No status available",
      priorityFixes: [],
    };
  }

  if (input.missingDocs.length > 0) {
    return {
      status: input.status,
      reason: `Missing: ${input.missingDocs.join(", ")}`,
      priorityFixes: input.missingDocs.slice(0, 3).map((doc) => `Upload ${doc}`),
    };
  }

  if (input.status === "BLOCKED") {
    return {
      status: input.status,
      reason: `Deal is blocked at ${input.readinessScore}% readiness.`,
      priorityFixes: ["Review compliance gaps", "Upload missing tender documents"],
    };
  }

  if (input.status === "RISK") {
    return {
      status: input.status,
      reason: `Deal is at risk at ${input.readinessScore}% readiness.`,
      priorityFixes: ["Verify remaining compliance items", "Resolve outstanding review issues"],
    };
  }

  return {
    status: input.status,
    reason: "No major issues detected",
    priorityFixes: [],
  };
}

function sanitizeModelResponse(
  parsed: unknown,
  fallback: DealIntelligenceResponse,
): DealIntelligenceResponse {
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  const source = parsed as Record<string, unknown>;
  const reason =
    typeof source.reason === "string" && source.reason.trim().length > 0
      ? source.reason.trim()
      : fallback.reason;
  const priorityFixes = Array.isArray(source.priorityFixes)
    ? source.priorityFixes
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 5)
    : fallback.priorityFixes;

  return {
    status: fallback.status,
    reason,
    priorityFixes,
  };
}

export async function POST(req: Request) {
  let normalizedStatus = "UNKNOWN";
  let normalizedReadinessScore = 0;
  let normalizedMissingDocs: string[] = [];

  try {
    const body = (await req.json()) as DealIntelligenceRequest;
    normalizedStatus = normalizeStatus(body.status);
    normalizedReadinessScore = normalizeReadinessScore(body.readinessScore);
    normalizedMissingDocs = normalizeMissingDocs(body.missingDocs);

    const fallback = buildFallbackResponse({
      status: normalizedStatus,
      readinessScore: normalizedReadinessScore,
      missingDocs: normalizedMissingDocs,
    });

    if (normalizedStatus === "UNKNOWN") {
      return Response.json(fallback);
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return Response.json(fallback);
    }

    const prompt = `
You are a procurement compliance assistant.

Analyze the deal:

Status: ${normalizedStatus}
Readiness Score: ${normalizedReadinessScore}
Missing Documents: ${normalizedMissingDocs.join(", ") || "None"}

Return STRICT JSON:
{
  "reason": "...",
  "priorityFixes": ["...", "..."]
}

Rules:
- Be short and precise
- Prioritize the most critical missing items first
- Do not include explanations outside JSON
- Do not invent documents that were not provided
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.3",
      messages: [
        {
          role: "system",
          content: "You are a procurement AI. Always return valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content || "";

    console.log("🧠 RAW AI RESPONSE:", raw);

    let parsed: unknown;

    try {
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}") + 1;
      const jsonString = raw.slice(jsonStart, jsonEnd);

      parsed = JSON.parse(jsonString);
    } catch {
      console.error("JSON PARSE FAILED:", raw);
      parsed = null;
    }

    return Response.json(sanitizeModelResponse(parsed, fallback));
  } catch (error) {
    console.error("Intelligence API error:", error);

    return Response.json(
      buildFallbackResponse({
        status: normalizedStatus,
        readinessScore: normalizedReadinessScore,
        missingDocs: normalizedMissingDocs,
      }),
    );
  }
}
