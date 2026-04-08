import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuggestionDocument = {
  verified?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!user.role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        suggestions: [],
        note: "AI disabled (missing API key)",
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("AI suggestion failed:", err);

    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}
