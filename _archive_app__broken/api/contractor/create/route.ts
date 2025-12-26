export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { saveContractorToFirestore } from "@/lib/contractor/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const contractorId =
      body.contractorId ||
      body.id ||
      crypto.randomUUID();

    await saveContractorToFirestore(contractorId, body);

    return NextResponse.json({
      success: true,
      contractorId,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
