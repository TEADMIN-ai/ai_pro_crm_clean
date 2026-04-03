import OpenAI from "openai";

type FixableDocument = {
  type?: unknown;
  documentType?: unknown;
  status?: unknown;
  reviewReason?: unknown;
  validationError?: unknown;
  fileName?: unknown;
};

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function generateFixSuggestion(doc: FixableDocument) {
  try {
    const client = getClient();
    if (!client) {
      return "Unable to generate suggestion";
    }

    const documentType = asString(doc.type) || asString(doc.documentType) || "Unknown document";
    const status = asString(doc.status) || "rejected";
    const rejectionContext = asString(doc.reviewReason) || asString(doc.validationError) || "No rejection reason provided.";
    const fileName = asString(doc.fileName);

    const prompt = `
A contractor uploaded a document that was rejected.

Document Type: ${documentType}
File Name: ${fileName || "Unknown"}
Status: ${status}
Rejection Context: ${rejectionContext}

Give:
1. Likely reason for rejection
2. Clear instruction on how to fix it

Keep it short and professional.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return res.choices[0]?.message?.content ?? "Unable to generate suggestion";
  } catch (err) {
    console.error("AI ERROR:", err);
    return "Unable to generate suggestion";
  }
}
