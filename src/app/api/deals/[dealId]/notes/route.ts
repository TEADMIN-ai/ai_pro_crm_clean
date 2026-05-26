import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getDealById } from "@/server/services/dealService";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveAuthorizedDeal(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  const actor = await requireAuthorizedUser(request);
  const { dealId } = await context.params;

  if (!dealId) {
    throw new Error("Missing dealId");
  }

  const deal = await getDealById(dealId);

  if (!deal) {
    throw new Error("Deal not found");
  }

  if (deal.contractorId) {
    assertCanAccessContractor(actor, deal.contractorId);
  }

  return { actor, dealId };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const db = getFirebaseAdmin();
    const { dealId } = await resolveAuthorizedDeal(request, context);
    const snapshot = await db.collection("dealNotes").where("dealId", "==", dealId).get();

    const notes = snapshot.docs
      .map((doc): Record<string, unknown> & { id: string } => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      }))
      .sort((left, right) => {
        const leftCreatedAt = typeof left.createdAt === "number" ? left.createdAt : 0;
        const rightCreatedAt = typeof right.createdAt === "number" ? right.createdAt : 0;
        return rightCreatedAt - leftCreatedAt;
      });

    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch notes";
    const status = message === "Missing dealId" ? 400 : message === "Deal not found" ? 404 : 500;
    if (status === 500) {
      console.error("DEAL NOTES FETCH ERROR:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const db = getFirebaseAdmin();
    const { actor, dealId } = await resolveAuthorizedDeal(request, context);
    assertPrivilegedRole(actor);

    const body = (await request.json()) as Record<string, unknown>;
    const note = getString(body.note);

    if (!note) {
      return NextResponse.json({ error: "Note required" }, { status: 400 });
    }

    const noteRef = await db.collection("dealNotes").add({
      dealId,
      note,
      createdBy: actor.uid,
      role: actor.role,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, id: noteRef.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to save note";
    const status = message === "Missing dealId" ? 400 : message === "Deal not found" ? 404 : 500;
    if (status === 500) {
      console.error("DEAL NOTES ERROR:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
