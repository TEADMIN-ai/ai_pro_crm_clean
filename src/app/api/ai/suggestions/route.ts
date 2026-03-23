import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type SuggestionDocument = {
  verified?: boolean;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await req.json()) as { documents?: SuggestionDocument[] };
    const documents = Array.isArray(body?.documents) ? body.documents : [];
    const issues = documents.filter((d) => d?.verified !== true);

    const prompt = `
You are a tender compliance expert.

Analyze the following documents and provide clear, professional fix suggestions.

Documents:
${JSON.stringify(issues, null, 2)}

Return concise, actionable advice for each item.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-5.3",
      messages: [{ role: "user", content: prompt }],
    });

    return NextResponse.json({
      suggestions: completion.choices[0]?.message?.content ?? "",
    });
  } catch (err) {
    console.error("AI suggestion failed:", err);

    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}
