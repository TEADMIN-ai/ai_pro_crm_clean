import { NextResponse } from "next/server";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";

export async function POST(
  req: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await context.params;
  const body = await req.json();
  const { contractorId, action } = body ?? {};

  if (!contractorId || !action) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const db = getFirebaseAdmin();
  const docRef = db
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentId);

  const update = {
    verified: action === "approve",
    status: action === "approve" ? "APPROVED" : "REJECTED",
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docRef.update(update);
  await recalculateContractorCompliance(db, contractorId);

  return NextResponse.json({ success: true });
}
