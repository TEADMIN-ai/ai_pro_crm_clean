import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

const ALLOWED_TEMPLATES = new Set(["SBD1", "SBD4", "SBD6", "SBD8", "SBD9"]);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ dealId: string }> }
) {
  try {
    const actor = await requireAuthorizedUser(req);
    if (actor.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { dealId } = await context.params;
    const payload = (await req.json()) as { template?: unknown; checked?: unknown } | null;
    const template = typeof payload?.template === "string" ? payload.template.trim().toUpperCase() : "";
    const checked = payload?.checked === true;

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    if (!ALLOWED_TEMPLATES.has(template)) {
      return NextResponse.json({ error: "Invalid template" }, { status: 400 });
    }

    const ref = adminDb.collection("deals").doc(dealId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const currentRaw = (snap.data()?.templateOverride ?? []) as unknown;
    const current = Array.isArray(currentRaw)
      ? currentRaw.filter((value): value is string => typeof value === "string" && ALLOWED_TEMPLATES.has(value))
      : [];

    const updated = checked
      ? [...new Set([...current, template])]
      : current.filter((value) => value !== template);

    await ref.update({
      templateOverride: updated,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true, templateOverride: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update template override:", error);
    return NextResponse.json({ error: "Failed to update template override" }, { status: 500 });
  }
}
