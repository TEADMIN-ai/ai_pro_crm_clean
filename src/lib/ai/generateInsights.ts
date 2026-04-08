import OpenAI from "openai";

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export async function generateAIInsights(deal: any) {
  const openai = getOpenAIClient();

  if (!openai) {
    return null;
  }

  const prompt = `
You are a tender compliance expert.

A contractor has:
- Readiness Score: ${deal.readinessScore}
- Risk Level: ${deal.riskLevel}
- Missing Documents: ${deal.missingDocs.join(", ")}

Provide:
1. A short assessment
2. Risk explanation
3. Clear next steps
Keep it professional and concise.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}
