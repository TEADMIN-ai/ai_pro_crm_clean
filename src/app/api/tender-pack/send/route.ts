import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getCorporateFromAddress } from "@/lib/corporate/companyProfile";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { assertDealWorkspaceAccess, recordProcurementTransitionAudit } from "@/lib/procurement/procurementStateAuthority";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

if (!resendKey) {
  console.warn("Resend not configured; skipping email");
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);
    assertPrivilegedRole(user);

    const body = (await req.json()) as Record<string, unknown>;
    const email = asString(body.email);
    const dealId = asString(body.dealId);
    const tenderPackId = asString(body.tenderPackId) ?? asString(body.packId);

    if (!email || !dealId || !tenderPackId) {
      return NextResponse.json(
        { error: "Persisted dealId, tenderPackId and intended recipient are required" },
        { status: 400 },
      );
    }

    if (typeof body.pdfBase64 === "string" && body.pdfBase64.trim()) {
      return NextResponse.json(
        { error: "Client-supplied PDF content is not accepted for governed tender delivery" },
        { status: 409 },
      );
    }

    if (!resend) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
    }

    const db = getFirebaseAdmin();
    const dealSnapshot = await db.collection("deals").doc(dealId).get();
    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = { id: dealSnapshot.id, ...(dealSnapshot.data() ?? {}) } as Record<string, unknown> & { id: string };
    await assertDealWorkspaceAccess(user, deal);

    const assignment = asRecord(deal.contractorAssignment);
    const authoritativeContractorId = asString(assignment.contractorId);
    if (!authoritativeContractorId) {
      return NextResponse.json(
        { error: "Authoritative contractor assignment is required before tender pack delivery" },
        { status: 409 },
      );
    }

    const packSnapshot = await db.collection("tenderPacks").doc(tenderPackId).get();
    if (!packSnapshot.exists) {
      return NextResponse.json({ error: "Tender pack not found" }, { status: 404 });
    }

    const pack = packSnapshot.data() ?? {};
    if (asString(pack.dealId) !== dealId) {
      return NextResponse.json({ error: "Tender pack does not belong to this deal" }, { status: 403 });
    }

    if (asString(pack.workspaceId) && asString(pack.workspaceId) !== asString(deal.workspaceId)) {
      return NextResponse.json({ error: "Workspace access rejected" }, { status: 403 });
    }

    if (asString(pack.contractorId) && asString(pack.contractorId) !== authoritativeContractorId) {
      return NextResponse.json(
        { error: "Tender pack contractor does not match authoritative assignment" },
        { status: 409 },
      );
    }

    const storagePath = asString(pack.storagePath);
    if (!storagePath) {
      return NextResponse.json({ error: "Tender pack artifact is missing" }, { status: 409 });
    }

    const [artifact] = await getFirebaseStorageBucket().file(storagePath).download();
    const response = await resend.emails.send({
      from: getCorporateFromAddress("support"),
      to: [email],
      subject: "Your Tender Pack - Torque Empire",
      html: `<p>Your tender pack is attached.</p>`,
      attachments: [
        {
          filename: asString(pack.filename) ?? "tender-pack.pdf",
          content: artifact.toString("base64"),
        },
      ],
    });

    const evidenceId = response.data?.id ? `sent-email:${response.data.id}` : null;
    await recordProcurementTransitionAudit({
      actor: user,
      workspaceId: asString(deal.workspaceId),
      dealId,
      action: "tender_pack_delivery_sent",
      priorState: typeof deal.status === "string" ? deal.status : null,
      reason: "Tender pack email delivery completed without changing submission state.",
      evidenceReferences: { tenderPackId, sentEmailEvidenceId: evidenceId },
    });

    await db.collection("tenderPacks").doc(tenderPackId).collection("deliveryEvents").add({
      dealId,
      workspaceId: asString(deal.workspaceId),
      recipient: email,
      sentBy: user.uid,
      sentAt: Timestamp.now(),
      provider: "resend",
      providerMessageId: response.data?.id ?? null,
      providerError: response.error ? response.error.name : null,
    });

    console.info("Tender pack email sent", {
      id: response.data?.id ?? null,
      error: response.error ? response.error.name : null,
    });

    return NextResponse.json({
      success: true,
      response,
      submitted: false,
      submissionAuthority: `/api/opportunity-register/${dealId}/execution`,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("RESEND ERROR:", error);
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send email" }, { status });
  }
}
