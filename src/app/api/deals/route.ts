export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { generateAIInsights } from "@/lib/ai/generateInsights";
import { calculateReadiness } from "@/lib/engine/readinessEngine";
import { generateFixSuggestions } from "@/lib/engine/fixSuggestions";
import { analyzeTenderText } from "@/lib/tenderAnalysisService";

const AI_INSIGHTS_TTL_MS = 1000 * 60 * 60 * 24;

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function arraysEqual(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    let snapshot;

    if (isPrivilegedRole(user.role)) {
      snapshot = await adminDb.collection("deals").get();
    } else if (user.role === "contractor" && user.contractorId) {
      snapshot = await adminDb
        .collection("deals")
        .where("contractorId", "==", user.contractorId)
        .get();
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deals = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const readiness = calculateReadiness(
          (data.contractorDocs as Record<string, boolean> | undefined) || {}
        );
        const suggestions = generateFixSuggestions({
          ...data,
          ...readiness,
        });
        const readinessChanged =
          data.readinessScore !== readiness.readinessScore ||
          data.riskLevel !== readiness.riskLevel ||
          !arraysEqual(data.missingDocs, readiness.missingDocs);
        const isStale =
          typeof data.aiInsightsUpdatedAt !== "number" ||
          Date.now() - data.aiInsightsUpdatedAt > AI_INSIGHTS_TTL_MS;

        let aiInsights =
          typeof data.aiInsights === "string" && data.aiInsights.trim().length > 0
            ? data.aiInsights
            : null;

        const shouldGenerateAI = !aiInsights || isStale || readinessChanged;

        if (shouldGenerateAI) {
          try {
            aiInsights = await generateAIInsights({
              ...data,
              ...readiness,
            });

            await adminDb.collection("deals").doc(doc.id).update({
              aiInsights,
              aiInsightsUpdatedAt: Date.now(),
              readinessScore: readiness.readinessScore,
              riskLevel: readiness.riskLevel,
              missingDocs: readiness.missingDocs,
            });
          } catch (err) {
            console.error("AI generation failed:", err);
            aiInsights = aiInsights || null;
          }
        } else if (readinessChanged) {
          await adminDb.collection("deals").doc(doc.id).update({
            readinessScore: readiness.readinessScore,
            riskLevel: readiness.riskLevel,
            missingDocs: readiness.missingDocs,
          });
        }

        // FUTURE: enforce readiness-based restrictions here
        // if (role === "contractor" && readiness.readinessScore < 60) {
        //   block action
        // }
        return {
          id: doc.id,
          ...data,
          ...readiness,
          suggestions,
          aiInsights: aiInsights || null,
        };
      })
    );

    return NextResponse.json({ deals }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("DEALS API ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);

    if (!isPrivilegedRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const contractorId = getString(body.contractorId);
    const title = getString(body.title);
    const tenderText = getString(body.tenderText);
    const value = getNumber(body.value);

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    if (!contractorId) {
      return NextResponse.json(
        { error: "Deal must be linked to a contractor" },
        { status: 400 }
      );
    }

    const contractorSnapshot = await adminDb.collection("contractors").doc(contractorId).get();

    if (!contractorSnapshot.exists) {
      return NextResponse.json(
        { error: "Invalid contractorId" },
        { status: 400 }
      );
    }

    const contractor = (contractorSnapshot.data() ?? {}) as Record<string, unknown>;
    const createdAt = new Date().toISOString();
    const newDeal = {
      contractorId,
      contractorName:
        getString(contractor.companyName) ||
        getString(contractor.company) ||
        getString(contractor.name) ||
        contractorId,
      title,
      name: title,
      status: "NEW",
      value,
      createdAt,
      updatedAt: createdAt,
      analysis: {
        requirements: {} as Record<string, boolean>,
        missing: [] as string[],
        score: 0,
        risk: "UNKNOWN",
      },
    };

    const docRef = await adminDb.collection("deals").add(newDeal);

    if (tenderText) {
      const analysis = analyzeTenderText(tenderText);

      await docRef.update({
        analysis,
      });

      newDeal.analysis = analysis;
    }

    return NextResponse.json(
      {
        id: docRef.id,
        ...newDeal,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(" DEAL CREATE ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to create deal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
